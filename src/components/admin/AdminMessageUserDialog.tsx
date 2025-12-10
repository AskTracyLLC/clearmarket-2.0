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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateConversation } from "@/lib/conversations";
import { createNotification } from "@/lib/notifications";
import { logAdminAction } from "@/lib/adminAudit";
import { MessageSquare } from "lucide-react";

interface AdminMessageUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserDisplay: string; // email or anonymous ID for display
  adminUserId: string;
}

export function AdminMessageUserDialog({
  open,
  onOpenChange,
  targetUserId,
  targetUserDisplay,
  adminUserId,
}: AdminMessageUserDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [sending, setSending] = useState(false);

  const handleClose = () => {
    setSubject("");
    setMessage("");
    setSubjectError("");
    setMessageError("");
    onOpenChange(false);
  };

  const handleSend = async () => {
    // Validate
    let hasError = false;
    if (!subject.trim()) {
      setSubjectError("Subject is required");
      hasError = true;
    } else {
      setSubjectError("");
    }
    if (!message.trim()) {
      setMessageError("Message is required");
      hasError = true;
    } else {
      setMessageError("");
    }
    if (hasError) return;

    setSending(true);
    try {
      // 1. Get or create a direct conversation (no origin post)
      const { id: conversationId, error: convError } = await getOrCreateConversation(
        adminUserId,
        targetUserId,
        null // null origin means direct message
      );

      if (convError || !conversationId) {
        throw new Error(convError || "Failed to create conversation");
      }

      // 2. Insert the message with subject prefixed in body
      const fullBody = `Subject: ${subject.trim()}\n\n${message.trim()}`;
      const { error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: adminUserId,
          recipient_id: targetUserId,
          body: fullBody,
          subject: subject.trim(),
          read: false,
        });

      if (msgError) {
        throw new Error("Failed to send message");
      }

      // 3. Update conversation preview
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: message.trim().slice(0, 100),
        })
        .eq("id", conversationId);

      // 4. Create alert notification for the user
      await createNotification(
        supabase,
        targetUserId,
        "admin_message",
        `Message from ClearMarket admin: ${subject.trim()}`,
        message.trim().slice(0, 200) + (message.trim().length > 200 ? "..." : ""),
        conversationId // ref_id links to the conversation
      );

      // 5. Log admin action
      await logAdminAction(adminUserId, {
        actionType: "user.message_sent",
        actionSummary: `Sent direct message to user ${targetUserDisplay}`,
        targetUserId: targetUserId,
        actionDetails: {
          subject: subject.trim(),
          message_preview: message.trim().slice(0, 100),
          conversation_id: conversationId,
        },
        sourcePage: "/admin/users",
      });

      toast.success("Message sent", {
        description: "This user will see it in their alerts and Direct messages.",
      });

      handleClose();
    } catch (error: any) {
      console.error("Error sending admin message:", error);
      toast.error("Failed to send message", {
        description: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Message this user
          </DialogTitle>
          <DialogDescription>
            Send a direct message to this user from ClearMarket. They'll see it in their alerts, and it will also appear in their Direct messages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
            />
            {subjectError && (
              <p className="text-sm text-destructive mt-1">{subjectError}</p>
            )}
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 min-h-[120px]"
            />
            {messageError && (
              <p className="text-sm text-destructive mt-1">{messageError}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
