import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Star } from "lucide-react";

interface ReviewsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string | null;
}

interface ReviewData {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  direction: string;
  rating_on_time: number | null;
  rating_quality: number | null;
  rating_communication: number | null;
  comment: string | null;
  created_at: string;
  is_feedback?: boolean;
  reviewerAnonymousId?: string;
}

interface CategoryAverages {
  onTime: number;
  quality: number;
  communication: number;
}

export function ReviewsDetailDialog({
  open,
  onOpenChange,
  targetUserId,
}: ReviewsDetailDialogProps) {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [targetRole, setTargetRole] = useState<"rep" | "vendor" | null>(null);
  const [targetAnonymousId, setTargetAnonymousId] = useState<string>("");
  const [categoryAverages, setCategoryAverages] = useState<CategoryAverages | null>(null);
  const [overallTrustScore, setOverallTrustScore] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !targetUserId) return;

    async function loadReviews() {
      setLoading(true);
      try {
        // Determine target role and anonymous ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_fieldrep, is_vendor_admin")
          .eq("id", targetUserId)
          .maybeSingle();

        let role: "rep" | "vendor" | null = null;
        let anonId = "";

        if (profile?.is_fieldrep) {
          role = "rep";
          const { data: repProfile } = await supabase
            .from("rep_profile")
            .select("anonymous_id")
            .eq("user_id", targetUserId)
            .maybeSingle();
          anonId = repProfile?.anonymous_id || "FieldRep#?";
        } else if (profile?.is_vendor_admin) {
          role = "vendor";
          const { data: vendorProfile } = await supabase
            .from("vendor_profile")
            .select("anonymous_id")
            .eq("user_id", targetUserId)
            .maybeSingle();
          anonId = vendorProfile?.anonymous_id || "Vendor#?";
        }

        setTargetRole(role);
        setTargetAnonymousId(anonId);

        // Fetch reviews where this user is the reviewee
        const { data: reviewsData, error } = await supabase
          .from("reviews")
          .select("*, is_feedback")
          .eq("reviewee_id", targetUserId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching reviews:", error);
          setReviews([]);
          return;
        }

        // Filter out feedback and coaching reviews for scoring calculations
        const scoredReviews = (reviewsData || []).filter(r => !r.is_feedback && r.status !== "coaching");

        // Fetch reviewer anonymous IDs
        const reviewerIds = [...new Set(reviewsData?.map(r => r.reviewer_id) || [])];
        const reviewerAnonIds: Record<string, string> = {};

        if (reviewerIds.length > 0) {
          // Check rep profiles
          const { data: repProfiles } = await supabase
            .from("rep_profile")
            .select("user_id, anonymous_id")
            .in("user_id", reviewerIds);

          repProfiles?.forEach(p => {
            reviewerAnonIds[p.user_id] = p.anonymous_id || "FieldRep#?";
          });

          // Check vendor profiles
          const { data: vendorProfiles } = await supabase
            .from("vendor_profile")
            .select("user_id, anonymous_id")
            .in("user_id", reviewerIds);

          vendorProfiles?.forEach(p => {
            reviewerAnonIds[p.user_id] = p.anonymous_id || "Vendor#?";
          });
        }

        // Attach reviewer anonymous IDs to reviews
        const enrichedReviews: ReviewData[] = (reviewsData || []).map(r => ({
          ...r,
          reviewerAnonymousId: reviewerAnonIds[r.reviewer_id] || "User#?",
        }));

        setReviews(enrichedReviews);

        // Calculate category averages (excluding feedback reviews)
        if (scoredReviews.length > 0) {
          const totals = { onTime: 0, quality: 0, communication: 0 };
          const counts = { onTime: 0, quality: 0, communication: 0 };

          scoredReviews.forEach(review => {
            if (review.rating_on_time !== null) {
              totals.onTime += review.rating_on_time;
              counts.onTime++;
            }
            if (review.rating_quality !== null) {
              totals.quality += review.rating_quality;
              counts.quality++;
            }
            if (review.rating_communication !== null) {
              totals.communication += review.rating_communication;
              counts.communication++;
            }
          });

          setCategoryAverages({
            onTime: counts.onTime > 0 ? totals.onTime / counts.onTime : 0,
            quality: counts.quality > 0 ? totals.quality / counts.quality : 0,
            communication: counts.communication > 0 ? totals.communication / counts.communication : 0,
          });

          // Calculate overall Trust Score (average of all three ratings across scored reviews)
          const allRatings: number[] = [];
          scoredReviews.forEach(review => {
            if (review.rating_on_time !== null) allRatings.push(review.rating_on_time);
            if (review.rating_quality !== null) allRatings.push(review.rating_quality);
            if (review.rating_communication !== null) allRatings.push(review.rating_communication);
          });

          if (allRatings.length > 0) {
            const sum = allRatings.reduce((a, b) => a + b, 0);
            setOverallTrustScore(sum / allRatings.length);
          }
        } else {
          setCategoryAverages(null);
          setOverallTrustScore(null);
        }
      } catch (error) {
        console.error("Error in loadReviews:", error);
      } finally {
        setLoading(false);
      }
    }

    loadReviews();
  }, [open, targetUserId]);

  // Role-aware labels
  const getCategoryLabels = () => {
    if (targetRole === "rep") {
      return {
        onTime: "On-Time Performance",
        quality: "Quality of Inspection",
        communication: "Communication",
      };
    } else {
      return {
        onTime: "Helpfulness & Support",
        quality: "Communication",
        communication: "Pay Reliability",
      };
    }
  };

  const labels = getCategoryLabels();

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading reviews...</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            Reviews for {targetAnonymousId}
          </DialogTitle>
          {targetRole && (
            <p className="text-sm text-muted-foreground">
              {targetRole === "rep" ? "Field Rep" : "Vendor"}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {reviews.length === 0 ? (
            <Card className="p-6 bg-card-elevated text-center">
              <p className="text-muted-foreground">
                No reviews yet. Everyone starts in the middle — this Trust Score will update as real reviews are submitted.
              </p>
              <div className="mt-4">
                <Badge variant="secondary" className="text-sm">
                  New – not yet rated
                </Badge>
              </div>
            </Card>
          ) : (
            <>
              {/* Overall Trust Score */}
              {overallTrustScore !== null && (
                <Card className="p-6 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-2">Overall Trust Score</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-primary">
                      {overallTrustScore.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / 5.0 · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                </Card>
              )}

              {/* Category Averages */}
              {categoryAverages && (
                <Card className="p-6 bg-card-elevated">
                  <h3 className="font-semibold text-foreground mb-4">Category Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{labels.onTime}</span>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-primary fill-primary" />
                        <span className="font-semibold text-foreground">
                          {categoryAverages.onTime.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{labels.quality}</span>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-primary fill-primary" />
                        <span className="font-semibold text-foreground">
                          {categoryAverages.quality.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{labels.communication}</span>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-primary fill-primary" />
                        <span className="font-semibold text-foreground">
                          {categoryAverages.communication.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Recent Reviews */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Recent Reviews</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {reviews.slice(0, 10).map((review) => (
                    <Card key={review.id} className="p-4 bg-card-elevated">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {review.reviewerAnonymousId}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                          {review.is_feedback && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-600 border-amber-500/30 cursor-help">
                                    Feedback – Not scored
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>This review is visible for learning purposes but is excluded from Trust Score calculations.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        {review.rating_on_time !== null && (
                          <span>
                            {labels.onTime.split(" ")[0]}: {review.rating_on_time}
                          </span>
                        )}
                        {review.rating_quality !== null && (
                          <span>
                            {labels.quality.split(" ")[0]}: {review.rating_quality}
                          </span>
                        )}
                        {review.rating_communication !== null && (
                          <span>
                            {labels.communication.split(" ")[0]}: {review.rating_communication}
                          </span>
                        )}
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground italic">
                          "{review.comment}"
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
                {reviews.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Showing recent reviews
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
