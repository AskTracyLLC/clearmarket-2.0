import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createReport } from "@/lib/reports";
import { toast } from "sonner";
import { checkRateLimit, getRateLimitMessage } from "@/lib/rateLimit";

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reporterUserId: string;
  reportedUserId: string;
  conversationId?: string;
  targetAnonId?: string;
  alreadyReported?: boolean;
  targetType?: string;
  targetId?: string;
  contextLabel?: string;
}

const REASON_CATEGORIES = [
  { value: "spam", label: "Spam / Unsolicited Offers" },
  { value: "harassment", label: "Harassment / Abusive Behavior" },
  { value: "payment_issue", label: "Payment issue / Non-payment" },
  { value: "misrepresentation", label: "Misrepresentation / Scams" },
  { value: "other", label: "Other" },
];

export function ReportUserDialog({
  open,
  onOpenChange,
  reporterUserId,
  reportedUserId,
  conversationId,
  targetAnonId = "this user",
  alreadyReported = false,
  targetType,
  targetId,
  contextLabel,
}: ReportUserDialogProps) {
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reasonCategory) {
      toast.error("Please select a reason category");
      return;
    }

    setSubmitting(true);

    // Rate limit check
    const rl = await checkRateLimit({ action: "report_content" });
    if (!rl.allowed) {
      toast.error(getRateLimitMessage("report_content"));
      setSubmitting(false);
      return;
    }

    try {
      const result = await createReport({
        reporterUserId,
        reportedUserId,
        conversationId,
        reasonCategory,
        reasonDetails: reasonDetails.trim() || undefined,
        targetType,
        targetId,
      });

      if (result.success) {
        toast.success("Thanks, your report has been submitted.");
        onOpenChange(false);
        // Reset form
        setReasonCategory("");
        setReasonDetails("");
      } else {
        toast.error("Failed to submit report", {
          description: result.error || "Please try again",
        });
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report this user</DialogTitle>
        <DialogDescription>
            {alreadyReported ? (
              <span>You've already submitted a report for this {conversationId ? "conversation" : "content"}.</span>
            ) : contextLabel ? (
              <span>
                You're reporting: <strong>{contextLabel}</strong>. This report will be reviewed by ClearMarket staff.
              </span>
            ) : conversationId ? (
              <span>
                You're reporting <strong>{targetAnonId}</strong> for issues in this conversation. This report will be reviewed by ClearMarket staff.
              </span>
            ) : (
              <span>
                You're reporting <strong>{targetAnonId}</strong>. This report will be reviewed by ClearMarket staff.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {alreadyReported ? (
          <div className="py-4 text-center text-muted-foreground">
            Your previous report is being reviewed.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category field */}
            <div className="space-y-3">
              <Label>Reason (required)</Label>
              <RadioGroup value={reasonCategory} onValueChange={setReasonCategory}>
                {REASON_CATEGORIES.map((cat) => (
                  <div key={cat.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={cat.value} id={cat.value} />
                    <Label htmlFor={cat.value} className="font-normal cursor-pointer">
                      {cat.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Details field */}
            <div className="space-y-2">
              <Label htmlFor="details">Details (optional)</Label>
              <Textarea
                id="details"
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                placeholder="Include any specifics that would help us understand what happened."
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
