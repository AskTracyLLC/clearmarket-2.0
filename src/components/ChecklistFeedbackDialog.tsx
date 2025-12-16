import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { gettingStartedChecklistCopy } from "@/copy/gettingStartedChecklistCopy";

const copy = gettingStartedChecklistCopy.feedbackDialog;

const FEEDBACK_TYPES = [
  { value: "bug", label: copy.feedbackTypes.bug },
  { value: "confusing", label: copy.feedbackTypes.confusing },
  { value: "completed_not_marked", label: copy.feedbackTypes.completed_not_marked },
  { value: "suggestion", label: copy.feedbackTypes.suggestion },
  { value: "other", label: copy.feedbackTypes.other },
] as const;

type FeedbackType = typeof FEEDBACK_TYPES[number]["value"];

interface ChecklistFeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userChecklistItemId: string;
  templateId: string;
  itemId: string;
  itemTitle: string;
  itemDescription?: string;
}

export function ChecklistFeedbackDialog({
  open,
  onClose,
  userId,
  userChecklistItemId,
  templateId,
  itemId,
  itemTitle,
  itemDescription,
}: ChecklistFeedbackDialogProps) {
  const { toast } = useToast();
  const [feedbackType, setFeedbackType] = useState<FeedbackType | "">("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `checklist-feedback/${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({
          title: copy.toasts.errorTitle,
          description: copy.toasts.uploadFailed.replace("{filename}", file.name),
          variant: "destructive",
        });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("support-attachments")
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        newUrls.push(urlData.publicUrl);
      }
    }

    setAttachments((prev) => [...prev, ...newUrls]);
    setUploading(false);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!feedbackType) {
      toast({
        title: copy.toasts.selectType,
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: copy.toasts.enterMessage,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("checklist_item_feedback").insert({
        user_id: userId,
        user_checklist_item_id: userChecklistItemId || null,
        template_id: templateId,
        item_id: itemId,
        feedback_type: feedbackType,
        message: message.trim(),
        attachment_urls: attachments,
      });

      if (error) throw error;

      toast({
        title: copy.toasts.successTitle,
        description: copy.toasts.successDescription,
      });

      // Reset and close
      setFeedbackType("");
      setMessage("");
      setAttachments([]);
      onClose();
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({
        title: copy.toasts.errorTitle,
        description: error.message || copy.toasts.errorDescription,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p className="font-medium text-foreground">{itemTitle}</p>
              {itemDescription && (
                <p className="text-sm text-muted-foreground">{itemDescription}</p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Feedback Type */}
          <div className="space-y-2">
            <Label htmlFor="feedbackType">{copy.feedbackTypeLabel}</Label>
            <Select
              value={feedbackType}
              onValueChange={(v) => setFeedbackType(v as FeedbackType)}
            >
              <SelectTrigger>
                <SelectValue placeholder={copy.feedbackTypePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">{copy.messageLabel}</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={copy.messagePlaceholder}
              rows={4}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>{copy.attachmentsLabel}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="feedback-file-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("feedback-file-upload")?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploading ? copy.uploadingButton : copy.uploadButton}
              </Button>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((url, index) => (
                  <div
                    key={index}
                    className="relative group rounded border border-border overflow-hidden"
                  >
                    <img
                      src={url}
                      alt={`Attachment ${index + 1}`}
                      className="w-16 h-16 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute top-0 right-0 bg-destructive text-destructive-foreground p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {copy.cancelButton}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !feedbackType || !message.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {copy.submittingButton}
              </>
            ) : (
              copy.submitButton
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}