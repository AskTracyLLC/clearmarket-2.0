import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { fetchReviewDetails, moderateReview, resolveReportsForReview } from "@/lib/adminReports";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface ReviewModerationPanelProps {
  reviewId: string;
  onModerated?: () => void;
}

export function ReviewModerationPanel({ reviewId, onModerated }: ReviewModerationPanelProps) {
  const { user } = useAuth();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moderationNotes, setModerationNotes] = useState("");
  const [excludeFromTrustScore, setExcludeFromTrustScore] = useState(false);

  useEffect(() => {
    loadReview();
  }, [reviewId]);

  const loadReview = async () => {
    setLoading(true);
    try {
      const data = await fetchReviewDetails(reviewId);
      setReview(data);
      setExcludeFromTrustScore(data?.exclude_from_trust_score || false);
      setModerationNotes(data?.moderation_notes || "");
    } catch (error) {
      console.error("Error loading review:", error);
      toast.error("Failed to load review details");
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (action: "keep" | "hide" | "exclude") => {
    if (!user) return;

    setSaving(true);
    try {
      // Update review moderation
      const result = await moderateReview(reviewId, action, moderationNotes);
      
      if (!result.success) {
        toast.error("Failed to moderate review", {
          description: result.error,
        });
        return;
      }

      // Resolve all reports for this review
      const resolveResult = await resolveReportsForReview(reviewId, user.id);
      
      if (!resolveResult.success) {
        toast.error("Failed to resolve reports", {
          description: resolveResult.error,
        });
        return;
      }

      toast.success("Review moderated successfully");
      if (onModerated) onModerated();
    } catch (error) {
      console.error("Error moderating review:", error);
      toast.error("Failed to moderate review");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading review...</div>;
  }

  if (!review) {
    return <div className="text-sm text-muted-foreground">Review not found</div>;
  }

  const getRoleLabel = (direction: string, isReviewer: boolean) => {
    if (direction === "rep_to_vendor") {
      return isReviewer ? "Field Rep" : "Vendor";
    } else {
      return isReviewer ? "Vendor" : "Field Rep";
    }
  };

  const getRatingLabels = (direction: string) => {
    if (direction === "rep_to_vendor") {
      return {
        on_time: "On-Time Performance",
        quality: "Quality of Inspection",
        communication: "Communication",
      };
    } else {
      return {
        on_time: "Helpfulness & Support",
        quality: "Communication",
        communication: "Pay Reliability",
      };
    }
  };

  const labels = getRatingLabels(review.direction);

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Flagged Review</Label>

      {/* Review Context */}
      <div className="bg-secondary/10 p-4 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {getRoleLabel(review.direction, true)}: {review.repAnonymousId}
            </p>
            <p className="text-xs text-muted-foreground">
              reviewed {getRoleLabel(review.direction, false)}: {review.vendorAnonymousId}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {review.is_hidden && <Badge variant="destructive">Hidden</Badge>}
            {review.exclude_from_trust_score && <Badge variant="outline">Excluded from Trust Score</Badge>}
          </div>
        </div>

        {/* Ratings */}
        <div className="space-y-2">
          {review.rating_on_time && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{labels.on_time}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: review.rating_on_time }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                ))}
              </div>
            </div>
          )}
          {review.rating_quality && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{labels.quality}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: review.rating_quality }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                ))}
              </div>
            </div>
          )}
          {review.rating_communication && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{labels.communication}</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: review.rating_communication }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comment */}
        {review.comment && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground italic">"{review.comment}"</p>
          </div>
        )}
      </div>

      {/* Moderation Controls */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="moderationNotes">Moderation Notes</Label>
          <Textarea
            id="moderationNotes"
            value={moderationNotes}
            onChange={(e) => setModerationNotes(e.target.value)}
            placeholder="Add notes about your moderation decision..."
            rows={3}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="excludeTrustScore"
            checked={excludeFromTrustScore}
            onCheckedChange={(checked) => setExcludeFromTrustScore(checked as boolean)}
          />
          <Label htmlFor="excludeTrustScore" className="text-sm font-normal cursor-pointer">
            Exclude from Trust Score calculations
          </Label>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleModerate("keep")}
            disabled={saving}
          >
            Keep + Mark Safe
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleModerate("hide")}
            disabled={saving}
          >
            Hide from Public
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleModerate("exclude")}
            disabled={saving}
          >
            Exclude from Trust
          </Button>
        </div>
      </div>
    </div>
  );
}
