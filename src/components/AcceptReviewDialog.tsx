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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface AcceptReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (spotlight: boolean) => Promise<void>;
  loading?: boolean;
}

export function AcceptReviewDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: AcceptReviewDialogProps) {
  const [spotlight, setSpotlight] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(spotlight);
      onOpenChange(false);
      setSpotlight(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Accept this review?</DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              Once you accept this review, it will count toward your Trust Score and rating.
            </p>
            <p>
              You can choose whether or not to spotlight it on your public profile.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="spotlight"
              checked={spotlight}
              onCheckedChange={(checked) => setSpotlight(checked === true)}
            />
            <Label
              htmlFor="spotlight"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Spotlight this review on my public profile
            </Label>
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
          <Button onClick={handleConfirm} disabled={submitting || loading}>
            {submitting ? "Accepting..." : "Accept Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
