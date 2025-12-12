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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPendingChangeRequestsForVendor } from "@/lib/workingTerms";
import { canPostReview } from "@/lib/reviews";
import RequestCoverageDialog from "@/components/RequestCoverageDialog";

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
  onWorkingTermsSaved?: () => void;
}

type SortKey = "name" | "connectedAt" | "communityScore" | "workingTermsStatus";
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
  onWorkingTermsSaved,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [communityScoreFilter, setCommunityScoreFilter] = useState<string>("all");
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

  const getWorkingTermsStatusLabel = (repUserId: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; hasAction?: boolean } => {
    const status = workingTermsCache[repUserId];
    const pendingChanges = pendingChangesCache[repUserId] || 0;
    
    if (!status) {
      return { label: "No terms", variant: "outline" };
    }
    
    if (status.status === "active" && pendingChanges > 0) {
      return { label: "Changes requested", variant: "secondary", hasAction: true };
    }
    
    switch (status.status) {
      case "pending_rep":
        return { label: "Request sent", variant: "outline" };
      case "pending_vendor":
        return { label: "Review terms", variant: "secondary", hasAction: true };
      case "pending_rep_confirm":
        return { label: "Awaiting confirmation", variant: "outline" };
      case "active":
        return { label: "Active", variant: "default" };
      case "declined":
        return { label: "Declined", variant: "destructive" };
      default:
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
    
    // Community score filter
    if (communityScoreFilter !== "all") {
      const minScore = parseInt(communityScoreFilter);
      result = result.filter(rep => (rep.communityScore ?? 0) >= minScore);
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
        case "communityScore":
          comparison = (a.communityScore ?? 0) - (b.communityScore ?? 0);
          break;
        case "workingTermsStatus":
          const aStatus = workingTermsCache[a.repUserId]?.status || "";
          const bStatus = workingTermsCache[b.repUserId]?.status || "";
          comparison = aStatus.localeCompare(bStatus);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return result;
  }, [reps, searchQuery, statusFilter, communityScoreFilter, sortKey, sortDirection, workingTermsCache, pendingChangesCache]);

  const handleRequestTerms = (rep: ConnectedRep) => {
    setRequestDialogRep(rep);
    setShowRequestDialog(true);
  };

  const handleViewWorkingTerms = (repUserId: string) => {
    const status = workingTermsCache[repUserId];
    if (status?.id) {
      navigate(`/vendor/working-terms-review/${status.id}`);
    }
  };

  const canRequestTerms = (repUserId: string): boolean => {
    const status = workingTermsCache[repUserId]?.status;
    return !status || status === "declined" || status === "active";
  };

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
        <Select value={communityScoreFilter} onValueChange={setCommunityScoreFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Community score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scores</SelectItem>
            <SelectItem value="0">0+</SelectItem>
            <SelectItem value="3">3+</SelectItem>
            <SelectItem value="5">5+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">
                <SortableHeader label="Rep" sortKeyName="name" />
              </TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead className="hidden md:table-cell">
                <SortableHeader label="Connected since" sortKeyName="connectedAt" />
              </TableHead>
              <TableHead>
                <SortableHeader label="Working terms" sortKeyName="workingTermsStatus" />
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <SortableHeader label="Community" sortKeyName="communityScore" />
              </TableHead>
              <TableHead className="w-[80px]">Notes</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedReps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchQuery || statusFilter !== "all" || communityScoreFilter !== "all"
                    ? "No field reps match your filters."
                    : "No connected field reps yet."}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedReps.map((rep) => {
                const statusInfo = getWorkingTermsStatusLabel(rep.repUserId);
                const notesCount = rep.notes?.length || 0;
                const canReview = reviewEligibilityCache[rep.repUserId] ?? true;
                
                return (
                  <TableRow key={rep.repUserId}>
                    {/* Rep Name & Avatar */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => onViewProfile(rep.repUserId)}
                            className="text-primary hover:underline font-medium text-sm flex items-center gap-1"
                          >
                            {rep.anonymousId}
                          </button>
                          {(rep.firstName || rep.lastInitial) && (
                            <p className="text-xs text-muted-foreground truncate">
                              {rep.firstName} {rep.lastInitial}.
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* Location */}
                    <TableCell className="hidden md:table-cell text-sm">
                      {rep.city && rep.state ? `${rep.city}, ${rep.state}` : rep.city || rep.state || "—"}
                    </TableCell>
                    
                    {/* Connected Since */}
                    <TableCell className="hidden md:table-cell text-sm">
                      {rep.connectedAt
                        ? new Date(rep.connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </TableCell>
                    
                    {/* Working Terms Status */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={statusInfo.variant}
                          className={`text-xs ${statusInfo.label === "Active" ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          {statusInfo.label === "Active" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {statusInfo.label === "Request sent" && <Clock className="w-3 h-3 mr-1" />}
                          {statusInfo.label === "Changes requested" && <AlertCircle className="w-3 h-3 mr-1" />}
                          {statusInfo.label}
                        </Badge>
                        {statusInfo.hasAction && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => handleViewWorkingTerms(rep.repUserId)}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Community Score */}
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {(rep.communityScore ?? 0) >= 0 ? `+${rep.communityScore ?? 0}` : rep.communityScore}
                      </Badge>
                    </TableCell>
                    
                    {/* Notes Icon */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
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
                    
                    {/* Actions */}
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
    </div>
  );
};

export default MyRepsTable;
