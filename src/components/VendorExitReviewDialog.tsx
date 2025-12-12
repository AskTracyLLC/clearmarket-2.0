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
import { ReviewContextModal, type ReviewContextValue } from "@/components/ReviewContextModal";
import { ReviewContextChip } from "@/components/ReviewContextChip";

interface VendorExitReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repUserId: string;
  vendorUserId: string;
  repInterestId?: string | null;
  onComplete?: () => void;
}

export function VendorExitReviewDialog({
  open,
  onOpenChange,
  repUserId,
  vendorUserId,
  repInterestId,
  onComplete,
}: VendorExitReviewDialogProps) {
  const [onTimeRating, setOnTimeRating] = useState<number>(0);
  const [qualityRating, setQualityRating] = useState<number>(0);
  const [communicationRating, setCommunicationRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Review context state - using new modal-based approach
  const [reviewContext, setReviewContext] = useState<ReviewContextValue | null>(null);
  const [contextModalOpen, setContextModalOpen] = useState(false);

  // Reset context when dialog opens
  useEffect(() => {
    if (open) {
      setReviewContext(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const reviewData: any = {
        reviewer_id: vendorUserId,
        reviewee_id: repUserId,
        direction: "vendor_to_rep",
        is_exit_review: true,
        rating_on_time: onTimeRating > 0 ? onTimeRating : null,
        rating_quality: qualityRating > 0 ? qualityRating : null,
        rating_communication: communicationRating > 0 ? communicationRating : null,
        comment: comment.trim() || null,
        // Context fields from modal selection
        state_code: reviewContext?.stateCode || null,
        county_name: reviewContext?.countyName || null,
        inspection_category: reviewContext?.inspectionCategory || null,
        inspection_type_id: reviewContext?.inspectionTypeId || null,
      };

      const { data: savedReview, error } = await supabase
        .from("reviews")
        .insert(reviewData)
        .select()
        .single();

      if (error) throw error;

      // Create notification for rep
      const { data: vendorProfile } = await supabase
        .from("vendor_profile")
        .select("anonymous_id")
        .eq("user_id", vendorUserId)
        .single();

      await supabase.from("notifications").insert({
        user_id: repUserId,
        type: "review",
        ref_id: savedReview.id,
        title: "New review received",
        body: `You received a new review from ${vendorProfile?.anonymous_id || "a vendor"}.`,
      });

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
      setComment("");
      setReviewContext(null);
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Exit Review – Field Rep</DialogTitle>
            <DialogDescription>
              This feedback is used to help other vendors understand your experience. Your review will follow our verified-only rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Review Context Chip - opens modal on click */}
            <ReviewContextChip
              value={reviewContext}
              onEditClick={() => setContextModalOpen(true)}
            />

            <div className="space-y-2">
              {renderStarRating(onTimeRating, setOnTimeRating, "On-Time Performance")}
              <p className="text-xs text-muted-foreground">Do they complete inspections by the agreed due dates without constant chasing?</p>
            </div>
            
            <div className="space-y-2">
              {renderStarRating(qualityRating, setQualityRating, "Quality of Inspection")}
              <p className="text-xs text-muted-foreground">Are photos, forms, and documentation complete and correct the first time?</p>
            </div>
            
            <div className="space-y-2">
              {renderStarRating(communicationRating, setCommunicationRating, "Communication")}
              <p className="text-xs text-muted-foreground">Do they respond to messages, provide updates (appointments, delays), and flag issues early?</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment" className="text-sm font-medium">
                Additional Notes (Optional)
              </Label>
              <Textarea
                id="comment"
                placeholder="Example: Completed work, but went quiet for long periods…"
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

      {/* Context Selection Modal */}
      <ReviewContextModal
        open={contextModalOpen}
        onOpenChange={setContextModalOpen}
        repUserId={repUserId}
        vendorUserId={vendorUserId}
        currentValue={reviewContext || {
          mode: "overall",
          stateCode: null,
          countyName: null,
          inspectionCategory: null,
          inspectionTypeId: null,
          displayLabel: null,
        }}
        onApply={setReviewContext}
      />
    </>
  );
}
