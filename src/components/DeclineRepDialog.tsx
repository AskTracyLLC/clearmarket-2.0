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

interface DeclineRepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repInterestId: string;
  repAnonymousId: string;
  postTitle: string;
  vendorUserId: string;
  repUserId: string;
  onDeclined?: () => void;
}

export function DeclineRepDialog({
  open,
  onOpenChange,
  repInterestId,
  repAnonymousId,
  postTitle,
  vendorUserId,
  repUserId,
  onDeclined,
}: DeclineRepDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDecline = async () => {
    setIsSubmitting(true);

    try {
      // Update rep_interest record
      const { error: updateError } = await supabase
        .from("rep_interest")
        .update({
          status: "declined_by_vendor",
          declined_reason: reason.trim() || null,
          declined_at: new Date().toISOString(),
          declined_by_user_id: vendorUserId,
        })
        .eq("id", repInterestId);

      if (updateError) throw updateError;

      // Find the conversation for this post and post a system message
      const { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_one.eq.${vendorUserId},participant_two.eq.${vendorUserId}`)
        .or(`participant_one.eq.${repUserId},participant_two.eq.${repUserId}`)
        .eq("rep_interest_id", repInterestId)
        .maybeSingle();

      if (conversation?.id) {
        // Post system message so rep knows they were declined
        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          sender_id: vendorUserId,
          recipient_id: repUserId,
          body: `Vendor declined your interest for this request: "${postTitle}". This decision only applies to this request, not your overall profile.`,
        });

        // Update conversation preview
        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: "Vendor declined your interest for this request.",
          })
          .eq("id", conversation.id);
      }

      // Create notification for the rep
      const notificationBody = reason.trim()
        ? `This decision only applies to this request, not your overall profile.\n\nReason: "${reason.trim()}"`
        : "This decision only applies to this request, not your overall profile.";

      await supabase.from("notifications").insert({
        user_id: repUserId,
        type: "interest_declined",
        title: `Your interest in "${postTitle}" was not selected`,
        body: notificationBody,
        ref_id: repInterestId,
      });

      toast.success(`Declined ${repAnonymousId} for this Seeking Coverage request.`);
      onOpenChange(false);
      setReason("");
      onDeclined?.();
    } catch (error: any) {
      console.error("Error declining rep:", error);
      toast.error("Failed to decline rep");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decline this Field Rep for this request?</DialogTitle>
          <DialogDescription className="pt-2">
            You're declining <span className="font-semibold text-foreground">{repAnonymousId}</span> for this Seeking Coverage request:
            <br />
            <span className="font-medium text-foreground">{postTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <Textarea
              id="decline-reason"
              placeholder="e.g., rate mismatch, not a fit after discussion, scheduling issues..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              You can share a short reason, or leave this blank. The rep will be notified.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDecline}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Declining..." : "Confirm Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
