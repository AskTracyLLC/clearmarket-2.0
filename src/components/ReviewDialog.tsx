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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Star } from "lucide-react";

export interface Review {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  direction: 'vendor_to_rep' | 'rep_to_vendor';
  rep_interest_id: string | null;
  is_exit_review: boolean;
  rating_on_time: number | null;
  rating_quality: number | null;
  rating_communication: number | null;
  would_work_again: boolean | null;
  comment: string | null;
  status: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  reviewerId: string;
  revieweeId: string;
  direction: 'vendor_to_rep' | 'rep_to_vendor';
  repInterestId?: string | null;
  isExitReview?: boolean;

  // Optional preloaded review for "edit" mode
  existingReview?: Review | null;

  // Meta info for display (not saved)
  reviewerLabel?: string; // e.g. 'Vendor#1'
  revieweeLabel?: string; // e.g. 'FieldRep#1'
  contextLabel?: string;  // e.g. 'Exit Review' or 'General Feedback'

  onSaved?: (review: Review) => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  reviewerId,
  revieweeId,
  direction,
  repInterestId = null,
  isExitReview = false,
  existingReview = null,
  reviewerLabel,
  revieweeLabel,
  contextLabel,
  onSaved,
}: ReviewDialogProps) {
  const [onTimeRating, setOnTimeRating] = useState<number>(0);
  const [qualityRating, setQualityRating] = useState<number>(0);
  const [communicationRating, setCommunicationRating] = useState<number>(0);
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewToEdit, setReviewToEdit] = useState<Review | null>(null);

  // Load existing review on mount
  useEffect(() => {
    if (!open) return;

    async function loadReview() {
      // If existing review passed in, use that
      if (existingReview) {
        setReviewToEdit(existingReview);
        setOnTimeRating(existingReview.rating_on_time || 0);
        setQualityRating(existingReview.rating_quality || 0);
        setCommunicationRating(existingReview.rating_communication || 0);
        setWouldWorkAgain(existingReview.would_work_again);
        setComment(existingReview.comment || "");
        return;
      }

      // Otherwise try to fetch existing review
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewer_id", reviewerId)
        .eq("reviewee_id", revieweeId)
        .eq("direction", direction)
        .eq("is_exit_review", isExitReview)
        .maybeSingle();

      if (data) {
        setReviewToEdit(data as Review);
        setOnTimeRating(data.rating_on_time || 0);
        setQualityRating(data.rating_quality || 0);
        setCommunicationRating(data.rating_communication || 0);
        setWouldWorkAgain(data.would_work_again);
        setComment(data.comment || "");
      } else {
        // Reset for new review
        setReviewToEdit(null);
        setOnTimeRating(0);
        setQualityRating(0);
        setCommunicationRating(0);
        setWouldWorkAgain(null);
        setComment("");
      }
    }

    loadReview();
  }, [open, existingReview, reviewerId, revieweeId, direction, isExitReview]);

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
      const reviewData = {
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        direction,
        rep_interest_id: repInterestId,
        is_exit_review: isExitReview,
        rating_on_time: onTimeRating > 0 ? onTimeRating : null,
        rating_quality: qualityRating > 0 ? qualityRating : null,
        rating_communication: communicationRating > 0 ? communicationRating : null,
        would_work_again: wouldWorkAgain,
        comment: comment.trim() || null,
        is_verified: repInterestId != null,
        status: 'pending_reviewee',
      };

      let savedReview: Review;

      if (reviewToEdit) {
        // Update existing review
        const { data, error } = await supabase
          .from("reviews")
          .update(reviewData)
          .eq("id", reviewToEdit.id)
          .select()
          .single();

        if (error) throw error;
        savedReview = data as Review;
      } else {
        // Insert new review
        const { data, error } = await supabase
          .from("reviews")
          .insert(reviewData)
          .select()
          .single();

        if (error) throw error;
        savedReview = data as Review;

        // Create notification for reviewee (only for new reviews, not edits)
        const { data: reviewerProfile } = await supabase
          .from(direction === 'vendor_to_rep' ? "vendor_profile" : "rep_profile")
          .select("anonymous_id")
          .eq("user_id", reviewerId)
          .single();

        await supabase.from("notifications").insert({
          user_id: revieweeId,
          type: "review",
          ref_id: savedReview.id,
          title: "New review received",
          body: `You received a new review from ${reviewerProfile?.anonymous_id || "another user"}.`,
        });
      }

      toast({
        title: reviewToEdit ? "Review updated" : isExitReview ? "Exit review saved" : "Review saved",
        description: "Thank you for your feedback.",
      });

      onSaved?.(savedReview);
      onOpenChange(false);
      
      // Reset form
      setOnTimeRating(0);
      setQualityRating(0);
      setCommunicationRating(0);
      setWouldWorkAgain(null);
      setComment("");
      setReviewToEdit(null);
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
    if (isExitReview) {
      toast({
        title: "Connection ended",
        description: "You can always leave a review later.",
      });
    }
    onOpenChange(false);
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

  const isVendorReviewing = direction === 'vendor_to_rep';
  const titlePrefix = isExitReview ? "Exit Review" : reviewToEdit ? "Edit Review" : "Leave Review";
  const titleSuffix = isVendorReviewing ? "Field Rep" : "Vendor";

  // Role-aware labels
  const labels = isVendorReviewing
    ? {
        onTimeLabel: "On-Time Performance",
        onTimeHelp: "Do they complete inspections by the agreed due dates without constant chasing?",
        qualityLabel: "Quality of Inspection",
        qualityHelp: "Are photos, forms, and documentation complete and correct the first time?",
        commLabel: "Communication",
        commHelp: "Do they respond to messages, provide updates (appointments, delays), and flag issues early?",
      }
    : {
        onTimeLabel: "Helpfulness & Support",
        onTimeHelp: "Does this vendor provide clear instructions, help troubleshoot issues, and back you up with clients when needed?",
        qualityLabel: "Communication",
        qualityHelp: "Does this vendor respond to questions, give updates on changes, and set realistic expectations?",
        commLabel: "Pay Reliability",
        commHelp: "Do they pay on time and honor the rates and terms they agreed to?",
      };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contextLabel || `${titlePrefix} for This ${titleSuffix}`}
          </DialogTitle>
          <DialogDescription>
            {isVendorReviewing
              ? "Help future-you remember how this rep performed. These ratings will also help build ClearMarket's trust metrics over time."
              : "Share how it was working with this vendor. Your feedback helps you and others make better choices."
            }
            {!isExitReview && " All fields are optional."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            {renderStarRating(onTimeRating, setOnTimeRating, labels.onTimeLabel)}
            <p className="text-xs text-muted-foreground">{labels.onTimeHelp}</p>
          </div>
          
          <div className="space-y-2">
            {renderStarRating(qualityRating, setQualityRating, labels.qualityLabel)}
            <p className="text-xs text-muted-foreground">{labels.qualityHelp}</p>
          </div>
          
          <div className="space-y-2">
            {renderStarRating(communicationRating, setCommunicationRating, labels.commLabel)}
            <p className="text-xs text-muted-foreground">{labels.commHelp}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="would_work_again"
                checked={wouldWorkAgain === true}
                onCheckedChange={(checked) => setWouldWorkAgain(checked === true ? true : null)}
              />
              <Label
                htmlFor="would_work_again"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Would you work with this {isVendorReviewing ? "rep" : "vendor"} again?
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-medium">
              Additional Comments (Optional)
            </Label>
            <Textarea
              id="comment"
              placeholder={
                isVendorReviewing
                  ? "Anything you want to remember about working with this rep?"
                  : "Anything you want to remember about working with this vendor?"
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Reviews are visible to the other party and may be shown on profiles once published.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {isExitReview && (
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
              ? reviewToEdit ? "Updating..." : "Submitting..." 
              : reviewToEdit ? "Update Review" : "Submit Review"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
