import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Eye, 
  MessageSquare, 
  User, 
  StickyNote, 
  Edit2, 
  X, 
  Check, 
  ChevronDown,
  ChevronUp,
  Star,
  FileText,
  Send,
  Clock,
  CheckCircle2,
  Info,
  AlertCircle
} from "lucide-react";
import RequestCoverageDialog from "@/components/RequestCoverageDialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { fetchPendingChangeRequestsForVendor, WorkingTermsChangeRequest } from "@/lib/workingTerms";
import { canPostReview } from "@/lib/reviews";

interface RepNote {
  id: string;
  note: string;
  created_at: string;
}

interface WorkingTermsStatus {
  id: string;
  status: string;
  created_at: string;
}

interface PendingChangeInfo {
  count: number;
  requestId: string;
}

interface RepConnectionCardProps {
  rep: {
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
  };
  vendorId: string;
  hasNotes: boolean;
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onAddNote: () => void;
  editingNoteId: string | null;
  editedNoteText: string;
  onEditNote: (noteId: string, currentText: string) => void;
  onCancelEdit: () => void;
  onSaveEditedNote: (noteId: string) => void;
  onEditedNoteTextChange: (value: string) => void;
  onViewProfile: () => void;
  onReviewRep: () => void;
  onViewMessages: () => void;
  onDisconnect: () => void;
  onViewTrustScore: () => void;
  onWorkingTermsSaved?: () => void;
}

const RepConnectionCard: React.FC<RepConnectionCardProps> = ({
  rep,
  vendorId,
  hasNotes,
  noteDraft,
  onNoteDraftChange,
  onAddNote,
  editingNoteId,
  editedNoteText,
  onEditNote,
  onCancelEdit,
  onSaveEditedNote,
  onEditedNoteTextChange,
  onViewProfile,
  onReviewRep,
  onViewMessages,
  onDisconnect,
  onViewTrustScore,
  onWorkingTermsSaved,
}) => {
  const navigate = useNavigate();
  const [notesOpen, setNotesOpen] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [workingTermsStatus, setWorkingTermsStatus] = useState<WorkingTermsStatus | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChangeInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [canReview, setCanReview] = useState(true);
  const [reviewDaysRemaining, setReviewDaysRemaining] = useState<number | null>(null);
  const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);
  const notesCount = rep.notes?.length || 0;

  // Load working terms status and pending changes
  useEffect(() => {
    loadWorkingTermsStatus();
    checkReviewEligibility();
  }, [vendorId, rep.repUserId]);

  const checkReviewEligibility = async () => {
    const result = await canPostReview(vendorId, rep.repUserId);
    setCanReview(result.canPost);
    setReviewDaysRemaining(result.daysRemaining);
    setNextReviewDate(result.nextReviewDate);
  };

  const loadWorkingTermsStatus = async () => {
    setLoadingStatus(true);
    try {
      // Get most recent working terms request
      const { data } = await supabase
        .from("working_terms_requests")
        .select("id, status, created_at")
        .eq("vendor_id", vendorId)
        .eq("rep_id", rep.repUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setWorkingTermsStatus(data);

      // If active, check for pending change requests
      if (data?.status === "active") {
        const changes = await fetchPendingChangeRequestsForVendor(vendorId, rep.repUserId);
        if (changes.length > 0) {
          setPendingChanges({ count: changes.length, requestId: data.id });
        } else {
          setPendingChanges(null);
        }
      } else {
        setPendingChanges(null);
      }
    } catch (error) {
      console.error("Error loading working terms status:", error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleRequestSent = () => {
    loadWorkingTermsStatus();
    onWorkingTermsSaved?.();
  };

  const getStatusDisplay = () => {
    if (!workingTermsStatus) return null;

    switch (workingTermsStatus.status) {
      case "pending_rep":
        return (
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="w-3 h-3" />
            Request sent
          </Badge>
        );
      case "pending_vendor":
        return (
          <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => navigate(`/vendor/working-terms-review/${workingTermsStatus.id}`)}>
            <FileText className="w-3 h-3" />
            Review terms
          </Badge>
        );
      case "pending_rep_confirm":
        return (
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="w-3 h-3" />
            Awaiting rep confirmation
          </Badge>
        );
      case "active":
        return (
          <Badge variant="default" className="text-xs gap-1 bg-green-600">
            <CheckCircle2 className="w-3 h-3" />
            Working terms active
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive" className="text-xs">
            Declined
          </Badge>
        );
      default:
        return null;
    }
  };

  const canRequestTerms = !workingTermsStatus || 
    workingTermsStatus.status === "declined" || 
    workingTermsStatus.status === "active";

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-4 md:p-6 space-y-4">
          {/* Rep Summary Section */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Left: Rep Info */}
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <button
                    onClick={onViewProfile}
                    className="text-primary hover:underline font-semibold flex items-center gap-1.5 text-sm md:text-base"
                  >
                    {rep.anonymousId}
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <Badge variant="secondary" className="text-xs">Connected</Badge>
                </div>
                {(rep.firstName || rep.lastInitial) && (
                  <p className="text-sm text-muted-foreground">
                    {rep.firstName} {rep.lastInitial}.
                  </p>
                )}
                {(rep.city || rep.state) && (
                  <p className="text-xs text-muted-foreground">
                    {rep.city && rep.state ? `${rep.city}, ${rep.state}` : rep.city || rep.state}
                  </p>
                )}
                {rep.connectedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Connected since {new Date(rep.connectedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Trust Score & Community Score (Desktop) */}
            <div className="hidden md:flex flex-col items-end gap-2">
              <button
                onClick={onViewTrustScore}
                className="flex items-center gap-2 hover:opacity-80 cursor-pointer"
              >
                <div className="text-right">
                  {rep.trustScoreCount && rep.trustScoreCount > 0 ? (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="font-semibold text-foreground">{rep.trustScore?.toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ({rep.trustScoreCount} {rep.trustScoreCount === 1 ? 'review' : 'reviews'})
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-muted-foreground">3.0</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">New</Badge>
                    </>
                  )}
                </div>
              </button>
              <Badge variant="outline" className="text-xs">
                Community: {(rep.communityScore ?? 0) >= 0 ? `+${rep.communityScore ?? 0}` : rep.communityScore}
              </Badge>
            </div>
          </div>

          {/* Trust Score & Community Score (Mobile) */}
          <div className="flex md:hidden items-center gap-3 flex-wrap">
            <button
              onClick={onViewTrustScore}
              className="flex items-center gap-1.5 hover:opacity-80 cursor-pointer"
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-semibold">
                {rep.trustScoreCount && rep.trustScoreCount > 0 
                  ? `${rep.trustScore?.toFixed(1)} (${rep.trustScoreCount})` 
                  : "3.0 (New)"}
              </span>
            </button>
            <Badge variant="outline" className="text-xs">
              Community: {(rep.communityScore ?? 0) >= 0 ? `+${rep.communityScore ?? 0}` : rep.communityScore}
            </Badge>
          </div>

          {/* Actions Grid */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewProfile}
              className="w-full md:w-auto text-xs md:text-sm"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRequestDialog(true)}
              disabled={!canRequestTerms}
              className="w-full md:w-auto text-xs md:text-sm"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {workingTermsStatus?.status === "active" ? "Request New Terms" : "Request Terms"}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onReviewRep}
                      disabled={!canReview}
                      className="w-full md:w-auto text-xs md:text-sm"
                    >
                      <Star className="w-3.5 h-3.5 mr-1.5" />
                      Post Review
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canReview && reviewDaysRemaining && nextReviewDate && (
                  <TooltipContent className="max-w-xs">
                    <p>
                      You can post a new review for this connection every 30 days.{" "}
                      {reviewDaysRemaining > 1 
                        ? `Next review available in ${reviewDaysRemaining} days (on ${nextReviewDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}).`
                        : `Next review available tomorrow (on ${nextReviewDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}).`
                      }
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="default"
              size="sm"
              onClick={onViewMessages}
              className="w-full md:w-auto text-xs md:text-sm"
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Messages
            </Button>
          </div>

          {/* Working Terms Status */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  Working terms (for reference)
                  <Info className="w-3 h-3" />
                </span>
                {!loadingStatus && getStatusDisplay()}
              </div>
              
              {/* Pending rate change notice */}
              {pendingChanges && pendingChanges.count > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-600">
                      {pendingChanges.count === 1 ? "Rate change requested" : `${pendingChanges.count} rate changes requested`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This rep has proposed changes to their working terms. Please review and accept or decline.
                  </p>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => navigate(`/vendor/working-terms-review/${pendingChanges.requestId}`)}
                  >
                    Review changes
                  </Button>
                </div>
              )}
              
              {workingTermsStatus?.status === "active" && !pendingChanges ? (
                <div className="text-sm space-y-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary"
                    onClick={() => navigate(`/vendor/working-terms-review/${workingTermsStatus.id}`)}
                  >
                    View working terms details →
                  </Button>
                  <p className="text-xs text-muted-foreground italic">
                    Informational only — not a contract, guarantee of work, or employment agreement.
                  </p>
                </div>
              ) : workingTermsStatus?.status === "active" && pendingChanges ? (
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground italic">
                    Informational only — not a contract, guarantee of work, or employment agreement.
                  </p>
                </div>
              ) : workingTermsStatus?.status === "pending_vendor" ? (
                <div className="text-sm space-y-2">
                  <p className="text-foreground">
                    This rep has sent their coverage & pricing for your review.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/vendor/working-terms-review/${workingTermsStatus.id}`)}
                  >
                    Review & confirm terms
                  </Button>
                </div>
              ) : workingTermsStatus?.status === "pending_rep" || workingTermsStatus?.status === "pending_rep_confirm" ? (
                <p className="text-sm text-muted-foreground">
                  Waiting for {rep.anonymousId} to respond to your request.
                </p>
              ) : (
                <div className="text-sm space-y-2">
                  <p className="text-muted-foreground">
                    No working terms set. Request coverage & pricing from this rep to establish terms.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRequestDialog(true)}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Request coverage & pricing
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Connection Notes - Collapsible on Mobile, Always visible on Desktop */}
          <div className="border-t border-border pt-4">
            {/* Mobile: Collapsible */}
            <div className="md:hidden">
              <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-9">
                    <span className="flex items-center gap-2 text-sm">
                      <StickyNote className="w-4 h-4" />
                      Connection Notes {notesCount > 0 && `(${notesCount})`}
                    </span>
                    {notesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <NotesContent
                    notes={rep.notes}
                    noteDraft={noteDraft}
                    onNoteDraftChange={onNoteDraftChange}
                    onAddNote={onAddNote}
                    editingNoteId={editingNoteId}
                    editedNoteText={editedNoteText}
                    onEditNote={onEditNote}
                    onCancelEdit={onCancelEdit}
                    onSaveEditedNote={onSaveEditedNote}
                    onEditedNoteTextChange={onEditedNoteTextChange}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Desktop: Always visible */}
            <div className="hidden md:block space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <StickyNote className="w-4 h-4" />
                Connection Notes {notesCount > 0 && `(${notesCount})`}
              </div>
              <NotesContent
                notes={rep.notes}
                noteDraft={noteDraft}
                onNoteDraftChange={onNoteDraftChange}
                onAddNote={onAddNote}
                editingNoteId={editingNoteId}
                editedNoteText={editedNoteText}
                onEditNote={onEditNote}
                onCancelEdit={onCancelEdit}
                onSaveEditedNote={onSaveEditedNote}
                onEditedNoteTextChange={onEditedNoteTextChange}
              />
            </div>
          </div>

          {/* Disconnect Button */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
            >
              Disconnect from {rep.anonymousId}
            </Button>
          </div>
        </CardContent>
      </Card>

      <RequestCoverageDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
        vendorId={vendorId}
        repId={rep.repUserId}
        repName={rep.anonymousId}
        onRequestSent={handleRequestSent}
      />
    </>
  );
};

// Notes Content Sub-component
interface NotesContentProps {
  notes?: RepNote[];
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onAddNote: () => void;
  editingNoteId: string | null;
  editedNoteText: string;
  onEditNote: (noteId: string, currentText: string) => void;
  onCancelEdit: () => void;
  onSaveEditedNote: (noteId: string) => void;
  onEditedNoteTextChange: (value: string) => void;
}

const NotesContent: React.FC<NotesContentProps> = ({
  notes,
  noteDraft,
  onNoteDraftChange,
  onAddNote,
  editingNoteId,
  editedNoteText,
  onEditNote,
  onCancelEdit,
  onSaveEditedNote,
  onEditedNoteTextChange,
}) => {
  return (
    <div className="space-y-3">
      {/* Existing Notes */}
      {notes && notes.length > 0 ? (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {notes.slice(0, 5).map((n) => (
            <div key={n.id} className="space-y-1">
              {editingNoteId === n.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full text-sm rounded-md border border-input bg-background px-3 py-2"
                    rows={2}
                    value={editedNoteText}
                    onChange={(e) => onEditedNoteTextChange(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      onClick={() => onSaveEditedNote(n.id)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={onCancelEdit}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2 bg-muted/30 rounded-md p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {new Date(n.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-foreground">{n.note}</p>
                  </div>
                  <button
                    onClick={() => onEditNote(n.id, n.note)}
                    className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
                    title="Edit note"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No notes yet.</p>
      )}

      {/* Add New Note */}
      <div className="flex gap-2">
        <textarea
          className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-2"
          rows={2}
          placeholder="Add a quick note about this field rep..."
          value={noteDraft}
          onChange={(e) => onNoteDraftChange(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onAddNote}
          disabled={!noteDraft.trim()}
          className="self-end"
        >
          Save
        </Button>
      </div>
    </div>
  );
};

export default RepConnectionCard;
