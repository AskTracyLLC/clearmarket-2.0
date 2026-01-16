import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, X, Check, User } from "lucide-react";
import { format } from "date-fns";

interface RepNote {
  id: string;
  vendor_id: string;
  rep_user_id: string;
  created_by: string;
  note_type: string | null;
  note: string;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorProfileId: string;
  repUserId: string;
  repName: string;
  isCurrentUserAdmin: boolean;
}

const NOTE_TYPES = [
  { value: "general", label: "General" },
  { value: "performance", label: "Performance" },
  { value: "communication", label: "Communication" },
  { value: "quality", label: "Quality" },
  { value: "billing", label: "Billing" },
  { value: "escalation", label: "Escalation" },
];

export function VendorRepNotesDrawer({
  open,
  onOpenChange,
  vendorProfileId,
  repUserId,
  repName,
  isCurrentUserAdmin,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<RepNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");

  useEffect(() => {
    if (open && repUserId) {
      loadNotes();
    }
  }, [open, repUserId]);

  const loadNotes = async () => {
    if (!repUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendor_rep_notes")
        .select("*")
        .eq("vendor_id", vendorProfileId)
        .eq("rep_user_id", repUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch creator names
      const creatorIds = [...new Set((data || []).map(n => n.created_by))];
      let creatorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);
        profiles?.forEach(p => { creatorMap[p.id] = p.full_name || "Unknown"; });
      }

      setNotes((data || []).map(n => ({
        ...n,
        creator_name: creatorMap[n.created_by] || "Unknown",
      })) as RepNote[]);
    } catch (error) {
      console.error("Error loading rep notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vendor_rep_notes")
        .insert({
          vendor_id: vendorProfileId,
          rep_user_id: repUserId,
          created_by: user.id,
          note_type: noteType,
          note: newNote.trim(),
        });

      if (error) throw error;
      
      toast({ title: "Note Added", description: "Rep note has been saved." });
      setNewNote("");
      setNoteType("general");
      loadNotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save note.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditNote = async (noteId: string) => {
    if (!editedText.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vendor_rep_notes")
        .update({ note: editedText.trim() })
        .eq("id", noteId);

      if (error) throw error;
      
      toast({ title: "Note Updated" });
      setEditingId(null);
      setEditedText("");
      loadNotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update note.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("vendor_rep_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      
      toast({ title: "Note Deleted" });
      loadNotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete note.", variant: "destructive" });
    }
  };

  const canEditDelete = (note: RepNote) => {
    if (isCurrentUserAdmin) return true;
    return note.created_by === user?.id;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Rep Notes
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-4 space-y-4">
          {/* Rep Info */}
          <div className="bg-muted/30 rounded-md p-3">
            <p className="font-medium">{repName}</p>
            <p className="text-xs text-muted-foreground">
              All notes are shared with your vendor team.
            </p>
          </div>

          {/* Notes List */}
          <ScrollArea className="h-[350px]">
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                No notes yet. Add the first note about this rep.
              </p>
            ) : (
              <div className="space-y-3 pr-4">
                {notes.map((note) => (
                  <div key={note.id} className="bg-muted/30 rounded-md p-3 space-y-2">
                    {editingId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleEditNote(note.id)} disabled={saving}>
                            <Check className="h-3 w-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditedText(""); }}>
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {note.note_type && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {note.note_type}
                              </Badge>
                            )}
                          </div>
                          {canEditDelete(note) && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => { setEditingId(note.id); setEditedText(note.note); }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteNote(note.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{note.note}</p>
                        <p className="text-xs text-muted-foreground">
                          {note.creator_name} • {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Add Note Form */}
          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Note
            </h4>
            
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note about this field rep..."
              rows={3}
            />
            
            <Button onClick={handleAddNote} disabled={!newNote.trim() || saving} className="w-full">
              {saving ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default VendorRepNotesDrawer;
