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
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Check,
  X,
  AlertTriangle,
  FileText,
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
  const [loading, setLoading] = useState(true);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [rows, setRows] = useState<WorkingTermsRow[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<string, WorkingTermsChangeRequest>>(new Map());
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  // Request change form state (for rep)
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const [changeMessage, setChangeMessage] = useState("");
  const [submittingChange, setSubmittingChange] = useState(false);

  // Decline dialog state
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineChangeId, setDeclineChangeId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [processingChangeAction, setProcessingChangeAction] = useState(false);

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
        setPendingChanges(new Map());
        setLoading(false);
        return;
      }

      setRequestId(request.id);

      // Fetch rows
      const { data: rowsData } = await supabase
        .from("working_terms_rows")
        .select("*")
        .eq("working_terms_request_id", request.id)
        .eq("status", "active")
        .order("state_code")
        .order("county_name")
        .order("inspection_type");

      setRows((rowsData || []) as WorkingTermsRow[]);

      // Expand all states by default
      const states = new Set((rowsData || []).map((r: any) => r.state_code));
      setExpandedStates(states);

      // Fetch pending change requests
      const rowIds = (rowsData || []).map((r: any) => r.id);
      if (rowIds.length > 0) {
        const { data: changes } = await supabase
          .from("working_terms_change_requests")
          .select("*")
          .in("working_terms_row_id", rowIds)
          .eq("status", "pending");

        const changesMap = new Map<string, WorkingTermsChangeRequest>();
        (changes || []).forEach((c: any) => {
          changesMap.set(c.working_terms_row_id, c as WorkingTermsChangeRequest);
        });
        setPendingChanges(changesMap);
      } else {
        setPendingChanges(new Map());
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

  // Pending changes awaiting vendor action
  const pendingChangesForVendor = useMemo(() => {
    return Array.from(pendingChanges.values()).filter(
      (c) => c.requested_by_role === "rep"
    );
  }, [pendingChanges]);

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
      repId,
      "rep",
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
        description: "Your rate change request has been submitted.",
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
    setProcessingChangeAction(true);
    const { error } = await acceptWorkingTermsChange(changeId, vendorId);
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Change approved",
        description: "The rate change has been approved.",
      });
      loadWorkingTerms();
      onTermsUpdated?.();
    }
    setProcessingChangeAction(false);
  };

  const handleDeclineChange = async () => {
    if (!declineChangeId) return;
    setProcessingChangeAction(true);
    const { error } = await declineWorkingTermsChange(
      declineChangeId,
      vendorId,
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
              {/* Pending Changes Section (Vendor view) */}
              {mode === "vendor" && pendingChangesForVendor.length > 0 && (
                <Card className="border-amber-500/50 bg-amber-500/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-sm">
                        Pending Rate Change Requests ({pendingChangesForVendor.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pendingChangesForVendor.map((change) => {
                        const row = rows.find((r) => r.id === change.working_terms_row_id);
                        if (!row) return null;
                        return (
                          <div
                            key={change.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-background rounded-md border"
                          >
                            <div className="text-sm">
                              <span className="font-medium">
                                {row.state_code}
                                {row.county_name ? ` – ${row.county_name}` : ""}
                              </span>
                              <span className="text-muted-foreground mx-2">·</span>
                              <span>{getInspectionTypeLabel(row.inspection_type)}</span>
                              <div className="mt-1">
                                <span className="text-muted-foreground">
                                  {formatRate(change.old_rate)} → 
                                </span>
                                <span className="font-medium text-primary ml-1">
                                  {formatRate(change.new_rate)}
                                </span>
                                {change.reason && (
                                  <span className="text-muted-foreground ml-2">
                                    "{change.reason}"
                                  </span>
                                )}
                              </div>
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
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Terms Table grouped by state */}
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
                            {mode === "rep" && <TableHead className="w-[100px]">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map((row) => {
                            const hasPendingChange = pendingChanges.has(row.id);
                            const pendingChange = pendingChanges.get(row.id);
                            const isEditing = editingRowId === row.id;

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
                                {mode === "rep" && (
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
                                        Pending
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
                                        Request
                                      </Button>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
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
