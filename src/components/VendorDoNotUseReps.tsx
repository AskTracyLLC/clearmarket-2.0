import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MoreVertical, Pencil, Trash2, ChevronDown, ChevronUp, Ban } from "lucide-react";

interface DoNotUseEntry {
  id: string;
  vendor_id: string;
  rep_user_id: string | null;
  full_name: string;
  primary_email: string | null;
  emails: string[] | null;
  aliases: string[] | null;
  reason: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

interface VendorDoNotUseRepsProps {
  vendorId: string;
  onCountChange?: (count: number) => void;
}

export const VendorDoNotUseReps: React.FC<VendorDoNotUseRepsProps> = ({
  vendorId,
  onCountChange,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DoNotUseEntry[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DoNotUseEntry | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    primary_email: "",
    emails: "",
    aliases: "",
    reason: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<DoNotUseEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [vendorId]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendor_do_not_use_reps")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
      onCountChange?.(data?.length || 0);
    } catch (error) {
      console.error("Error loading DNU entries:", error);
      toast({
        title: "Error",
        description: "Failed to load Do Not Use list.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleNotes = (entryId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const formatEmails = (entry: DoNotUseEntry): React.ReactNode => {
    const lines: string[] = [];
    
    if (entry.primary_email) {
      lines.push(`Primary: ${entry.primary_email}`);
    }
    
    const altEmails = entry.emails || [];
    altEmails.forEach((email, idx) => {
      lines.push(`Alt ${idx + 1}: ${email}`);
    });
    
    if (lines.length === 0) return "—";
    
    return (
      <div className="text-sm space-y-0.5">
        {lines.map((line, idx) => (
          <div key={idx} className="text-muted-foreground">{line}</div>
        ))}
      </div>
    );
  };

  const formatAliases = (entry: DoNotUseEntry): string => {
    if (!entry.aliases || entry.aliases.length === 0) return "—";
    return entry.aliases.join(", ");
  };

  const handleEdit = (entry: DoNotUseEntry) => {
    setEditingEntry(entry);
    setEditForm({
      full_name: entry.full_name,
      primary_email: entry.primary_email || "",
      emails: (entry.emails || []).join(", "),
      aliases: (entry.aliases || []).join(", "),
      reason: entry.reason,
      notes: entry.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    if (!editForm.full_name.trim() || !editForm.reason.trim()) {
      toast({
        title: "Missing required fields",
        description: "Full name and reason are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const emailsArray = editForm.emails
        .split(",")
        .map(e => e.trim())
        .filter(e => e.length > 0);
      
      const aliasesArray = editForm.aliases
        .split(",")
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const { error } = await supabase
        .from("vendor_do_not_use_reps")
        .update({
          full_name: editForm.full_name.trim(),
          primary_email: editForm.primary_email.trim() || null,
          emails: emailsArray.length > 0 ? emailsArray : null,
          aliases: aliasesArray.length > 0 ? aliasesArray : null,
          reason: editForm.reason.trim(),
          notes: editForm.notes.trim() || null,
        })
        .eq("id", editingEntry.id);

      if (error) throw error;

      toast({ title: "Updated", description: "Entry has been updated." });
      setEditDialogOpen(false);
      setEditingEntry(null);
      loadEntries();
    } catch (error) {
      console.error("Error updating DNU entry:", error);
      toast({
        title: "Error",
        description: "Failed to update entry.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (entry: DoNotUseEntry) => {
    setDeletingEntry(entry);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEntry) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("vendor_do_not_use_reps")
        .delete()
        .eq("id", deletingEntry.id);

      if (error) throw error;

      toast({ title: "Removed", description: "Entry has been removed from Do Not Use list." });
      setDeleteDialogOpen(false);
      setDeletingEntry(null);
      loadEntries();
    } catch (error) {
      console.error("Error deleting DNU entry:", error);
      toast({
        title: "Error",
        description: "Failed to remove entry.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading Do Not Use list...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center">
        <Ban className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Do Not Use entries</h3>
        <p className="text-muted-foreground text-sm">
          When you mark a rep as "Do Not Use", they'll appear here and be filtered out of your Connected Reps list.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px]">Full Name</TableHead>
              <TableHead className="w-[200px]">Emails</TableHead>
              <TableHead className="w-[150px]">Aliases</TableHead>
              <TableHead className="w-[200px]">Reason</TableHead>
              <TableHead className="w-[200px]">Notes</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const isNotesExpanded = expandedNotes.has(entry.id);
              const hasNotes = entry.notes && entry.notes.trim().length > 0;

              return (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.full_name}</TableCell>
                  <TableCell>{formatEmails(entry)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatAliases(entry)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive" className="text-xs">
                      {entry.reason}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {hasNotes ? (
                      <div>
                        {isNotesExpanded ? (
                          <div className="space-y-2">
                            <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => toggleNotes(entry.id)}
                            >
                              <ChevronUp className="w-3 h-3 mr-1" />
                              Hide notes
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                              {entry.notes}
                            </p>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => toggleNotes(entry.id)}
                            >
                              <ChevronDown className="w-3 h-3 mr-1" />
                              View notes
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(entry)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(entry)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Do Not Use Entry</DialogTitle>
            <DialogDescription>
              Update the information for this entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">Full Name *</Label>
              <Input
                id="edit-full-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-primary-email">Primary Email</Label>
              <Input
                id="edit-primary-email"
                type="email"
                value={editForm.primary_email}
                onChange={(e) => setEditForm(prev => ({ ...prev, primary_email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-emails">Additional Emails (comma-separated)</Label>
              <Input
                id="edit-emails"
                value={editForm.emails}
                onChange={(e) => setEditForm(prev => ({ ...prev, emails: e.target.value }))}
                placeholder="alt1@example.com, alt2@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-aliases">Aliases (comma-separated)</Label>
              <Input
                id="edit-aliases"
                value={editForm.aliases}
                onChange={(e) => setEditForm(prev => ({ ...prev, aliases: e.target.value }))}
                placeholder="Johnny, J. Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason *</Label>
              <Input
                id="edit-reason"
                value={editForm.reason}
                onChange={(e) => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Quality issues, no-shows, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Do Not Use Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This rep will be able to appear in Connected results again. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default VendorDoNotUseReps;
