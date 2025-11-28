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

interface ExitReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repInterestId: string;
  subjectUserId: string;
  postId?: string | null;
  onComplete?: () => void;
}

export function ExitReviewDialog({
  open,
  onOpenChange,
  repInterestId,
  subjectUserId,
  postId,
  onComplete,
}: ExitReviewDialogProps) {
  const [onTimeRating, setOnTimeRating] = useState<number>(0);
  const [qualityRating, setQualityRating] = useState<number>(0);
  const [communicationRating, setCommunicationRating] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

      const { error } = await supabase.from("connection_reviews").insert({
        rep_interest_id: repInterestId,
        reviewer_id: userData.user.id,
        subject_id: subjectUserId,
        post_id: postId,
        on_time_rating: onTimeRating > 0 ? onTimeRating : null,
        quality_rating: qualityRating > 0 ? qualityRating : null,
        communication_rating: communicationRating > 0 ? communicationRating : null,
        notes: notes.trim() || null,
        source: "disconnect",
      });

      if (error) throw error;

      toast({
        title: "Exit review saved",
        description: "Thank you for your feedback.",
      });

      onOpenChange(false);
      onComplete?.();
      
      // Reset form
      setOnTimeRating(0);
      setQualityRating(0);
      setCommunicationRating(0);
      setNotes("");
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
    toast({
      title: "Connection ended",
      description: "You can always leave a review later.",
    });
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
          <DialogTitle>End Connection – Exit Review</DialogTitle>
          <DialogDescription>
            Help us improve the platform by sharing your experience with this connection.
            All fields are optional.
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
              placeholder="Any additional feedback about this connection..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            Skip
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
