import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Edit2, Trash2, X, Check, Mail, Phone, Lock, Globe } from "lucide-react";
import { format } from "date-fns";

interface StaffNote {
  id: string;
  vendor_id: string;
  staff_user_id: string;
  created_by: string;
  audience: "public" | "private";
  note_type: string | null;
  note: string;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

interface StaffMember {
  id: string;
  staff_user_id: string | null;
  invited_name: string;
  invited_email: string;
  role: "owner" | "admin" | "staff";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorProfileId: string;
  staffMember: StaffMember | null;
  isCurrentUserAdmin: boolean;
  staffPhone?: string | null;
}

const NOTE_TYPES = [
  { value: "other", label: "Other" },
  { value: "responsibility", label: "Responsibility" },
  { value: "incident", label: "Incident" },
  { value: "praise", label: "Praise" },
  { value: "discussion", label: "Discussion" },
];

export function VendorStaffNotesDrawer({
  open,
  onOpenChange,
  vendorProfileId,
  staffMember,
  isCurrentUserAdmin,
  staffPhone,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("other");
  const [audience, setAudience] = useState<"public" | "private">("private");
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");

  useEffect(() => {
    if (open && staffMember?.staff_user_id) {
      loadNotes();
    }
  }, [open, staffMember?.staff_user_id]);

  const loadNotes = async () => {
    if (!staffMember?.staff_user_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendor_staff_notes")
        .select("*")
        .eq("vendor_id", vendorProfileId)
        .eq("staff_user_id", staffMember.staff_user_id)
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
      })) as StaffNote[]);
    } catch (error) {
      console.error("Error loading staff notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user || !staffMember?.staff_user_id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vendor_staff_notes")
        .insert({
          vendor_id: vendorProfileId,
          staff_user_id: staffMember.staff_user_id,
          created_by: user.id,
          audience: isCurrentUserAdmin ? audience : "private",
          note_type: noteType,
          note: newNote.trim(),
        });

      if (error) throw error;
      
      toast({ title: "Note Added", description: "Staff note has been saved." });
      setNewNote("");
      setNoteType("other");
      setAudience("private");
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
        .from("vendor_staff_notes")
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
        .from("vendor_staff_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      
      toast({ title: "Note Deleted" });
      loadNotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete note.", variant: "destructive" });
    }
  };

  const canEditDelete = (note: StaffNote) => {
    if (isCurrentUserAdmin) return true;
    return note.created_by === user?.id && note.audience === "private";
  };

  // Filter notes based on user permissions
  const publicNotes = notes.filter(n => n.audience === "public");
  const privateNotes = notes.filter(n => n.audience === "private");
  
  // Staff (non-admin) can only see their own private notes
  const visiblePrivateNotes = isCurrentUserAdmin 
    ? privateNotes 
    : privateNotes.filter(n => n.created_by === user?.id);

  const renderNotesList = (notesList: StaffNote[]) => (
    <ScrollArea className="h-[300px]">
      {notesList.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-8">
          No notes yet.
        </p>
      ) : (
        <div className="space-y-3 pr-4">
          {notesList.map((note) => (
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
                      {note.audience === "public" ? (
                        <Badge variant="secondary" className="text-xs">
                          <Globe className="h-3 w-3 mr-1" /> Team-visible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" /> Private
                        </Badge>
                      )}
                      {note.note_type && note.note_type !== "other" && (
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
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Staff Notes</SheetTitle>
        </SheetHeader>
        
        {staffMember && (
          <div className="mt-4 space-y-4">
            {/* Staff Info */}
            <div className="bg-muted/30 rounded-md p-3 space-y-1">
              <p className="font-medium">{staffMember.invited_name}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" /> {staffMember.invited_email}
              </div>
              {staffPhone && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" /> {staffPhone}
                </div>
              )}
              <Badge variant={staffMember.role === "owner" ? "default" : staffMember.role === "admin" ? "secondary" : "outline"} className="mt-1">
                {staffMember.role}
              </Badge>
            </div>

            {/* Notes Tabs */}
            {isCurrentUserAdmin ? (
              <Tabs defaultValue="public" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="public">Team Notes ({publicNotes.length})</TabsTrigger>
                  <TabsTrigger value="private">Private ({privateNotes.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="public" className="mt-4">
                  {loading ? <p className="text-muted-foreground text-center py-4">Loading...</p> : renderNotesList(publicNotes)}
                </TabsContent>
                <TabsContent value="private" className="mt-4">
                  {loading ? <p className="text-muted-foreground text-center py-4">Loading...</p> : renderNotesList(privateNotes)}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">My Private Notes</h4>
                {loading ? <p className="text-muted-foreground text-center py-4">Loading...</p> : renderNotesList(visiblePrivateNotes)}
              </div>
            )}

            {/* Add Note Form */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Note
              </h4>
              
              <div className="flex gap-2">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {isCurrentUserAdmin ? (
                  <Select value={audience} onValueChange={(v) => setAudience(v as "public" | "private")}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Team-visible
                        </div>
                      </SelectItem>
                      <SelectItem value="private">
                        <div className="flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Private
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="h-9 px-3 flex items-center">
                    <Lock className="h-3 w-3 mr-1" /> Private only
                  </Badge>
                )}
              </div>
              
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note about this staff member..."
                rows={3}
              />
              
              <Button onClick={handleAddNote} disabled={!newNote.trim() || saving} className="w-full">
                {saving ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default VendorStaffNotesDrawer;
