import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ReportWithDetails, updateReportStatus } from "@/lib/adminReports";
import { ReviewModerationPanel } from "./ReviewModerationPanel";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ReportDetailPanelProps {
  report: ReportWithDetails;
  onClose: () => void;
}

export function ReportDetailPanel({ report, onClose }: ReportDetailPanelProps) {
  const { user } = useAuth();
  const [adminNotes, setAdminNotes] = useState(report.admin_notes || "");
  const [status, setStatus] = useState(report.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const result = await updateReportStatus(report.id, status, user.id, adminNotes);
      
      if (result.success) {
        toast.success("Report updated successfully");
        onClose();
      } else {
        toast.error("Failed to update report", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to update report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-background border-l border-border shadow-xl overflow-y-auto z-50">
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Report Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Report Metadata */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-muted-foreground">Report Type</Label>
            <p className="text-sm font-medium capitalize">{report.target_type || "User"}</p>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Status</Label>
            <div className="mt-1">
              <Badge>{status.replace("_", " ")}</Badge>
            </div>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Reported On</Label>
            <p className="text-sm">{format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
          </div>
        </div>

        {/* Reporter Information */}
        <div className="border-t border-border pt-4">
          <Label className="text-sm font-medium">Reporter</Label>
          <div className="mt-2 space-y-1">
            <p className="text-sm">{report.reporter.full_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">{report.reporter.email}</p>
          </div>
        </div>

        {/* Reported User Information */}
        <div className="border-t border-border pt-4">
          <Label className="text-sm font-medium">Reported User</Label>
          <div className="mt-2 space-y-1">
            <p className="text-sm">{report.reported.full_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">{report.reported.email}</p>
          </div>
        </div>

        {/* Reason */}
        <div className="border-t border-border pt-4">
          <Label className="text-sm font-medium">Reason</Label>
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium">{report.reason_category}</p>
            {report.reason_details && (
              <p className="text-sm text-muted-foreground">{report.reason_details}</p>
            )}
          </div>
        </div>

        {/* Review Moderation (if target_type is review) */}
        {report.target_type === "review" && report.target_id && (
          <div className="border-t border-border pt-4">
            <ReviewModerationPanel 
              reviewId={report.target_id} 
              onModerated={onClose}
            />
          </div>
        )}

        {/* Conversation Link (if applicable) */}
        {report.conversation_id && (
          <div className="border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/messages/${report.conversation_id}`, "_blank")}
            >
              View Conversation
            </Button>
          </div>
        )}

        {/* Admin Controls */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Update Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminNotes">Admin Notes</Label>
            <Textarea
              id="adminNotes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add internal notes about this report..."
              rows={4}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Existing Review Information */}
        {report.reviewed_at && report.reviewed_by && (
          <div className="border-t border-border pt-4 text-sm text-muted-foreground">
            <p>Reviewed on {format(new Date(report.reviewed_at), "MMM d, yyyy 'at' h:mm a")}</p>
            {report.reviewer_notes && (
              <p className="mt-2">
                <strong>Previous Notes:</strong> {report.reviewer_notes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
