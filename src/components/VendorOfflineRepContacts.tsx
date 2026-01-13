import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, Mail, Phone, Building2, Info, Upload, Download, Ban, ShieldOff } from "lucide-react";
import {
  parseVendorRepCSV,
  generateVendorRepTemplate,
  downloadCSV,
  formatSystems,
  ParseResult,
  ParsedVendorRepContact,
  ParsedRow,
  ExistingContact,
} from "@/lib/offlineContactsCsv";
import { CSVImportPreviewDialog } from "./CSVImportPreviewDialog";

interface OfflineRepContact {
  id: string;
  vendor_id: string;
  rep_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  systems: string[] | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  vendorId: string;
  embedded?: boolean;
}

export function VendorOfflineRepContacts({ vendorId, embedded = false }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<OfflineRepContact[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // CSV import state
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult<ParsedVendorRepContact> | null>(null);
  const [importing, setImporting] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [repName, setRepName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [systems, setSystems] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    loadContacts();
  }, [vendorId]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendor_offline_rep_contacts")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error loading offline rep contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setRepName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setSystems("");
    setNotes("");
    setStatus("active");
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (contact: OfflineRepContact) => {
    setEditingId(contact.id);
    setRepName(contact.rep_name);
    setCompany(contact.company || "");
    setEmail(contact.email || "");
    setPhone(contact.phone || "");
    setSystems(formatSystems(contact.systems));
    setNotes(contact.notes || "");
    setStatus(contact.status);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!repName.trim()) {
      toast({ title: "Validation Error", description: "Rep Name is required.", variant: "destructive" });
      return;
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        toast({ title: "Validation Error", description: "Please enter a valid email address.", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      const systemsArray = systems.trim() 
        ? systems.split(";").map(s => s.trim()).filter(s => s.length > 0)
        : null;

      const payload = {
        rep_name: repName.trim(),
        company: company.trim() || null,
        email: email.trim().toLowerCase() || null,
        phone: phone.trim() || null,
        systems: systemsArray,
        notes: notes.trim() || null,
        status,
      };

      if (editingId) {
        const { error } = await supabase.from("vendor_offline_rep_contacts").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Contact Updated", description: "Offline rep contact has been updated." });
      } else {
        const { error } = await supabase.from("vendor_offline_rep_contacts").insert({ ...payload, vendor_id: vendorId });
        if (error) throw error;
        toast({ title: "Contact Added", description: "Offline rep contact has been added." });
      }

      setDialogOpen(false);
      resetForm();
      loadContacts();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast({ title: "Error", description: error.message || "Failed to save contact.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { error } = await supabase.from("vendor_offline_rep_contacts").delete().eq("id", deleteConfirmId);
      if (error) throw error;
      toast({ title: "Contact Deleted", description: "Offline rep contact has been removed." });
      loadContacts();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to remove contact.", variant: "destructive" });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleStatusChange = async (contactId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("vendor_offline_rep_contacts").update({ status: newStatus }).eq("id", contactId);
      if (error) throw error;
      setContacts(prev => prev.map(c => (c.id === contactId ? { ...c, status: newStatus } : c)));
      toast({ title: "Status Updated", description: `Contact marked as ${newStatus}.` });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  };

  const handleDownloadTemplate = () => {
    const template = generateVendorRepTemplate();
    downloadCSV(template, "offline_rep_contacts_template.csv");
    toast({ title: "Template Downloaded", description: "Fill in the template and import it back." });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const existingContacts: ExistingContact[] = contacts.map(c => ({ email: c.email, phone: c.phone }));
      const result = parseVendorRepCSV(content, existingContacts);
      setParseResult(result);
      setImportPreviewOpen(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to parse CSV file.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmImport = async (validRows: ParsedRow<ParsedVendorRepContact>[]): Promise<{ success: number; failed: number }> => {
    setImporting(true);
    let success = 0, failed = 0;
    const chunkSize = 50;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      const records = chunk.map(row => ({
        vendor_id: vendorId,
        rep_name: row.data.rep_name,
        company: row.data.company,
        email: row.data.email,
        phone: row.data.phone,
        systems: row.data.systems,
        status: row.data.status,
        notes: row.data.notes,
      }));
      const { error } = await supabase.from("vendor_offline_rep_contacts").insert(records);
      if (error) { failed += chunk.length; } else { success += chunk.length; }
    }
    setImporting(false);
    loadContacts();
    toast({ title: "Import Complete", description: `${success} contacts imported${failed > 0 ? `, ${failed} failed` : ""}.` });
    return { success, failed };
  };

  const filteredContacts = contacts.filter(c => statusFilter === "all" || c.status === statusFilter);

  const content = (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Offline Rep Contacts</h3>
          <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="inline-flex items-center gap-1 text-muted-foreground cursor-help"><Info className="h-3.5 w-3.5" /></span></TooltipTrigger><TooltipContent className="max-w-xs"><p>Add field reps you work with who aren't on ClearMarket yet. They'll receive your Network Alerts via email.</p></TooltipContent></Tooltip></TooltipProvider>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-28 h-8"><SelectValue placeholder="Filter" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}><Download className="h-4 w-4 mr-2" />Template</Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Import CSV</Button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
          <Button size="sm" onClick={openAddDialog}><Plus className="h-4 w-4 mr-2" />Add Rep</Button>
        </div>
      </div>

      {loading ? (<div className="text-center py-8 text-muted-foreground">Loading...</div>) : filteredContacts.length === 0 ? (
        <div className="text-center py-8"><Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{contacts.length === 0 ? "No offline rep contacts yet." : "No contacts match the current filter."}</p></div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Rep Name</TableHead><TableHead>Company</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Systems</TableHead><TableHead>Status</TableHead><TableHead className="w-[100px]">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id} className={contact.status === "inactive" ? "opacity-60" : ""}>
                  <TableCell className="font-medium"><div className="flex items-center gap-2">{contact.rep_name}{contact.status === "blocked" && <Badge variant="destructive" className="text-xs"><Ban className="h-3 w-3 mr-1" />Blocked</Badge>}</div></TableCell>
                  <TableCell>{contact.company ? <div className="flex items-center gap-1"><Building2 className="h-3 w-3 text-muted-foreground" />{contact.company}</div> : "—"}</TableCell>
                  <TableCell>{contact.email ? <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /><span className="truncate max-w-[150px]">{contact.email}</span></div> : "—"}</TableCell>
                  <TableCell>{contact.phone ? <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{contact.phone}</div> : "—"}</TableCell>
                  <TableCell>{contact.systems && contact.systems.length > 0 ? <div className="flex flex-wrap gap-1">{contact.systems.map((sys, idx) => <Badge key={idx} variant="outline" className="text-xs">{sys}</Badge>)}</div> : "—"}</TableCell>
                  <TableCell>
                    <Select value={contact.status} onValueChange={(val) => handleStatusChange(contact.id, val)}>
                      <SelectTrigger className="w-28 h-7"><SelectValue><Badge variant={contact.status === "blocked" ? "destructive" : contact.status === "active" ? "default" : "secondary"} className="text-xs">{contact.status}</Badge></SelectValue></SelectTrigger>
                      <SelectContent><SelectItem value="active"><Badge variant="default" className="text-xs">active</Badge></SelectItem><SelectItem value="inactive"><Badge variant="secondary" className="text-xs">inactive</Badge></SelectItem><SelectItem value="blocked"><Badge variant="destructive" className="text-xs">blocked</Badge></SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => openEditDialog(contact)}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Edit / View Notes</TooltipContent></Tooltip></TooltipProvider>
                      {contact.status === "blocked" && <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleStatusChange(contact.id, "active")}><ShieldOff className="h-4 w-4 text-green-600" /></Button></TooltipTrigger><TooltipContent>Unblock</TooltipContent></Tooltip></TooltipProvider>}
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(contact.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Contact" : "Add Rep Manually"}</DialogTitle><DialogDescription>{editingId ? "Update the details for this offline rep contact." : "Add a field rep who isn't on ClearMarket yet."}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="rep-name">Rep Name <span className="text-destructive">*</span></Label><Input id="rep-name" placeholder="e.g., John Smith" value={repName} onChange={(e) => setRepName(e.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="company">Company</Label><Input id="company" placeholder="e.g., ABC Inspections" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="e.g., john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" placeholder="e.g., (555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="systems">Systems <span className="text-xs text-muted-foreground ml-2">(separate with semicolons, e.g., EZ;IA)</span></Label><Input id="systems" placeholder="e.g., EZ;IA" value={systems} onChange={(e) => setSystems(e.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" placeholder="Optional notes about this contact..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1" /></div>
            <div><Label htmlFor="status">Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingId ? "Update Contact" : "Add Contact"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this contact?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this offline rep contact. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <CSVImportPreviewDialog open={importPreviewOpen} onOpenChange={setImportPreviewOpen} parseResult={parseResult} contactType="vendor_rep" onConfirmImport={handleConfirmImport} importing={importing} />
    </>
  );

  if (embedded) return <div className="p-4">{content}</div>;
  return <div className="bg-card border border-border rounded-lg p-6">{content}</div>;
}
