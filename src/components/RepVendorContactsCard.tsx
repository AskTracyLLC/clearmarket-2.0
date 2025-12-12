import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, Mail, Phone, Building2 } from "lucide-react";

interface VendorContact {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  repUserId: string;
}

export function RepVendorContactsCard({ repUserId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadContacts();
  }, [repUserId]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rep_vendor_contacts")
        .select("*")
        .eq("rep_user_id", repUserId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error loading vendor contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setContactName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setNotes("");
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (contact: VendorContact) => {
    setEditingId(contact.id);
    setContactName(contact.contact_name || "");
    setCompanyName(contact.company_name || "");
    setEmail(contact.email);
    setPhone(contact.phone || "");
    setNotes(contact.notes || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!email.trim()) {
      toast({
        title: "Validation Error",
        description: "Email is required.",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from("rep_vendor_contacts")
          .update({
            contact_name: contactName.trim() || null,
            company_name: companyName.trim() || null,
            email: email.trim(),
            phone: phone.trim() || null,
            notes: notes.trim() || null,
          })
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Contact Updated", description: "Vendor contact has been updated." });
      } else {
        // Create new
        const { error } = await supabase
          .from("rep_vendor_contacts")
          .insert({
            rep_user_id: repUserId,
            contact_name: contactName.trim() || null,
            company_name: companyName.trim() || null,
            email: email.trim(),
            phone: phone.trim() || null,
            notes: notes.trim() || null,
          });

        if (error) throw error;
        toast({ title: "Contact Added", description: "Vendor contact has been added." });
      }

      setDialogOpen(false);
      resetForm();
      loadContacts();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save contact.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      // Soft delete
      const { error } = await supabase
        .from("rep_vendor_contacts")
        .update({ is_active: false })
        .eq("id", deleteConfirmId);

      if (error) throw error;
      toast({ title: "Contact Removed", description: "Vendor contact has been removed." });
      loadContacts();
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      toast({
        title: "Error",
        description: "Failed to remove contact.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>My Vendor Contacts</CardTitle>
            </div>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor Manually
            </Button>
          </div>
          <CardDescription>
            Add vendors you already work with so they get your ClearMarket alerts and availability updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No vendor contacts yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Add vendors who aren't on ClearMarket yet to include them in your network alerts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>{contact.contact_name || "—"}</TableCell>
                      <TableCell>{contact.company_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {contact.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {contact.phone}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(contact)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(contact.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
            <DialogTitle>{editingId ? "Edit Vendor Contact" : "Add Vendor Contact"}</DialogTitle>
            <DialogDescription>
              Use this to add vendors you work with who aren't on ClearMarket yet. They'll receive your Network Alerts and updates by email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contact-name">Contact Name</Label>
              <Input
                id="contact-name"
                placeholder="e.g., John Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                placeholder="e.g., ABC Inspections"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="vendor@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about this vendor..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Contact" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Vendor Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This vendor will no longer receive your network alerts. You can add them again later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove Contact</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
