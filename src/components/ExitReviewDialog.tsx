import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Star } from "lucide-react";

interface ConnectionReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repInterestId: string;
  repUserId: string;
  vendorUserId: string;
  reviewerRole: "vendor" | "rep";
  source?: "disconnect" | "manual" | "post_connection";
  onComplete?: () => void;
}

export function ConnectionReviewDialog({
  open,
  onOpenChange,
  repInterestId,
  repUserId,
  vendorUserId,
  reviewerRole,
  source = "manual",
  onComplete,
}: ConnectionReviewDialogProps) {
  const [onTimeRating, setOnTimeRating] = useState<number>(0);
  const [qualityRating, setQualityRating] = useState<number>(0);
  const [communicationRating, setCommunicationRating] = useState<number>(0);
  const [summaryComment, setSummaryComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);

  // Load existing review if any
  useEffect(() => {
    if (!open || !repInterestId) return;

    async function loadExistingReview() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: existingReview } = await supabase
        .from("connection_reviews")
        .select("id, rating_on_time, rating_quality, rating_communication, summary_comment")
        .eq("rep_interest_id", repInterestId)
        .eq("reviewer_id", userData.user.id)
        .maybeSingle();

      if (existingReview) {
        setExistingReviewId(existingReview.id);
        setOnTimeRating(existingReview.rating_on_time || 0);
        setQualityRating(existingReview.rating_quality || 0);
        setCommunicationRating(existingReview.rating_communication || 0);
        setSummaryComment(existingReview.summary_comment || "");
      } else {
        setExistingReviewId(null);
        setOnTimeRating(0);
        setQualityRating(0);
        setCommunicationRating(0);
        setSummaryComment("");
      }
    }

    loadExistingReview();
  }, [open, repInterestId]);

  const handleSubmit = async () => {
    // Validate at least one rating is provided
    if (onTimeRating === 0 && qualityRating === 0 && communicationRating === 0) {
      toast({
        title: "No ratings provided",
        description: "Please rate at least one aspect before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const reviewData: any = {
        rep_interest_id: repInterestId,
        reviewer_id: userData.user.id,
        rep_user_id: repUserId,
        vendor_user_id: vendorUserId,
        reviewer_role: reviewerRole,
        rating_on_time: onTimeRating > 0 ? onTimeRating : null,
        rating_quality: qualityRating > 0 ? qualityRating : null,
        rating_communication: communicationRating > 0 ? communicationRating : null,
        summary_comment: summaryComment.trim() || null,
        source,
        is_public: true,
      };

      if (existingReviewId) {
        // Update existing review
        const { error } = await supabase
          .from("connection_reviews")
          .update(reviewData)
          .eq("id", existingReviewId);

        if (error) throw error;
      } else {
        // Insert new review
        const { error } = await supabase
          .from("connection_reviews")
          .insert(reviewData);

        if (error) throw error;
      }

      toast({
        title: existingReviewId ? "Review updated" : source === "disconnect" ? "Exit review saved" : "Review saved",
        description: "Thank you for your feedback.",
      });

      onOpenChange(false);
      onComplete?.();
      
      // Reset form
      setOnTimeRating(0);
      setQualityRating(0);
      setCommunicationRating(0);
      setSummaryComment("");
      setExistingReviewId(null);
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save review",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (source === "disconnect") {
      toast({
        title: "Connection ended",
        description: "You can always leave a review later.",
      });
    }
    onOpenChange(false);
    onComplete?.();
  };

  const renderStarRating = (
    rating: number,
    setRating: (value: number) => void,
    label: string
  ) => {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="focus:outline-none transition-colors"
            >
              <Star
                className={`w-6 h-6 ${
                  star <= rating
                    ? "fill-primary text-primary"
                    : "fill-none text-muted-foreground hover:text-primary"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {source === "disconnect" 
              ? reviewerRole === "vendor" 
                ? "Exit Review for This Field Rep" 
                : "Exit Review for This Vendor"
              : existingReviewId
                ? reviewerRole === "vendor"
                  ? "Edit Review for This Field Rep"
                  : "Edit Review for This Vendor"
                : reviewerRole === "vendor"
                  ? "Leave Review for This Field Rep"
                  : "Leave Review for This Vendor"
            }
          </DialogTitle>
          <DialogDescription>
            {reviewerRole === "vendor"
              ? "Help future-you remember how this rep performed. These ratings will also help build ClearMarket's trust metrics over time."
              : "Share how it was working with this vendor. Your feedback helps you and others make better choices."
            }
            {source !== "disconnect" && " All fields are optional."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {renderStarRating(onTimeRating, setOnTimeRating, "On-Time Performance")}
          {renderStarRating(qualityRating, setQualityRating, "Quality of Work")}
          {renderStarRating(communicationRating, setCommunicationRating, "Communication")}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Additional Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder={
                reviewerRole === "vendor"
                  ? "Anything you want to remember about working with this rep? (Optional, private between you and ClearMarket for now.)"
                  : "Anything you want to remember about working with this vendor? (Optional, private between you and ClearMarket for now.)"
              }
              value={summaryComment}
              onChange={(e) => setSummaryComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {source === "disconnect" && (
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={submitting}
            >
              Skip
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting 
              ? existingReviewId ? "Updating..." : "Submitting..." 
              : existingReviewId ? "Update Review" : "Submit Review"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Backward compatibility export
export { ConnectionReviewDialog as ExitReviewDialog };
