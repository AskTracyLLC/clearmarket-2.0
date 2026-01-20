import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Activity, Eye, Clock, User, FileText, SearchX, RefreshCw, ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format, subDays, subHours } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";

interface AuditLogEntry {
  id: string;
  created_at: string;
  actor_user_id: string;
  target_user_id: string | null;
  action_type: string;
  action_summary: string;
  action_details: Record<string, unknown> | null;
  source_page: string | null;
  actor_role: string | null;
  actor_code: string | null;
  actor?: {
    full_name: string | null;
  } | null;
  target?: {
    full_name: string | null;
  } | null;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  "user.deactivated": "User Deactivated",
  "user.reactivated": "User Reactivated",
  "user.role_updated": "User Role Updated",
  "staff.invited": "Staff Invited",
  "staff.invite_resent": "Staff Invite Resent",
  "staff.role_changed": "Staff Role Changed",
  "user.blocked": "User Blocked",
  "user.unblocked": "User Unblocked",
  "review.hidden": "Review Hidden",
  "review.restored": "Review Restored",
  "report.resolved": "Report Resolved",
  "credits.adjusted": "Credits Adjusted",
  "support.reply_added": "Support Reply Added",
  "vendor_staff.invited": "Vendor Staff Invited",
  "vendor_staff.role_changed": "Vendor Staff Role Changed",
  "vendor_staff.disabled": "Vendor Staff Disabled",
  "vendor_staff.enabled": "Vendor Staff Enabled",
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  "user.deactivated": "bg-red-500/10 text-red-600 border-red-500/20",
  "user.reactivated": "bg-green-500/10 text-green-600 border-green-500/20",
  "staff.invited": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "staff.invite_resent": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "staff.role_changed": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "user.blocked": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "user.unblocked": "bg-green-500/10 text-green-600 border-green-500/20",
  "review.hidden": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "review.restored": "bg-green-500/10 text-green-600 border-green-500/20",
  "report.resolved": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "credits.adjusted": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "support.reply_added": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "vendor_staff.invited": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "vendor_staff.role_changed": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "vendor_staff.disabled": "bg-red-500/10 text-red-600 border-red-500/20",
  "vendor_staff.enabled": "bg-green-500/10 text-green-600 border-green-500/20",
};

export default function AdminAuditLog() {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("7days");
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [profileDialog, setProfileDialog] = useState<{ open: boolean; userId: string | null }>({
    open: false,
    userId: null,
  });
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; entry: AuditLogEntry | null }>({
    open: false,
    entry: null,
  });

  // Permission-based access control
  useEffect(() => {
    if (!permsLoading) {
      if (!permissions.canViewAuditLog) {
        toast.error("Access denied", {
          description: "You don't have permission to view this page.",
        });
        navigate("/dashboard");
      } else {
        setHasAccess(true);
      }
    }
  }, [permsLoading, permissions, navigate]);

  useEffect(() => {
    if (authLoading || permsLoading) return;
    if (!user) {
      navigate("/signin");
      return;
    }
    if (hasAccess) {
      loadLogs();
    }
  }, [user, authLoading, permsLoading, hasAccess, navigate, dateFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("admin_audit_log")
        .select(`
          id,
          created_at,
          actor_user_id,
          target_user_id,
          action_type,
          action_summary,
          action_details,
          source_page,
          actor_role,
          actor_code
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      // Apply date filter
      if (dateFilter !== "all") {
        let fromDate: Date;
        switch (dateFilter) {
          case "24hours":
            fromDate = subHours(new Date(), 24);
            break;
          case "7days":
            fromDate = subDays(new Date(), 7);
            break;
          case "30days":
            fromDate = subDays(new Date(), 30);
            break;
          default:
            fromDate = subDays(new Date(), 7);
        }
        query = query.gte("created_at", fromDate.toISOString());
      }

      const { data: logsData, error } = await query;

      if (error) throw error;

      // Fetch actor and target profiles separately
      const actorIds = [...new Set(logsData?.map(l => l.actor_user_id) || [])];
      const targetIds = [...new Set(logsData?.filter(l => l.target_user_id).map(l => l.target_user_id!) || [])];
      const allUserIds = [...new Set([...actorIds, ...targetIds])];

      let profilesMap: Record<string, { full_name: string | null }> = {};

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", allUserIds);

        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = { full_name: p.full_name };
          });
        }
      }

      // Enrich logs with profile data
      const enrichedLogs: AuditLogEntry[] = (logsData || []).map(log => ({
        ...log,
        action_details: log.action_details as Record<string, unknown> | null,
        actor_role: log.actor_role ?? null,
        actor_code: log.actor_code ?? null,
        actor: profilesMap[log.actor_user_id] || null,
        target: log.target_user_id ? profilesMap[log.target_user_id] || null : null,
      }));

      setLogs(enrichedLogs);
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Action type filter
      if (actionTypeFilter !== "all" && log.action_type !== actionTypeFilter) {
        return false;
      }

      // Search filter
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        log.action_summary.toLowerCase().includes(term) ||
        log.actor?.email?.toLowerCase().includes(term) ||
        log.actor?.full_name?.toLowerCase().includes(term) ||
        log.target?.email?.toLowerCase().includes(term) ||
        log.target?.full_name?.toLowerCase().includes(term) ||
        log.action_type.toLowerCase().includes(term) ||
        log.actor_code?.toLowerCase().includes(term) ||
        log.actor_role?.toLowerCase().includes(term)
      );
    });
  }, [logs, searchTerm, actionTypeFilter]);

  const uniqueActionTypes = useMemo(() => {
    return [...new Set(logs.map(l => l.action_type))];
  }, [logs]);

  const getActionLabel = (actionType: string) => {
    return ACTION_TYPE_LABELS[actionType] || actionType;
  };

  const getActionBadgeClass = (actionType: string) => {
    return ACTION_TYPE_COLORS[actionType] || "bg-muted text-muted-foreground border-border";
  };

  const formatUserDisplay = (profile: { full_name: string | null; email: string } | null | undefined) => {
    if (!profile) return "Unknown";
    return profile.full_name || profile.email;
  };

  if (authLoading || permsLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  return (
    <>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Admin Activity Log</h1>
            <p className="text-muted-foreground">Track important admin and staff actions</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/abuse-flags">
              <Button variant="outline" size="sm">
                <ShieldAlert className="h-4 w-4 mr-2" />
                Abuse Detection
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by summary, actor, or target..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[160px]">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24hours">Last 24 hours</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Activity className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Action type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActionTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {getActionLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <CardDescription>
              {filteredLogs.length} entr{filteredLogs.length !== 1 ? "ies" : "y"} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead className="w-[150px]">Action</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="w-[100px]">Source</TableHead>
                    <TableHead className="text-right w-[80px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48">
                        <div className="flex flex-col items-center justify-center text-center py-8">
                          {logs.length === 0 ? (
                            <>
                              <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
                              <p className="font-medium text-foreground">No activity recorded yet</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Admin actions will appear here as they occur.
                              </p>
                            </>
                          ) : (
                            <>
                              <SearchX className="h-10 w-10 text-muted-foreground/50 mb-3" />
                              <p className="font-medium text-foreground">No entries match your filters</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Try adjusting your search or filters.
                              </p>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {log.actor_code ? (
                              <button
                                onClick={() => setProfileDialog({ open: true, userId: log.actor_user_id })}
                                className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                {log.actor_code}
                              </button>
                            ) : (
                              <button
                                onClick={() => setProfileDialog({ open: true, userId: log.actor_user_id })}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {formatUserDisplay(log.actor)}
                              </button>
                            )}
                            {log.actor_role && (
                              <span className="text-xs text-muted-foreground">
                                {log.actor_role.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getActionBadgeClass(log.action_type)}>
                            {getActionLabel(log.action_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          {log.action_summary}
                        </TableCell>
                        <TableCell>
                          {log.target_user_id ? (
                            <button
                              onClick={() => setProfileDialog({ open: true, userId: log.target_user_id! })}
                              className="text-sm text-primary hover:underline"
                            >
                              {formatUserDisplay(log.target)}
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.source_page || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.action_details && Object.keys(log.action_details).length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailsDialog({ open: true, entry: log })}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Public Profile Dialog */}
      <PublicProfileDialog
        open={profileDialog.open}
        onOpenChange={(open) => setProfileDialog({ open, userId: open ? profileDialog.userId : null })}
        targetUserId={profileDialog.userId || ""}
      />

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => setDetailsDialog({ open, entry: open ? detailsDialog.entry : null })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Action Details</DialogTitle>
          </DialogHeader>
          {detailsDialog.entry && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getActionBadgeClass(detailsDialog.entry.action_type)}>
                  {getActionLabel(detailsDialog.entry.action_type)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(detailsDialog.entry.created_at), "PPpp")}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Summary</p>
                <p className="text-sm text-muted-foreground">{detailsDialog.entry.action_summary}</p>
              </div>
              {/* Actor Attribution */}
              <div>
                <p className="text-sm font-medium mb-2">Actor</p>
                <div className="bg-muted rounded-md p-3 space-y-2">
                  {detailsDialog.entry.actor_code && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Code:</span>
                      <span className="font-semibold">{detailsDialog.entry.actor_code}</span>
                    </div>
                  )}
                  {detailsDialog.entry.actor_role && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Role:</span>
                      <Badge variant="secondary" className="text-xs">
                        {detailsDialog.entry.actor_role.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">User ID:</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {detailsDialog.entry.actor_user_id}
                    </span>
                  </div>
                  {detailsDialog.entry.actor && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Name/Email:</span>
                      <span className="text-xs">
                        {formatUserDisplay(detailsDialog.entry.actor)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {detailsDialog.entry.action_details && Object.keys(detailsDialog.entry.action_details).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Additional Details</p>
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    {Object.entries(detailsDialog.entry.action_details).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
                        <span className="font-mono text-xs">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
