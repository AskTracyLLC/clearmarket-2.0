import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, Mail, Phone, Building2, Link, CheckCircle2, Info, ExternalLink } from "lucide-react";

interface VendorContact {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  is_converted_to_vendor: boolean;
  converted_vendor_id: string | null;
  potential_vendor_profile_id: string | null;
  created_at: string;
}

interface VendorProfile {
  id: string;
  company_name: string | null;
  anonymous_id: string | null;
}

interface Props {
  repUserId: string;
  /** If true, renders without Card wrapper (for use inside tabs) */
  embedded?: boolean;
}

export function MyVendorContacts({ repUserId, embedded = false }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  const [vendorProfiles, setVendorProfiles] = useState<Map<string, VendorProfile>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showConverted, setShowConverted] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadContacts();
  }, [repUserId, showConverted]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("rep_vendor_contacts")
        .select("*")
        .eq("rep_user_id", repUserId)
        .order("created_at", { ascending: false });

      if (!showConverted) {
        query = query.eq("is_active", true).eq("is_converted_to_vendor", false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setContacts(data || []);

      const vendorIds = new Set<string>();
      data?.forEach(c => {
        if (c.potential_vendor_profile_id) vendorIds.add(c.potential_vendor_profile_id);
        if (c.converted_vendor_id) vendorIds.add(c.converted_vendor_id);
      });

      if (vendorIds.size > 0) {
        const { data: profiles } = await supabase
          .from("vendor_profile")
          .select("id, user_id, company_name, anonymous_id")
          .in("user_id", Array.from(vendorIds));

        const profileMap = new Map<string, VendorProfile>();
        profiles?.forEach(p => {
          profileMap.set(p.user_id, {
            id: p.id,
            company_name: p.company_name,
            anonymous_id: p.anonymous_id,
          });
        });
        setVendorProfiles(profileMap);
      }
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

  const handleConnectToVendor = async (contact: VendorContact) => {
    if (!contact.potential_vendor_profile_id) return;

    setConnecting(contact.id);
    try {
      const { data: existingConnection } = await supabase
        .from("vendor_connections")
        .select("id, status")
        .eq("vendor_id", contact.potential_vendor_profile_id)
        .eq("field_rep_id", repUserId)
        .maybeSingle();

      if (!existingConnection) {
        const { error: connError } = await supabase
          .from("vendor_connections")
          .insert({
            vendor_id: contact.potential_vendor_profile_id,
            field_rep_id: repUserId,
            status: "connected",
            requested_by: "field_rep" as const,
            requested_at: new Date().toISOString(),
            responded_at: new Date().toISOString(),
          });

        if (connError) throw connError;
      } else if (existingConnection.status !== "connected") {
        await supabase
          .from("vendor_connections")
          .update({
            status: "connected",
            responded_at: new Date().toISOString(),
          })
          .eq("id", existingConnection.id);
      }

      const { error: updateError } = await supabase
        .from("rep_vendor_contacts")
        .update({
          is_converted_to_vendor: true,
          is_active: false,
          converted_vendor_id: contact.potential_vendor_profile_id,
        })
        .eq("id", contact.id);

      if (updateError) throw updateError;

      const vendorProfile = vendorProfiles.get(contact.potential_vendor_profile_id);
      toast({
        title: "Connected!",
        description: `You're now connected to ${vendorProfile?.company_name || "this vendor"} on ClearMarket.`,
      });

      loadContacts();
    } catch (error: any) {
      console.error("Error connecting to vendor:", error);
      toast({
        title: "Error",
        description: "Failed to connect to vendor profile.",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const content = (
    <>
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Offline Vendor Contacts</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-muted-foreground cursor-help">
                  <Info className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Add vendors you already work with so they get your ClearMarket alerts and availability updates. If they sign up later, we'll help you connect!</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Show converted toggle */}
      <div className="flex items-center gap-2 mb-4">
        <Checkbox
          id="show-converted"
          checked={showConverted}
          onCheckedChange={(checked) => setShowConverted(!!checked)}
        />
        <Label htmlFor="show-converted" className="text-sm text-muted-foreground cursor-pointer">
          Show converted contacts
        </Label>
      </div>

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
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const potentialVendor = contact.potential_vendor_profile_id 
                  ? vendorProfiles.get(contact.potential_vendor_profile_id)
                  : null;
                const convertedVendor = contact.converted_vendor_id
                  ? vendorProfiles.get(contact.converted_vendor_id)
                  : null;

                return (
                  <TableRow key={contact.id} className={contact.is_converted_to_vendor ? "opacity-60" : ""}>
                    <TableCell>{contact.contact_name || "—"}</TableCell>
                    <TableCell>{contact.company_name || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{contact.email}</span>
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
                      {contact.is_converted_to_vendor ? (
                        <div className="space-y-1">
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            On ClearMarket
                          </Badge>
                          {convertedVendor && (
                            <p className="text-xs text-muted-foreground">
                              Linked to {convertedVendor.company_name || convertedVendor.anonymous_id}
                            </p>
                          )}
                        </div>
                      ) : potentialVendor ? (
                        <div className="space-y-2">
                          <Badge variant="outline" className="gap-1 text-primary border-primary">
                            <Building2 className="h-3 w-3" />
                            Match found
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            <strong>{potentialVendor.company_name || potentialVendor.anonymous_id}</strong> is on ClearMarket
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Off-platform</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {contact.is_converted_to_vendor ? (
                          convertedVendor && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View vendor profile</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )
                        ) : potentialVendor ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleConnectToVendor(contact)}
                            disabled={connecting === contact.id}
                            className="gap-1"
                          >
                            <Link className="h-3 w-3" />
                            {connecting === contact.id ? "..." : "Connect"}
                          </Button>
                        ) : (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(contact)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteConfirmId(contact.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remove</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Vendor Contact" : "Add Vendor Contact"}</DialogTitle>
            <DialogDescription>
              {editingId 
                ? "Update this vendor's contact information."
                : "Add a vendor you work with who isn't on ClearMarket yet."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inspections"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@acme.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this vendor..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This vendor will no longer receive your network alerts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          My Vendor Contacts
        </CardTitle>
        <CardDescription>
          Add vendors you already work with so they get your ClearMarket alerts and availability updates.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

export default MyVendorContacts;
