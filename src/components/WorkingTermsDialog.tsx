import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Check,
  X,
  AlertTriangle,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  WorkingTermsRow,
  WorkingTermsChangeRequest,
  INSPECTION_TYPE_LABELS,
  proposeWorkingTermsChange,
  acceptWorkingTermsChange,
  declineWorkingTermsChange,
} from "@/lib/workingTerms";

interface WorkingTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  repId: string;
  vendorName?: string;
  repName?: string;
  mode: "vendor" | "rep";
  onTermsUpdated?: () => void;
}

interface GroupedRow {
  stateCode: string;
  rows: WorkingTermsRow[];
}

export function WorkingTermsDialog({
  open,
  onOpenChange,
  vendorId,
  repId,
  vendorName,
  repName,
  mode,
  onTermsUpdated,
}: WorkingTermsDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [rows, setRows] = useState<WorkingTermsRow[]>([]);
  const [allChangeRequests, setAllChangeRequests] = useState<WorkingTermsChangeRequest[]>([]);
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"terms" | "incoming" | "outgoing">("terms");

  // Request change form state (for both vendor and rep)
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const [changeMessage, setChangeMessage] = useState("");
  const [submittingChange, setSubmittingChange] = useState(false);

  // Decline dialog state
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineChangeId, setDeclineChangeId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [processingChangeAction, setProcessingChangeAction] = useState(false);

  const currentUserId = user?.id;

  useEffect(() => {
    if (open) {
      loadWorkingTerms();
    }
  }, [open, vendorId, repId]);

  const loadWorkingTerms = async () => {
    setLoading(true);
    try {
      // Find active working_terms_request
      const { data: request } = await supabase
        .from("working_terms_requests")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("rep_id", repId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!request) {
        setRequestId(null);
        setRows([]);
        setAllChangeRequests([]);
        setLoading(false);
        return;
      }

      setRequestId(request.id);

      // Fetch rows (include all statuses to show pending changes)
      const { data: rowsData } = await supabase
        .from("working_terms_rows")
        .select("*")
        .eq("working_terms_request_id", request.id)
        .in("status", ["active", "pending_change_vendor", "pending_change_rep"])
        .order("state_code")
        .order("county_name")
        .order("inspection_type");

      setRows((rowsData || []) as WorkingTermsRow[]);

      // Expand all states by default
      const states = new Set((rowsData || []).map((r: any) => r.state_code));
      setExpandedStates(states);

      // Fetch ALL change requests (pending for actions, others for history context)
      const rowIds = (rowsData || []).map((r: any) => r.id);
      if (rowIds.length > 0) {
        const { data: changes } = await supabase
          .from("working_terms_change_requests")
          .select("*")
          .in("working_terms_row_id", rowIds)
          .order("created_at", { ascending: false });

        setAllChangeRequests((changes || []) as WorkingTermsChangeRequest[]);
      } else {
        setAllChangeRequests([]);
      }
    } catch (error) {
      console.error("Error loading working terms:", error);
      toast({
        title: "Error",
        description: "Failed to load working terms.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  // Group rows by state
  const groupedRows = useMemo<GroupedRow[]>(() => {
    const groups: Record<string, WorkingTermsRow[]> = {};
    rows.forEach((row) => {
      if (!groups[row.state_code]) {
        groups[row.state_code] = [];
      }
      groups[row.state_code].push(row);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stateCode, rows]) => ({ stateCode, rows }));
  }, [rows]);

  // Build a map for quick lookup of pending changes by row id
  const pendingChanges = useMemo(() => {
    const map = new Map<string, WorkingTermsChangeRequest>();
    allChangeRequests
      .filter((c) => c.status === "pending")
      .forEach((c) => map.set(c.working_terms_row_id, c));
    return map;
  }, [allChangeRequests]);

  // Incoming requests: pending changes where I am the NON-initiator (I need to approve/decline)
  const incomingRequests = useMemo(() => {
    return allChangeRequests.filter((c) => {
      if (c.status !== "pending") return false;
      // If I'm vendor, incoming = rep initiated. If I'm rep, incoming = vendor initiated.
      const iAmInitiator = c.requested_by_user_id === currentUserId;
      return !iAmInitiator;
    });
  }, [allChangeRequests, currentUserId]);

  // Outgoing requests: changes I initiated
  const outgoingRequests = useMemo(() => {
    return allChangeRequests.filter((c) => c.requested_by_user_id === currentUserId);
  }, [allChangeRequests, currentUserId]);

  const toggleState = (stateCode: string) => {
    setExpandedStates((prev) => {
      const next = new Set(prev);
      if (next.has(stateCode)) {
        next.delete(stateCode);
      } else {
        next.add(stateCode);
      }
      return next;
    });
  };

  const handleRequestChange = async (rowId: string) => {
    if (!currentUserId) return;
    
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0) {
      toast({
        title: "Invalid rate",
        description: "Please enter a valid rate.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingChange(true);
    const { error } = await proposeWorkingTermsChange(
      rowId,
      currentUserId,
      mode,
      {
        newRate: rate,
        newTurnaround: null,
        effectiveFrom: new Date().toISOString().split("T")[0],
        reason: changeMessage || "Rate change request",
      }
    );

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Change requested",
        description: "Your rate change request has been submitted for approval.",
      });
      setEditingRowId(null);
      setNewRate("");
      setChangeMessage("");
      loadWorkingTerms();
      onTermsUpdated?.();
    }
    setSubmittingChange(false);
  };

  const handleApproveChange = async (changeId: string) => {
    if (!currentUserId) return;
    setProcessingChangeAction(true);
    const { error } = await acceptWorkingTermsChange(changeId, currentUserId);
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Change approved",
        description: "The rate change has been approved and terms updated.",
      });
      loadWorkingTerms();
      onTermsUpdated?.();
    }
    setProcessingChangeAction(false);
  };

  const handleDeclineChange = async () => {
    if (!declineChangeId || !currentUserId) return;
    setProcessingChangeAction(true);
    const { error } = await declineWorkingTermsChange(
      declineChangeId,
      currentUserId,
      declineReason || null
    );
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Change declined",
        description: "The rate change request has been declined.",
      });
      setDeclineDialogOpen(false);
      setDeclineChangeId(null);
      setDeclineReason("");
      loadWorkingTerms();
      onTermsUpdated?.();
    }
    setProcessingChangeAction(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "accepted":
        return <Badge className="text-xs bg-green-600"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case "declined":
        return <Badge variant="destructive" className="text-xs"><X className="h-3 w-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const formatRate = (rate: number | null) => {
    if (rate === null) return "—";
    return `$${rate.toFixed(2)}`;
  };

  const getInspectionTypeLabel = (type: string | null) => {
    if (!type) return "—";
    return INSPECTION_TYPE_LABELS[type] || type;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Working Terms
            </DialogTitle>
            <DialogDescription>
              {vendorName && repName
                ? `${vendorName} ↔ ${repName}`
                : mode === "vendor"
                ? `Working terms with this field rep`
                : `Working terms with this vendor`}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No working terms on file yet</p>
              <p className="text-sm mt-1">
                {mode === "vendor"
                  ? "Request coverage & pricing to establish working terms."
                  : "The vendor hasn't set up working terms yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tabs for Terms / Incoming / Outgoing */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="terms" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Terms
                  </TabsTrigger>
                  <TabsTrigger value="incoming" className="gap-1">
                    <ArrowDownLeft className="h-4 w-4" />
                    Incoming
                    {incomingRequests.length > 0 && (
                      <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                        {incomingRequests.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="outgoing" className="gap-1">
                    <ArrowUpRight className="h-4 w-4" />
                    Outgoing
                    {outgoingRequests.filter(r => r.status === "pending").length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                        {outgoingRequests.filter(r => r.status === "pending").length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Terms Tab */}
                <TabsContent value="terms" className="mt-4">
                  {groupedRows.map((group) => (
                    <Collapsible
                      key={group.stateCode}
                      open={expandedStates.has(group.stateCode)}
                      onOpenChange={() => toggleState(group.stateCode)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-left h-10 px-3 hover:bg-muted/50"
                        >
                          {expandedStates.has(group.stateCode) ? (
                            <ChevronDown className="h-4 w-4 mr-2" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-2" />
                          )}
                          <span className="font-medium">{group.stateCode}</span>
                          <Badge variant="secondary" className="ml-2">
                            {group.rows.length} term{group.rows.length !== 1 ? "s" : ""}
                          </Badge>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border rounded-md mt-1 mb-3 overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="w-[140px]">County</TableHead>
                                <TableHead>Inspection Type</TableHead>
                                <TableHead className="w-[100px]">Rate</TableHead>
                                <TableHead className="w-[120px]">Effective From</TableHead>
                                <TableHead className="w-[100px]">Source</TableHead>
                                <TableHead className="w-[120px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.rows.map((row) => {
                                const hasPendingChange = pendingChanges.has(row.id);
                                const pendingChange = pendingChanges.get(row.id);
                                const isEditing = editingRowId === row.id;
                                const myPendingChange = pendingChange?.requested_by_user_id === currentUserId;

                                return (
                                  <TableRow key={row.id}>
                                    <TableCell className="text-sm">
                                      {row.county_name || "Statewide"}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {getInspectionTypeLabel(row.inspection_type)}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                      {hasPendingChange ? (
                                        <div className="flex flex-col">
                                          <span className="line-through text-muted-foreground text-xs">
                                            {formatRate(row.rate)}
                                          </span>
                                          <span className="text-amber-500">
                                            {formatRate(pendingChange?.new_rate ?? null)}
                                            <span className="text-xs ml-1">(pending)</span>
                                          </span>
                                        </div>
                                      ) : (
                                        formatRate(row.rate)
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {row.effective_from
                                        ? new Date(row.effective_from).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          })
                                        : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {row.source?.replace(/_/g, " ") || "—"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {isEditing ? (
                                        <div className="flex flex-col gap-2">
                                          <div className="flex gap-1">
                                            <Input
                                              type="number"
                                              placeholder="New rate"
                                              value={newRate}
                                              onChange={(e) => setNewRate(e.target.value)}
                                              className="h-8 w-20"
                                            />
                                            <Button
                                              size="sm"
                                              className="h-8"
                                              onClick={() => handleRequestChange(row.id)}
                                              disabled={submittingChange}
                                            >
                                              <Check className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8"
                                              onClick={() => {
                                                setEditingRowId(null);
                                                setNewRate("");
                                                setChangeMessage("");
                                              }}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ) : hasPendingChange ? (
                                        <Badge variant="secondary" className="text-xs">
                                          {myPendingChange ? "Your request" : "Awaiting approval"}
                                        </Badge>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={() => {
                                            setEditingRowId(row.id);
                                            setNewRate(row.rate?.toString() || "");
                                          }}
                                        >
                                          <Edit className="h-3 w-3 mr-1" />
                                          Request change
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </TabsContent>

                {/* Incoming Tab */}
                <TabsContent value="incoming" className="mt-4">
                  {incomingRequests.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <ArrowDownLeft className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No pending change requests to review</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {incomingRequests.map((change) => {
                        const row = rows.find((r) => r.id === change.working_terms_row_id);
                        if (!row) return null;
                        return (
                          <Card key={change.id} className="border-amber-500/50 bg-amber-500/5">
                            <CardContent className="pt-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="text-sm space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {row.state_code}
                                      {row.county_name ? ` – ${row.county_name}` : ""}
                                    </span>
                                    <span className="text-muted-foreground">·</span>
                                    <span>{getInspectionTypeLabel(row.inspection_type)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Rate:</span>
                                    <span className="line-through text-muted-foreground">
                                      {formatRate(change.old_rate)}
                                    </span>
                                    <span>→</span>
                                    <span className="font-semibold text-primary">
                                      {formatRate(change.new_rate)}
                                    </span>
                                  </div>
                                  {change.reason && (
                                    <p className="text-muted-foreground italic">
                                      "{change.reason}"
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Requested by {change.requested_by_role === "rep" ? "Field Rep" : "Vendor"} on{" "}
                                    {new Date(change.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex gap-2 self-end sm:self-center">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveChange(change.id)}
                                    disabled={processingChangeAction}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setDeclineChangeId(change.id);
                                      setDeclineDialogOpen(true);
                                    }}
                                    disabled={processingChangeAction}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Decline
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Outgoing Tab */}
                <TabsContent value="outgoing" className="mt-4">
                  {outgoingRequests.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <ArrowUpRight className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">You haven't submitted any change requests</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {outgoingRequests.map((change) => {
                        const row = rows.find((r) => r.id === change.working_terms_row_id);
                        if (!row) return null;
                        return (
                          <Card key={change.id} className="border-muted">
                            <CardContent className="pt-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="text-sm space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {row.state_code}
                                      {row.county_name ? ` – ${row.county_name}` : ""}
                                    </span>
                                    <span className="text-muted-foreground">·</span>
                                    <span>{getInspectionTypeLabel(row.inspection_type)}</span>
                                    {getStatusBadge(change.status)}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Rate:</span>
                                    <span className="line-through text-muted-foreground">
                                      {formatRate(change.old_rate)}
                                    </span>
                                    <span>→</span>
                                    <span className="font-semibold">
                                      {formatRate(change.new_rate)}
                                    </span>
                                  </div>
                                  {change.reason && (
                                    <p className="text-muted-foreground italic">
                                      "{change.reason}"
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Submitted {new Date(change.created_at).toLocaleDateString()}
                                    {change.responded_at && (
                                      <> · Responded {new Date(change.responded_at).toLocaleDateString()}</>
                                    )}
                                  </p>
                                  {change.decline_reason && (
                                    <p className="text-xs text-destructive">
                                      Decline reason: {change.decline_reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline Change Dialog */}
      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Rate Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this rate change request?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <Textarea
              id="decline-reason"
              placeholder="Provide a reason for declining..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeclineChange}
              disabled={processingChangeAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default WorkingTermsDialog;
