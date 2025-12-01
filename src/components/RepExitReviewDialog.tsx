import { useState } from "react";
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

interface RepExitReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorUserId: string;
  repUserId: string;
  onComplete?: () => void;
}

export function RepExitReviewDialog({
  open,
  onOpenChange,
  vendorUserId,
  repUserId,
  onComplete,
}: RepExitReviewDialogProps) {
  const [fairnessRating, setFairnessRating] = useState<number>(0);
  const [clarityRating, setClarityRating] = useState<number>(0);
  const [timelinessRating, setTimelinessRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const reviewData: any = {
        reviewer_id: repUserId,
        reviewee_id: vendorUserId,
        direction: "rep_to_vendor",
        is_exit_review: true,
        rating_on_time: timelinessRating > 0 ? timelinessRating : null,
        rating_quality: clarityRating > 0 ? clarityRating : null,
        rating_communication: fairnessRating > 0 ? fairnessRating : null,
        comment: comment.trim() || null,
      };

      const { error } = await supabase
        .from("reviews")
        .insert(reviewData);

      if (error) throw error;

      toast({
        title: "Exit review saved",
        description: "Thank you for your feedback.",
      });

      onOpenChange(false);
      onComplete?.();
      
      // Reset form
      setFairnessRating(0);
      setClarityRating(0);
      setTimelinessRating(0);
      setComment("");
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
          <DialogTitle>Exit Review – Vendor</DialogTitle>
          <DialogDescription>
            Share your experience with this vendor. Your feedback helps you and the ClearMarket community make better connections.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {renderStarRating(fairnessRating, setFairnessRating, "Fairness of pay")}
          {renderStarRating(clarityRating, setClarityRating, "Clarity of expectations")}
          {renderStarRating(timelinessRating, setTimelinessRating, "Timeliness of payment")}

          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-medium">
              Additional Notes (Optional)
            </Label>
            <Textarea
              id="comment"
              placeholder="Example: Paid on time but turn times were unrealistic…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={submitting}
          >
            Skip for now
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
