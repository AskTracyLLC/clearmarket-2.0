import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Eye, 
  MessageSquare, 
  Building2, 
  StickyNote, 
  Edit2, 
  X, 
  Check, 
  Calendar, 
  ChevronDown,
  ChevronUp,
  Star
} from "lucide-react";
import WorkingTermsDisplay from "./WorkingTermsDisplay";
import WorkingTermsDialog, { type WorkingTerms } from "./WorkingTermsDialog";

interface VendorNote {
  id: string;
  note: string;
  created_at: string;
}

interface VendorConnectionCardProps {
  vendor: {
    vendorUserId: string;
    anonymousId: string;
    companyName: string;
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
    notes?: VendorNote[];
    review?: any;
    conversationId?: string;
    connectedPosts?: Array<{ id: string; title: string; stateCode: string | null; interestId: string; }>;
    workingTerms?: WorkingTerms | null;
  };
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
  onViewCalendar: () => void;
  onReviewVendor: () => void;
  onViewMessages: () => void;
  onDisconnect: () => void;
  onViewTrustScore: () => void;
  onWorkingTermsSaved?: () => void;
}

const VendorConnectionCard: React.FC<VendorConnectionCardProps> = ({
  vendor,
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
  onViewCalendar,
  onReviewVendor,
  onViewMessages,
  onDisconnect,
  onViewTrustScore,
  onWorkingTermsSaved,
}) => {
  const [notesOpen, setNotesOpen] = useState(false);
  const [workingTermsOpen, setWorkingTermsOpen] = useState(false);
  const notesCount = vendor.notes?.length || 0;

  // Build coverage display from statesCovered
  const coverageDisplay = vendor.statesCovered?.length
    ? vendor.statesCovered.join(", ")
    : vendor.coverageSummary || "Coverage not specified";

  return (
    <Card className="w-full">
      <CardContent className="p-4 md:p-6 space-y-4">
        {/* Vendor Summary Section */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* Left: Vendor Info */}
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <button
                  onClick={onViewProfile}
                  className="text-primary hover:underline font-semibold flex items-center gap-1.5 text-sm md:text-base"
                >
                  {vendor.anonymousId}
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <Badge variant="secondary" className="text-xs">Connected</Badge>
              </div>
              <p className="font-medium text-foreground text-sm md:text-base truncate">{vendor.companyName}</p>
              {(vendor.firstName || vendor.lastInitial) && (
                <p className="text-xs text-muted-foreground">
                  {vendor.firstName} {vendor.lastInitial}.
                </p>
              )}
              {(vendor.city || vendor.state) && (
                <p className="text-xs text-muted-foreground">
                  {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.city || vendor.state}
                </p>
              )}
              {vendor.connectedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Connected since {new Date(vendor.connectedAt).toLocaleDateString()}
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
                {vendor.trustScoreCount && vendor.trustScoreCount > 0 ? (
                  <>
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="font-semibold text-foreground">{vendor.trustScore?.toFixed(1)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      ({vendor.trustScoreCount} {vendor.trustScoreCount === 1 ? 'review' : 'reviews'})
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
              Community: {(vendor.communityScore ?? 0) >= 0 ? `+${vendor.communityScore ?? 0}` : vendor.communityScore}
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
              {vendor.trustScoreCount && vendor.trustScoreCount > 0 
                ? `${vendor.trustScore?.toFixed(1)} (${vendor.trustScoreCount})` 
                : "3.0 (New)"}
            </span>
          </button>
          <Badge variant="outline" className="text-xs">
            Community: {(vendor.communityScore ?? 0) >= 0 ? `+${vendor.communityScore ?? 0}` : vendor.communityScore}
          </Badge>
          {vendor.statesCovered && vendor.statesCovered.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {vendor.statesCovered.join(", ")}
            </Badge>
          )}
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
            onClick={onViewCalendar}
            className="w-full md:w-auto text-xs md:text-sm"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Calendar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReviewVendor}
            className="w-full md:w-auto text-xs md:text-sm"
          >
            <Star className="w-3.5 h-3.5 mr-1.5" />
            {vendor.review ? "Edit Review" : "Review"}
          </Button>
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

        {/* Coverage & Pricing Summary */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Coverage & Pricing</span>
              {!vendor.agreementId && (
                <Badge variant="secondary" className="text-xs">Agreement pending</Badge>
              )}
            </div>
            {vendor.agreementId ? (
              <div className="text-sm space-y-1">
                <p className="text-foreground">
                  <span className="text-muted-foreground">Coverage:</span> {vendor.coverageSummary || "Not specified"}
                </p>
                <p className="text-foreground">
                  <span className="text-muted-foreground">Pricing:</span> {vendor.pricingSummary || "Not specified"}
                </p>
                {vendor.statesCovered && vendor.statesCovered.length > 0 && (
                  <p className="text-foreground hidden md:block">
                    <span className="text-muted-foreground">States:</span> {vendor.statesCovered.join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Coverage and pricing details not yet set in ClearMarket.
              </p>
            )}
          </div>

          {/* Working Terms Section */}
          {vendor.agreementId && (
            <div className="border-t border-border/50 pt-3">
              <WorkingTermsDisplay
                workingTerms={vendor.workingTerms}
                onEditClick={() => setWorkingTermsOpen(true)}
                canEdit={true}
              />
            </div>
          )}
        </div>

        {/* Working Terms Dialog */}
        {vendor.agreementId && (
          <WorkingTermsDialog
            open={workingTermsOpen}
            onOpenChange={setWorkingTermsOpen}
            agreementId={vendor.agreementId}
            coverageDisplay={coverageDisplay}
            existingTerms={vendor.workingTerms}
            onSaved={() => onWorkingTermsSaved?.()}
          />
        )}

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
                  notes={vendor.notes}
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
              notes={vendor.notes}
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
            Disconnect from {vendor.companyName}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Notes Content Sub-component
interface NotesContentProps {
  notes?: VendorNote[];
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
          placeholder="Add a quick note about this vendor..."
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

export default VendorConnectionCard;
