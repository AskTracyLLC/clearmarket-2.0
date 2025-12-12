import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit2, X, Check } from "lucide-react";

interface Note {
  id: string;
  note: string;
  created_at: string;
}

interface ConnectionNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repName: string;
  notes: Note[];
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

export const ConnectionNotesModal: React.FC<ConnectionNotesModalProps> = ({
  open,
  onOpenChange,
  repName,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connection notes for {repName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Existing Notes */}
          {notes && notes.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {notes.map((n) => (
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
                    <div className="flex items-start justify-between gap-2 bg-muted/30 rounded-md p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">
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
            <p className="text-sm text-muted-foreground italic text-center py-4">
              No notes yet.
            </p>
          )}

          {/* Add New Note */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Add a note</p>
            <div className="space-y-2">
              <textarea
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2"
                rows={3}
                placeholder="Add a quick note about this field rep..."
                value={noteDraft}
                onChange={(e) => onNoteDraftChange(e.target.value)}
              />
              <Button
                size="sm"
                onClick={onAddNote}
                disabled={!noteDraft.trim()}
                className="w-full"
              >
                Save Note
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionNotesModal;
