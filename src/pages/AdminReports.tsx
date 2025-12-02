import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { fetchAllReports, updateReportStatus } from "@/lib/reports";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminReports() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    checkAdminStatus();
  }, [user, authLoading, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      toast.error("Unauthorized", {
        description: "You don't have permission to access this page.",
      });
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    loadReports();
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchAllReports();
      setReports(data);
    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    if (!user) return;

    setUpdatingReportId(reportId);
    try {
      const notes = reviewerNotes[reportId] || "";
      const result = await updateReportStatus(reportId, newStatus, user.id, notes);

      if (result.success) {
        toast.success("Report status updated");
        loadReports(); // Reload to reflect changes
      } else {
        toast.error("Failed to update report", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("Error updating report:", error);
      toast.error("Failed to update report");
    } finally {
      setUpdatingReportId(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "open":
        return "default";
      case "reviewed":
        return "secondary";
      case "dismissed":
        return "outline";
      case "action_taken":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Reports</h1>
            <p className="text-muted-foreground">Review and manage user-submitted reports</p>
          </div>
        </div>

        {reports.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No reports submitted yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <Badge variant={getStatusBadgeVariant(report.status)}>
                          {report.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm font-medium">
                        Reporter: {report.reporter?.email || "Unknown"}
                      </p>
                      <p className="text-sm font-medium">
                        Reported: {report.reported?.email || "Unknown"}
                      </p>
                    </div>
                    {report.conversation_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/messages/${report.conversation_id}`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open conversation
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>Category:</strong> {report.reason_category}
                    </p>
                    {report.reason_details && (
                      <p className="text-sm">
                        <strong>Details:</strong> {report.reason_details}
                      </p>
                    )}
                  </div>

                  {report.status !== "open" && report.reviewed_by && (
                    <div className="pt-4 border-t border-border space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Reviewed by admin on {format(new Date(report.reviewed_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      {report.reviewer_notes && (
                        <p className="text-sm">
                          <strong>Notes:</strong> {report.reviewer_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {report.status === "open" && (
                    <div className="pt-4 border-t border-border space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`notes-${report.id}`}>Reviewer Notes (optional)</Label>
                        <Textarea
                          id={`notes-${report.id}`}
                          value={reviewerNotes[report.id] || ""}
                          onChange={(e) =>
                            setReviewerNotes((prev) => ({ ...prev, [report.id]: e.target.value }))
                          }
                          placeholder="Add notes about your review..."
                          rows={2}
                        />
                      </div>

                      <div className="flex gap-3">
                        <Select
                          onValueChange={(value) => handleUpdateStatus(report.id, value)}
                          disabled={updatingReportId === report.id}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Update status..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reviewed">Mark as Reviewed</SelectItem>
                            <SelectItem value="dismissed">Dismiss</SelectItem>
                            <SelectItem value="action_taken">Action Taken</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
