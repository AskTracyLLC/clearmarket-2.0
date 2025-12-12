import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Mail, Check, X, Users } from "lucide-react";

interface StaffEmail {
  id: string;
  vendor_profile_id: string;
  staff_name: string | null;
  email: string;
  role_label: string | null;
  receive_network_alerts: boolean;
  receive_direct_messages: boolean;
  applies_to_all_states: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface StaffStateCoverage {
  id: string;
  vendor_staff_email_id: string;
  state_code: string;
}

interface VendorCoverageArea {
  state_code: string;
}

export default function VendorStaffEmailsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [staffEmails, setStaffEmails] = useState<StaffEmail[]>([]);
  const [stateCoverages, setStateCoverages] = useState<Record<string, string[]>>({});
  const [vendorCoverageStates, setVendorCoverageStates] = useState<string[]>([]);
  const [vendorProfileId, setVendorProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffEmail | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffEmail | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    staff_name: "",
    email: "",
    role_label: "",
    receive_network_alerts: true,
    receive_direct_messages: true,
    applies_to_all_states: true,
    selected_states: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Get vendor profile ID
      const { data: vendorProfile, error: profileError } = await supabase
        .from("vendor_profile")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError || !vendorProfile) {
        console.error("Error loading vendor profile:", profileError);
        return;
      }

      setVendorProfileId(vendorProfile.id);

      // Get vendor's coverage areas (states they cover)
      const { data: coverageAreas } = await supabase
        .from("vendor_coverage_areas")
        .select("state_code")
        .eq("user_id", user.id);

      const uniqueStates = [...new Set(coverageAreas?.map(c => c.state_code) || [])].sort();
      setVendorCoverageStates(uniqueStates);

      // Get staff emails
      const { data: staffData, error: staffError } = await supabase
        .from("vendor_staff_emails")
        .select("*")
        .eq("vendor_profile_id", vendorProfile.id)
        .order("created_at", { ascending: false });

      if (staffError) {
        console.error("Error loading staff emails:", staffError);
        return;
      }

      setStaffEmails(staffData || []);

      // Get state coverage for all staff
      if (staffData && staffData.length > 0) {
        const staffIds = staffData.map(s => s.id);
        const { data: coverageData } = await supabase
          .from("vendor_staff_state_coverage")
          .select("*")
          .in("vendor_staff_email_id", staffIds);

        const coverageMap: Record<string, string[]> = {};
        (coverageData || []).forEach(c => {
          if (!coverageMap[c.vendor_staff_email_id]) {
            coverageMap[c.vendor_staff_email_id] = [];
          }
          coverageMap[c.vendor_staff_email_id].push(c.state_code);
        });
        setStateCoverages(coverageMap);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingStaff(null);
    setFormData({
      staff_name: "",
      email: "",
      role_label: "",
      receive_network_alerts: true,
      receive_direct_messages: true,
      applies_to_all_states: true,
      selected_states: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (staff: StaffEmail) => {
    setEditingStaff(staff);
    const staffStates = stateCoverages[staff.id] || [];
    setFormData({
      staff_name: staff.staff_name || "",
      email: staff.email,
      role_label: staff.role_label || "",
      receive_network_alerts: staff.receive_network_alerts,
      receive_direct_messages: staff.receive_direct_messages,
      applies_to_all_states: staff.applies_to_all_states,
      selected_states: staffStates,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!vendorProfileId || !formData.email.trim()) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const staffPayload = {
        vendor_profile_id: vendorProfileId,
        staff_name: formData.staff_name.trim() || null,
        email: formData.email.trim().toLowerCase(),
        role_label: formData.role_label.trim() || null,
        receive_network_alerts: formData.receive_network_alerts,
        receive_direct_messages: formData.receive_direct_messages,
        applies_to_all_states: formData.applies_to_all_states,
      };

      let staffId: string;

      if (editingStaff) {
        // Update existing
        const { error } = await supabase
          .from("vendor_staff_emails")
          .update(staffPayload)
          .eq("id", editingStaff.id);

        if (error) throw error;
        staffId = editingStaff.id;

        // Delete existing state coverage and re-insert
        await supabase
          .from("vendor_staff_state_coverage")
          .delete()
          .eq("vendor_staff_email_id", staffId);
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("vendor_staff_emails")
          .insert(staffPayload)
          .select()
          .single();

        if (error) throw error;
        staffId = data.id;
      }

      // Insert state coverage if not applying to all states
      if (!formData.applies_to_all_states && formData.selected_states.length > 0) {
        const stateCoverageRows = formData.selected_states.map(stateCode => ({
          vendor_staff_email_id: staffId,
          state_code: stateCode,
        }));

        const { error: coverageError } = await supabase
          .from("vendor_staff_state_coverage")
          .insert(stateCoverageRows);

        if (coverageError) throw coverageError;
      }

      toast({ title: editingStaff ? "Staff email updated" : "Staff email added" });
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving staff email:", error);
      toast({ title: "Error saving staff email", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!staffToDelete) return;

    try {
      // Soft delete by setting is_active = false
      const { error } = await supabase
        .from("vendor_staff_emails")
        .update({ is_active: false })
        .eq("id", staffToDelete.id);

      if (error) throw error;

      toast({ title: "Staff email removed" });
      setDeleteConfirmOpen(false);
      setStaffToDelete(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting staff email:", error);
      toast({ title: "Error removing staff email", description: error.message, variant: "destructive" });
    }
  };

  const getStatesDisplay = (staff: StaffEmail) => {
    if (staff.applies_to_all_states) {
      return <span className="text-muted-foreground text-sm">All states we cover</span>;
    }
    const states = stateCoverages[staff.id] || [];
    if (states.length === 0) {
      return <span className="text-muted-foreground text-sm italic">No states selected</span>;
    }
    const display = states.slice(0, 4).join(", ");
    if (states.length > 4) {
      return (
        <span className="text-sm" title={states.join(", ")}>
          {display} +{states.length - 4} more
        </span>
      );
    }
    return <span className="text-sm">{display}</span>;
  };

  const filteredStaff = staffEmails.filter(s => showInactive || s.is_active);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Staff Email Recipients
          </CardTitle>
          <CardDescription>
            Add staff who should get ClearMarket emails from your inspectors. This is useful if you have different people handling different states or tasks.
          </CardDescription>
        </div>
        <Button onClick={openAddDialog} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Staff Email
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground text-center py-8">Loading...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No staff emails added yet.</p>
            <p className="text-sm mt-1">Click "Add Staff Email" to get started.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(!!checked)}
              />
              <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
                Show inactive staff
              </Label>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>States Handled</TableHead>
                    <TableHead className="text-center">Network Alerts</TableHead>
                    <TableHead className="text-center">Direct Messages</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((staff) => (
                    <TableRow key={staff.id} className={!staff.is_active ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {staff.staff_name || <span className="text-muted-foreground italic">No name</span>}
                          {!staff.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{staff.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {staff.role_label || "—"}
                      </TableCell>
                      <TableCell>{getStatesDisplay(staff)}</TableCell>
                      <TableCell className="text-center">
                        {staff.receive_network_alerts ? (
                          <Check className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {staff.receive_direct_messages ? (
                          <Check className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(staff)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {staff.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setStaffToDelete(staff);
                                setDeleteConfirmOpen(true);
                              }}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingStaff ? "Edit Staff Email" : "Add Staff Email"}</DialogTitle>
              <DialogDescription>
                Add a staff member who should receive ClearMarket notifications.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="staff_name">Staff Name (optional)</Label>
                <Input
                  id="staff_name"
                  value={formData.staff_name}
                  onChange={(e) => setFormData({ ...formData, staff_name: e.target.value })}
                  placeholder="e.g., Tracy Myers"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g., tmyers@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_label">Role / Label (optional)</Label>
                <Input
                  id="role_label"
                  value={formData.role_label}
                  onChange={(e) => setFormData({ ...formData, role_label: e.target.value })}
                  placeholder="e.g., Scheduling, IL/IN Lead, Accounting"
                />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label>Notification Types</Label>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="receive_network_alerts"
                    checked={formData.receive_network_alerts}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, receive_network_alerts: !!checked })
                    }
                  />
                  <Label htmlFor="receive_network_alerts" className="font-normal cursor-pointer">
                    Receive Network Alerts from reps
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="receive_direct_messages"
                    checked={formData.receive_direct_messages}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, receive_direct_messages: !!checked })
                    }
                  />
                  <Label htmlFor="receive_direct_messages" className="font-normal cursor-pointer">
                    Receive Direct Messages from reps
                  </Label>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label>States this staff handles</Label>
                <RadioGroup
                  value={formData.applies_to_all_states ? "all" : "specific"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      applies_to_all_states: value === "all",
                      selected_states: value === "all" ? [] : formData.selected_states,
                    })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all-states" />
                    <Label htmlFor="all-states" className="font-normal cursor-pointer">
                      All states we cover
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="specific" id="specific-states" />
                    <Label htmlFor="specific-states" className="font-normal cursor-pointer">
                      Only certain states
                    </Label>
                  </div>
                </RadioGroup>

                {!formData.applies_to_all_states && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      Pick the states this person is responsible for. They'll only get state-based alerts for these states.
                    </p>
                    {vendorCoverageStates.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        You haven't set up any coverage states yet. Set up your coverage areas first.
                      </p>
                    ) : (
                      <ScrollArea className="h-32 rounded-md border p-2">
                        <div className="space-y-2">
                          {vendorCoverageStates.map((stateCode) => (
                            <div key={stateCode} className="flex items-center gap-2">
                              <Checkbox
                                id={`state-${stateCode}`}
                                checked={formData.selected_states.includes(stateCode)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      selected_states: [...formData.selected_states, stateCode],
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      selected_states: formData.selected_states.filter(s => s !== stateCode),
                                    });
                                  }
                                }}
                              />
                              <Label htmlFor={`state-${stateCode}`} className="font-normal cursor-pointer">
                                {stateCode}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={saving || !formData.email.trim()}>
                {saving ? "Saving..." : editingStaff ? "Save Changes" : "Add Staff Email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Staff Email?</AlertDialogTitle>
              <AlertDialogDescription>
                {staffToDelete?.staff_name || staffToDelete?.email} will no longer receive notifications from ClearMarket. You can add them back later if needed.
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
      </CardContent>
    </Card>
  );
}
