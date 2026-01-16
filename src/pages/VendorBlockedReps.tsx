import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Ban, Plus, Pencil, Trash2, X, ShieldOff, Mail, Phone, Users, Info } from "lucide-react";

interface BlockedRep {
  id: string;
  vendor_id: string;
  rep_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  emails: string[] | null;
  phone: string | null;
  phones: string[] | null;
  aliases: string[] | null;
  rep_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function VendorBlockedReps() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [blockedReps, setBlockedReps] = useState<BlockedRep[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailsInput, setEmailsInput] = useState("");
  const [phonesInput, setPhonesInput] = useState("");
  const [aliasesInput, setAliasesInput] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (user) {
      checkAccessAndLoad();
    }
  }, [user, authLoading, navigate]);

  const checkAccessAndLoad = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_vendor_admin, is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_vendor_admin && !profile?.is_admin) {
      toast({
        title: "Access Denied",
        description: "This page is only available to vendor accounts.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    loadBlockedReps();
  };

  const loadBlockedReps = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendor_offline_rep_contacts")
        .select("*")
        .eq("vendor_id", user.id)
        .eq("status", "blocked")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBlockedReps((data || []) as BlockedRep[]);
    } catch (error) {
      console.error("Error loading blocked reps:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFirstName("");
    setLastName("");
    setEmailsInput("");
    setPhonesInput("");
    setAliasesInput("");
    setNotes("");
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rep: BlockedRep) => {
    setEditingId(rep.id);
    setFirstName(rep.first_name || "");
    setLastName(rep.last_name || "");
    setEmailsInput((rep.emails || [rep.email].filter(Boolean)).join(", "));
    setPhonesInput((rep.phones || [rep.phone].filter(Boolean)).join(", "));
    setAliasesInput((rep.aliases || []).join(", "));
    setNotes(rep.notes || "");
    setDialogOpen(true);
  };

  const parseArrayInput = (input: string): string[] => {
    return input
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  const handleSave = async () => {
    if (!firstName.trim() && !lastName.trim()) {
      toast({ title: "Validation Error", description: "First or last name is required.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const emailsArray = parseArrayInput(emailsInput).map(e => e.toLowerCase());
      const phonesArray = parseArrayInput(phonesInput);
      const aliasesArray = parseArrayInput(aliasesInput);

      const repName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

      const payload = {
        rep_name: repName,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: emailsArray[0] || null,
        emails: emailsArray.length > 0 ? emailsArray : null,
        phone: phonesArray[0] || null,
        phones: phonesArray.length > 0 ? phonesArray : null,
        aliases: aliasesArray.length > 0 ? aliasesArray : null,
        notes: notes.trim() || null,
        status: "blocked",
      };

      if (editingId) {
        const { error } = await supabase
          .from("vendor_offline_rep_contacts")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Updated", description: "Blocked rep record has been updated." });
      } else {
        const { error } = await supabase
          .from("vendor_offline_rep_contacts")
          .insert({ ...payload, vendor_id: user!.id });
        if (error) throw error;
        toast({ title: "Added", description: "Rep added to Do Not Assign list." });
      }

      setDialogOpen(false);
      resetForm();
      loadBlockedReps();
    } catch (error: any) {
      console.error("Error saving blocked rep:", error);
      toast({ title: "Error", description: error.message || "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { error } = await supabase
        .from("vendor_offline_rep_contacts")
        .delete()
        .eq("id", deleteConfirmId);
      if (error) throw error;
      toast({ title: "Removed", description: "Rep removed from Do Not Assign list." });
      loadBlockedReps();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to remove.", variant: "destructive" });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleUnblock = async (repId: string) => {
    try {
      const { error } = await supabase
        .from("vendor_offline_rep_contacts")
        .update({ status: "inactive" })
        .eq("id", repId);
      if (error) throw error;
      toast({ title: "Unblocked", description: "Rep removed from Do Not Assign list." });
      loadBlockedReps();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to unblock.", variant: "destructive" });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Ban className="h-6 w-6 text-destructive" />
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Do Not Assign</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Track reps you won't work with. This is private to your vendor team and not visible to field reps.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Manage your internal list of reps who should not be assigned work.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end mb-4">
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" /> Add to List
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {blockedReps.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Blocked Reps</h3>
              <p className="text-muted-foreground mb-4">
                Your Do Not Assign list is empty.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Emails</TableHead>
                    <TableHead>Phones</TableHead>
                    <TableHead>Aliases</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedReps.map((rep) => {
                    const emails = rep.emails || (rep.email ? [rep.email] : []);
                    const phones = rep.phones || (rep.phone ? [rep.phone] : []);
                    
                    return (
                      <TableRow key={rep.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {rep.rep_name || `${rep.first_name || ""} ${rep.last_name || ""}`.trim() || "Unknown"}
                            <Badge variant="destructive" className="text-xs">
                              <Ban className="h-3 w-3 mr-1" /> Blocked
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {emails.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm truncate max-w-[200px]">
                                {emails.join(", ")}
                              </span>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {phones.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{phones.join(", ")}</span>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {rep.aliases && rep.aliases.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {rep.aliases.map((alias, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">{alias}</Badge>
                              ))}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {rep.notes ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-sm text-muted-foreground truncate max-w-[150px] block cursor-help">
                                    {rep.notes.substring(0, 30)}{rep.notes.length > 30 ? "..." : ""}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="whitespace-pre-wrap">{rep.notes}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(rep.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(rep)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleUnblock(rep.id)}>
                                    <ShieldOff className="h-4 w-4 text-green-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Unblock</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteConfirmId(rep.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Blocked Rep" : "Add to Do Not Assign"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the details for this blocked rep." : "Add a rep to your internal Do Not Assign list."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first-name">First Name</Label>
                <Input
                  id="first-name"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  placeholder="Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="emails">Email Addresses <span className="text-xs text-muted-foreground">(comma-separated)</span></Label>
              <Input
                id="emails"
                placeholder="john@example.com, jsmith@other.com"
                value={emailsInput}
                onChange={(e) => setEmailsInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phones">Phone Numbers <span className="text-xs text-muted-foreground">(comma-separated)</span></Label>
              <Input
                id="phones"
                placeholder="(555) 123-4567, (555) 987-6543"
                value={phonesInput}
                onChange={(e) => setPhonesInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="aliases">Known Aliases <span className="text-xs text-muted-foreground">(comma-separated)</span></Label>
              <Input
                id="aliases"
                placeholder="Johnny S., J. Smith"
                value={aliasesInput}
                onChange={(e) => setAliasesInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="notes">Reason / Notes</Label>
              <Textarea
                id="notes"
                placeholder="Why this rep should not be assigned work..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Add to List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this rep from your Do Not Assign list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
