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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DISPUTE_REASONS = [
  { value: "not_accurate", label: "Not accurate" },
  { value: "wrong_inspector", label: "Wrong inspector / wrong job" },
  { value: "misunderstanding", label: "Misunderstanding" },
  { value: "other", label: "Other" },
];

interface DisputeReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, explanation: string) => Promise<void>;
  loading?: boolean;
}

export function DisputeReviewDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: DisputeReviewDialogProps) {
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason || !explanation.trim()) return;
    
    setSubmitting(true);
    try {
      await onConfirm(reason, explanation.trim());
      onOpenChange(false);
      setReason("");
      setExplanation("");
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = reason && explanation.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dispute this review?</DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              Disputing a review flags it for ClearMarket review.
            </p>
            <p>
              While disputed, it will not count toward your Trust Score until an Admin has reviewed it.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="dispute-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dispute-explanation">
              Explanation <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="dispute-explanation"
              placeholder="Please explain your side of the situation..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This information will be reviewed by ClearMarket staff.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting || loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || loading || !isValid}
          >
            {submitting ? "Submitting..." : "Submit Dispute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
