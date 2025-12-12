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
import { toast } from "sonner";

interface NotInterestedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
  repProfileId: string;
  onConfirmed: () => void;
}

export function NotInterestedDialog({
  open,
  onOpenChange,
  postId,
  postTitle,
  repProfileId,
  onConfirmed,
}: NotInterestedDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      // Check if interest record already exists
      const { data: existing } = await supabase
        .from("rep_interest")
        .select("id")
        .eq("post_id", postId)
        .eq("rep_id", repProfileId)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from("rep_interest")
          .update({
            status: "not_interested",
            not_interested_reason: reason.trim() || null,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new record with not_interested status
        const { error } = await supabase.from("rep_interest").insert({
          post_id: postId,
          rep_id: repProfileId,
          status: "not_interested",
          not_interested_reason: reason.trim() || null,
        });

        if (error) throw error;
      }

      toast.success("Marked as not interested");
      onConfirmed();
      onOpenChange(false);
      setReason("");
    } catch (error: any) {
      console.error("Error marking not interested:", error);
      toast.error("Failed to update. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as not interested?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This removes this opportunity from your recommended list. You can still see it later if you search under Find Work.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-4">
            Opportunity: <span className="font-medium text-foreground">{postTitle}</span>
          </p>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Rate too low, wrong area, scheduling conflict..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              For your own records. This is not sent to the vendor.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}