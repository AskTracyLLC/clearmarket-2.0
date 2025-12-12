import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, AlertTriangle } from "lucide-react";
import { moveReviewToCoaching } from "@/lib/reviewCoaching";
import { toast } from "sonner";

interface MoveToCoachingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewId: string;
  repUserId: string;
  onSuccess: () => void;
}

export function MoveToCoachingDialog({
  open,
  onOpenChange,
  reviewId,
  repUserId,
  onSuccess,
}: MoveToCoachingDialogProps) {
  const [coachingNote, setCoachingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!coachingNote.trim()) {
      toast.error("Please enter what you will change going forward");
      return;
    }

    setSubmitting(true);
    const result = await moveReviewToCoaching(reviewId, repUserId, coachingNote.trim());
    setSubmitting(false);

    if (result.success) {
      toast.success(
        "This review has been moved to Coaching / Private Feedback. It no longer affects your public rating."
      );
      setCoachingNote("");
      onOpenChange(false);
      onSuccess();
    } else {
      toast.error(result.error || "Failed to move review to coaching");
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setCoachingNote("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Move this review to Coaching?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                When you move a review to Coaching / Private Feedback:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>It will no longer affect your public rating.</li>
                <li>The vendor who left it and ClearMarket Admins will still see it.</li>
                <li>It will count toward your Coaching history.</li>
                <li className="font-medium text-foreground">This action can't be undone.</li>
              </ul>
              <Alert className="bg-muted/50 border-muted">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This action uses 1 Coaching Credit (we will hook this into billing later).
                </AlertDescription>
              </Alert>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="coaching-note" className="text-sm font-medium">
              What will you change going forward? <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              This note is for your own accountability and for Admin review.
            </p>
            <Textarea
              id="coaching-note"
              placeholder="Describe what you'll do differently..."
              value={coachingNote}
              onChange={(e) => setCoachingNote(e.target.value)}
              rows={4}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || !coachingNote.trim()}
          >
            {submitting ? "Moving..." : "Confirm & Move to Coaching"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
