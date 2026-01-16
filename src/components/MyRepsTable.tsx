import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  MoreVertical,
  MessageSquare,
  Send,
  Star,
  Unlink,
  ArrowUpDown,
  Search,
  StickyNote,
  FileText,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPendingChangeRequestsForVendor } from "@/lib/workingTerms";
import { canPostReview } from "@/lib/reviews";
import RequestCoverageDialog from "@/components/RequestCoverageDialog";
import { AssignChecklistDialog } from "@/components/AssignChecklistDialog";
import { ColumnChooser } from "@/components/ColumnChooser";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/useColumnVisibility";
import { WorkingTermsDialog } from "@/components/WorkingTermsDialog";
import { MarkDoNotUseDialog } from "@/components/MarkDoNotUseDialog";

// Column definitions for My Field Reps table
const MY_REPS_COLUMNS: ColumnDefinition[] = [
  { id: "rep", label: "Rep", description: "Field rep name and identifier", required: true },
  { id: "location", label: "Location", description: "City and state" },
  { id: "trustScore", label: "Trust Score", description: "Rating based on verified reviews" },
  { id: "connectedSince", label: "Connected since", description: "Date you connected with this rep" },
  { id: "agreement", label: "Agreement", description: "Current agreement status" },
  { id: "notes", label: "Notes", description: "Your private notes about this rep" },
  { id: "actions", label: "Actions", description: "Available actions", required: true },
];

const DEFAULT_VISIBLE_COLUMNS = ["rep", "location", "trustScore", "connectedSince", "agreement", "notes", "actions"];

interface RepNote {
  id: string;
  note: string;
  created_at: string;
}

interface ConnectedRep {
  repUserId: string;
  anonymousId: string;
  firstName: string;
  lastInitial: string;
  displayName?: string | null;
  city: string | null;
  state: string | null;
  connectedAt?: string | null;
  agreementId?: string | null;
  coverageSummary?: string | null;
  pricingSummary?: string | null;
  statesCovered?: string[] | null;
  trustScore?: number | null;
  trustScoreCount?: number;
  communityScore?: number;
  notes?: RepNote[];
  review?: any;
  conversationId?: string;
}

interface WorkingTermsStatusData {
  id: string;
  status: string;
  created_at: string;
}

interface MyRepsTableProps {
  reps: ConnectedRep[];
  vendorId: string;
  onViewProfile: (repUserId: string) => void;
  onViewMessages: (repUserId: string, conversationId?: string) => void;
  onReviewRep: (rep: ConnectedRep) => void;
  onDisconnect: (repUserId: string) => void;
  onViewTrustScore: (repUserId: string) => void;
  onOpenNotes: (rep: ConnectedRep) => void;
  onOpenRepNotes?: (rep: ConnectedRep) => void;
  onWorkingTermsSaved?: () => void;
  onDoNotUseChanged?: () => void;
}

type SortKey = "name" | "connectedAt" | "agreementStatus";
type SortDirection = "asc" | "desc";

export const MyRepsTable: React.FC<MyRepsTableProps> = ({
  reps,
  vendorId,
  onViewProfile,
  onViewMessages,
  onReviewRep,
  onDisconnect,
  onViewTrustScore,
  onOpenNotes,
  onOpenRepNotes,
  onWorkingTermsSaved,
  onDoNotUseChanged,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("connectedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Working terms status cache
  const [workingTermsCache, setWorkingTermsCache] = useState<Record<string, WorkingTermsStatusData | null>>({});
  const [pendingChangesCache, setPendingChangesCache] = useState<Record<string, number>>({});
  const [reviewEligibilityCache, setReviewEligibilityCache] = useState<Record<string, boolean>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  
  // Request dialog state
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestDialogRep, setRequestDialogRep] = useState<ConnectedRep | null>(null);
  
  // Checklist assignment dialog state
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [checklistDialogRep, setChecklistDialogRep] = useState<ConnectedRep | null>(null);

  // Working Terms Dialog state
  const [showWorkingTermsDialog, setShowWorkingTermsDialog] = useState(false);
  const [workingTermsDialogRep, setWorkingTermsDialogRep] = useState<ConnectedRep | null>(null);

  // Mark Do Not Use Dialog state
  const [showDnuDialog, setShowDnuDialog] = useState(false);
  const [dnuDialogRep, setDnuDialogRep] = useState<ConnectedRep | null>(null);

  // Load working terms statuses for all reps
  useEffect(() => {
    const loadStatuses = async () => {
      setLoadingStatuses(true);
      const statusMap: Record<string, WorkingTermsStatusData | null> = {};
      const changesMap: Record<string, number> = {};
      const reviewMap: Record<string, boolean> = {};
      
      await Promise.all(reps.map(async (rep) => {
        // Get working terms status
        const { data } = await supabase
          .from("working_terms_requests")
          .select("id, status, created_at")
          .eq("vendor_id", vendorId)
          .eq("rep_id", rep.repUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        statusMap[rep.repUserId] = data;
        
        // Check for pending changes
        if (data?.status === "active") {
          const changes = await fetchPendingChangeRequestsForVendor(vendorId, rep.repUserId);
          changesMap[rep.repUserId] = changes.length;
        }
        
        // Check review eligibility
        const reviewResult = await canPostReview(vendorId, rep.repUserId);
        reviewMap[rep.repUserId] = reviewResult.canPost;
      }));
      
      setWorkingTermsCache(statusMap);
      setPendingChangesCache(changesMap);
      setReviewEligibilityCache(reviewMap);
      setLoadingStatuses(false);
    };
    
    if (reps.length > 0) {
      loadStatuses();
    }
  }, [reps, vendorId]);

  const getWorkingTermsStatusLabel = (rep: ConnectedRep): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; hasAction?: boolean; pricingDisplay?: string } => {
    const status = workingTermsCache[rep.repUserId];
    const pendingChanges = pendingChangesCache[rep.repUserId] || 0;
    
    // Check if we have agreement data from vendor_rep_agreements (via territory assignment)
    const hasAgreementTerms = !!(
      rep.pricingSummary || 
      (rep.agreementId && rep.coverageSummary)
    );
    
    // Build pricing display from pricingSummary or fallback to base_rate
    let pricingDisplay: string | undefined;
    if (rep.pricingSummary) {
      pricingDisplay = rep.pricingSummary;
    }
    
    // If no working_terms_requests status but has agreement data, show as "On file"
    if (!status) {
      if (hasAgreementTerms) {
        return { label: "On file", variant: "default", pricingDisplay };
      }
      return { label: "No terms", variant: "outline" };
    }
    
    if (status.status === "active" && pendingChanges > 0) {
      return { label: "Changes requested", variant: "secondary", hasAction: true, pricingDisplay };
    }
    
    switch (status.status) {
      case "pending_rep":
        return { label: "Request sent", variant: "outline" };
      case "pending_vendor":
        return { label: "Review terms", variant: "secondary", hasAction: true };
      case "pending_rep_confirm":
        return { label: "Awaiting confirmation", variant: "outline" };
      case "active":
        return { label: "Active", variant: "default", pricingDisplay };
      case "declined":
        // Even if declined in working_terms, if agreement exists show it
        if (hasAgreementTerms) {
          return { label: "On file", variant: "default", pricingDisplay };
        }
        return { label: "Declined", variant: "destructive" };
      default:
        if (hasAgreementTerms) {
          return { label: "On file", variant: "default", pricingDisplay };
        }
        return { label: "No terms", variant: "outline" };
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedReps = useMemo(() => {
    let result = [...reps];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(rep =>
        rep.anonymousId.toLowerCase().includes(query) ||
        (rep.city && rep.city.toLowerCase().includes(query)) ||
        (rep.state && rep.state.toLowerCase().includes(query)) ||
        `${rep.firstName} ${rep.lastInitial}`.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(rep => {
        const status = workingTermsCache[rep.repUserId]?.status;
        const pendingChanges = pendingChangesCache[rep.repUserId] || 0;
        
        switch (statusFilter) {
          case "active":
            return status === "active" && pendingChanges === 0;
          case "changes_requested":
            return status === "active" && pendingChanges > 0;
          case "pending":
            return status === "pending_rep" || status === "pending_vendor" || status === "pending_rep_confirm";
          case "no_terms":
            return !status || status === "declined";
          default:
            return true;
        }
      });
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortKey) {
        case "name":
          comparison = a.anonymousId.localeCompare(b.anonymousId);
          break;
        case "connectedAt":
          const aDate = a.connectedAt ? new Date(a.connectedAt).getTime() : 0;
          const bDate = b.connectedAt ? new Date(b.connectedAt).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case "agreementStatus":
          const aStatus = workingTermsCache[a.repUserId]?.status || "";
          const bStatus = workingTermsCache[b.repUserId]?.status || "";
          comparison = aStatus.localeCompare(bStatus);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return result;
  }, [reps, searchQuery, statusFilter, sortKey, sortDirection, workingTermsCache, pendingChangesCache]);

  const handleRequestTerms = (rep: ConnectedRep) => {
    setRequestDialogRep(rep);
    setShowRequestDialog(true);
  };

  const handleAssignChecklist = (rep: ConnectedRep) => {
    setChecklistDialogRep(rep);
    setShowChecklistDialog(true);
  };

  const handleViewWorkingTerms = (repUserId: string) => {
    const status = workingTermsCache[repUserId];
    if (status?.id) {
      navigate(`/vendor/working-terms-review/${status.id}`);
    }
  };

  const handleOpenWorkingTermsDialog = (rep: ConnectedRep) => {
    setWorkingTermsDialogRep(rep);
    setShowWorkingTermsDialog(true);
  };

  const canRequestTerms = (repUserId: string): boolean => {
    const status = workingTermsCache[repUserId]?.status;
    return !status || status === "declined" || status === "active";
  };

  // Column visibility
  const {
    visibleColumns,
    isColumnVisible,
    savePreferences,
    resetToDefaults,
    isSaving,
    isLoading: colLoading,
  } = useColumnVisibility({
    tableKey: "vendor_my_field_reps",
    columns: MY_REPS_COLUMNS,
    defaultVisibleColumns: DEFAULT_VISIBLE_COLUMNS,
  });

  const SortableHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => handleSort(sortKeyName)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Working terms status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="changes_requested">Changes requested</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="no_terms">No terms</SelectItem>
          </SelectContent>
        </Select>
        <ColumnChooser
          columns={MY_REPS_COLUMNS}
          visibleColumns={visibleColumns}
          onSave={savePreferences}
          onReset={resetToDefaults}
          isSaving={isSaving}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {isColumnVisible("rep") && (
                <TableHead className="w-[200px]">
                  <SortableHeader label="Rep" sortKeyName="name" />
                </TableHead>
              )}
              {isColumnVisible("location") && (
                <TableHead className="hidden md:table-cell">Location</TableHead>
              )}
              {isColumnVisible("trustScore") && (
                <TableHead>Trust Score</TableHead>
              )}
              {isColumnVisible("connectedSince") && (
                <TableHead className="hidden md:table-cell">
                  <SortableHeader label="Connected since" sortKeyName="connectedAt" />
                </TableHead>
              )}
              {isColumnVisible("agreement") && (
                <TableHead>
                  <SortableHeader label="Agreement" sortKeyName="agreementStatus" />
                </TableHead>
              )}
              {isColumnVisible("notes") && (
                <TableHead className="w-[80px]">Notes</TableHead>
              )}
              {isColumnVisible("actions") && (
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedReps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "No field reps match your filters."
                    : "No connected field reps yet."}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedReps.map((rep) => {
                const statusInfo = getWorkingTermsStatusLabel(rep);
                const notesCount = rep.notes?.length || 0;
                const canReview = reviewEligibilityCache[rep.repUserId] ?? true;
                
                return (
                  <TableRow key={rep.repUserId}>
                    {/* Rep Name & Avatar */}
                    {isColumnVisible("rep") && (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            {rep.displayName ? (
                              <>
                                <button
                                  onClick={() => onViewProfile(rep.repUserId)}
                                  className="text-foreground hover:text-primary font-medium text-sm hover:underline"
                                >
                                  {rep.displayName}
                                </button>
                                <p className="text-xs text-muted-foreground">
                                  {rep.anonymousId}
                                </p>
                              </>
                            ) : (
                              <button
                                onClick={() => onViewProfile(rep.repUserId)}
                                className="text-primary hover:underline font-medium text-sm"
                              >
                                {rep.anonymousId}
                              </button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    
                    {/* Location */}
                    {isColumnVisible("location") && (
                      <TableCell className="hidden md:table-cell text-sm">
                        {rep.city && rep.state ? `${rep.city}, ${rep.state}` : rep.city || rep.state || "—"}
                      </TableCell>
                    )}
                    
                    {/* Trust Score */}
                    {isColumnVisible("trustScore") && (
                      <TableCell>
                        {rep.trustScore != null && rep.trustScore > 0 ? (
                          <span className={`font-medium ${rep.trustScore >= 4.5 ? "text-green-500" : rep.trustScore >= 4.0 ? "text-blue-500" : rep.trustScore >= 3.0 ? "text-yellow-500" : "text-muted-foreground"}`}>
                            {rep.trustScore.toFixed(1)}
                            {rep.trustScoreCount != null && rep.trustScoreCount > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({rep.trustScoreCount})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    
                    {/* Connected Since */}
                    {isColumnVisible("connectedSince") && (
                      <TableCell className="hidden md:table-cell text-sm">
                        {rep.connectedAt
                          ? new Date(rep.connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </TableCell>
                    )}
                    
                    {/* Agreement Status */}
                    {isColumnVisible("agreement") && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenWorkingTermsDialog(rep)}
                            className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                          >
                            <Badge 
                              variant={statusInfo.variant}
                              className={`text-xs cursor-pointer transition-opacity hover:opacity-80 ${statusInfo.label === "Active" || statusInfo.label === "On file" ? "bg-green-600 hover:bg-green-700" : ""}`}
                            >
                              {(statusInfo.label === "Active" || statusInfo.label === "On file") && <CheckCircle2 className="w-3 h-3 mr-1" />}
                              {statusInfo.label === "Request sent" && <Clock className="w-3 h-3 mr-1" />}
                              {statusInfo.label === "Changes requested" && <AlertCircle className="w-3 h-3 mr-1" />}
                              {statusInfo.label}
                            </Badge>
                          </button>
                          {statusInfo.pricingDisplay && (
                            <span className="text-xs text-muted-foreground">{statusInfo.pricingDisplay}</span>
                          )}
                          {statusInfo.hasAction && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => handleViewWorkingTerms(rep.repUserId)}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                    
                    {/* Notes Icon */}
                    {isColumnVisible("notes") && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 relative"
                          onClick={() => onOpenNotes(rep)}
                        >
                          <StickyNote className="h-4 w-4" />
                          {notesCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                              {notesCount}
                            </span>
                          )}
                        </Button>
                      </TableCell>
                    )}
                    
                    {/* Actions */}
                    {isColumnVisible("actions") && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => onViewMessages(rep.repUserId, rep.conversationId)}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onViewProfile(rep.repUserId)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onViewMessages(rep.repUserId, rep.conversationId)}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Open Messages
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleRequestTerms(rep)}
                                disabled={!canRequestTerms(rep.repUserId)}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                {workingTermsCache[rep.repUserId]?.status === "active" ? "Request New Terms" : "Request Terms"}
                              </DropdownMenuItem>
                              {workingTermsCache[rep.repUserId]?.status === "active" && (
                                <DropdownMenuItem onClick={() => handleViewWorkingTerms(rep.repUserId)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Working Terms
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => onReviewRep(rep)}
                                disabled={!canReview}
                              >
                                <Star className="mr-2 h-4 w-4" />
                                Post Review
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAssignChecklist(rep)}>
                                <ClipboardList className="mr-2 h-4 w-4" />
                                Assign Checklist
                              </DropdownMenuItem>
                              {onOpenRepNotes && (
                                <DropdownMenuItem onClick={() => onOpenRepNotes(rep)}>
                                  <StickyNote className="mr-2 h-4 w-4" />
                                  Rep Notes
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => onDisconnect(rep.repUserId)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Unlink className="mr-2 h-4 w-4" />
                                Disconnect
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Request Coverage Dialog */}
      {requestDialogRep && (
        <RequestCoverageDialog
          open={showRequestDialog}
          onOpenChange={setShowRequestDialog}
          vendorId={vendorId}
          repId={requestDialogRep.repUserId}
          repName={requestDialogRep.anonymousId}
          onRequestSent={() => {
            setShowRequestDialog(false);
            setRequestDialogRep(null);
            onWorkingTermsSaved?.();
          }}
        />
      )}

      {/* Assign Checklist Dialog */}
      {checklistDialogRep && (
        <AssignChecklistDialog
          open={showChecklistDialog}
          onOpenChange={setShowChecklistDialog}
          repUserId={checklistDialogRep.repUserId}
          repName={checklistDialogRep.anonymousId}
          onAssigned={() => {
            setShowChecklistDialog(false);
            setChecklistDialogRep(null);
          }}
        />
      )}

      {/* Working Terms Dialog */}
      {workingTermsDialogRep && (
        <WorkingTermsDialog
          open={showWorkingTermsDialog}
          onOpenChange={(open) => {
            setShowWorkingTermsDialog(open);
            if (!open) setWorkingTermsDialogRep(null);
          }}
          vendorId={vendorId}
          repId={workingTermsDialogRep.repUserId}
          repName={workingTermsDialogRep.anonymousId}
          mode="vendor"
          onTermsUpdated={() => {
            onWorkingTermsSaved?.();
          }}
        />
      )}

      {/* Mark Do Not Use Dialog */}
      {dnuDialogRep && (
        <MarkDoNotUseDialog
          open={showDnuDialog}
          onOpenChange={(open) => {
            setShowDnuDialog(open);
            if (!open) setDnuDialogRep(null);
          }}
          vendorId={vendorId}
          repUserId={dnuDialogRep.repUserId}
          repName={dnuDialogRep.displayName || dnuDialogRep.anonymousId}
          onMarked={() => {
            setShowDnuDialog(false);
            setDnuDialogRep(null);
            onDoNotUseChanged?.();
          }}
        />
      )}
    </div>
  );
};

export default MyRepsTable;
