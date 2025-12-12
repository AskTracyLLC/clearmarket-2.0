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
}

export function RepVendorContactsCard({ repUserId }: Props) {
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
      // Build query based on showConverted toggle
      let query = supabase
        .from("rep_vendor_contacts")
        .select("*")
        .eq("rep_user_id", repUserId)
        .order("created_at", { ascending: false });

      if (!showConverted) {
        // Default: show only active, non-converted
        query = query.eq("is_active", true).eq("is_converted_to_vendor", false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setContacts(data || []);

      // Fetch vendor profiles for soft matches and converted contacts
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

  const handleConnectToVendor = async (contact: VendorContact) => {
    if (!contact.potential_vendor_profile_id) return;

    setConnecting(contact.id);
    try {
      // Check if connection already exists
      const { data: existingConnection } = await supabase
        .from("vendor_connections")
        .select("id, status")
        .eq("vendor_id", contact.potential_vendor_profile_id)
        .eq("field_rep_id", repUserId)
        .maybeSingle();

      if (!existingConnection) {
        // Create new connection
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
        // Reactivate if ended
        await supabase
          .from("vendor_connections")
          .update({
            status: "connected",
            responded_at: new Date().toISOString(),
          })
          .eq("id", existingConnection.id);
      }

      // Mark contact as converted
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

  // Filter active vs converted contacts
  const activeContacts = contacts.filter(c => c.is_active && !c.is_converted_to_vendor);
  const convertedContacts = contacts.filter(c => c.is_converted_to_vendor);
  const softMatchContacts = activeContacts.filter(c => c.potential_vendor_profile_id);

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
          <CardDescription className="space-y-2">
            <span>Add vendors you already work with so they get your ClearMarket alerts and availability updates.</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-muted-foreground cursor-help ml-1">
                    <Info className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>If a vendor you added signs up for ClearMarket with a different email at the same company, we'll flag that contact so you can connect them to their ClearMarket profile.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                                Looks like <strong>{potentialVendor.company_name || potentialVendor.anonymous_id}</strong> is on ClearMarket
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Off-platform</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {contact.is_converted_to_vendor ? (
                              // Converted: just show view link
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
                              // Soft match: show connect button
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleConnectToVendor(contact)}
                                disabled={connecting === contact.id}
                                className="gap-1"
                              >
                                <Link className="h-3 w-3" />
                                {connecting === contact.id ? "Connecting..." : "Connect"}
                              </Button>
                            ) : (
                              // Regular contact: edit/delete
                              <>
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

          {/* Summary badge for soft matches */}
          {softMatchContacts.length > 0 && !showConverted && (
            <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm">
                <strong>{softMatchContacts.length}</strong> of your contacts may have joined ClearMarket. 
                Connect them to your network to keep alerts flowing through the platform.
              </p>
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
