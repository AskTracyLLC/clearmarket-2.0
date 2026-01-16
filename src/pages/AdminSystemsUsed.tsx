import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, ArrowLeft, Trash2, Power, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  SystemUsed,
  fetchSystemsUsed,
  createSystemUsed,
  updateSystemUsed,
  setSystemUsedActive,
  deleteSystemUsed,
} from "@/lib/systemsUsed";

const AdminSystemsUsed = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const { toast } = useToast();

  const [systems, setSystems] = useState<SystemUsed[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemUsed | null>(null);
  const [saving, setSaving] = useState(false);

  // Confirmation dialogs
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [systemToDeactivate, setSystemToDeactivate] = useState<SystemUsed | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<SystemUsed | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSortOrder, setFormSortOrder] = useState<number>(100);
  const [formActive, setFormActive] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (!permissionsLoading && !permissions.canViewAdminDashboard) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    if (user && permissions.canViewAdminDashboard) {
      loadSystems();
    }
  }, [user, authLoading, permissions, permissionsLoading, navigate]);

  const loadSystems = async () => {
    setLoading(true);
    const data = await fetchSystemsUsed({ includeInactive: true });
    setSystems(data);
    setLoading(false);
  };

  const resetForm = () => {
    setFormLabel("");
    setFormDescription("");
    setFormSortOrder(systems.length > 0 ? Math.max(...systems.map(s => s.sort_order)) + 10 : 10);
    setFormActive(true);
    setEditingSystem(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (system: SystemUsed) => {
    setEditingSystem(system);
    setFormLabel(system.label);
    setFormDescription(system.description || "");
    setFormSortOrder(system.sort_order);
    setFormActive(system.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim()) {
      toast({
        title: "Validation Error",
        description: "Label is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    if (editingSystem) {
      const result = await updateSystemUsed(editingSystem.id, {
        label: formLabel.trim(),
        description: formDescription.trim() || null,
        sort_order: formSortOrder,
        is_active: formActive,
      });

      if (result.success) {
        toast({ title: "Updated", description: "System updated successfully." });
        setDialogOpen(false);
        resetForm();
        loadSystems();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } else {
      const result = await createSystemUsed({
        label: formLabel.trim(),
        description: formDescription.trim() || null,
        sort_order: formSortOrder,
        is_active: formActive,
      });

      if (result.success) {
        toast({ title: "Created", description: "System created successfully." });
        setDialogOpen(false);
        resetForm();
        loadSystems();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    }

    setSaving(false);
  };

  const handleToggleActive = async (system: SystemUsed) => {
    if (system.is_active) {
      // Show confirmation before deactivating
      setSystemToDeactivate(system);
      setDeactivateConfirmOpen(true);
    } else {
      // Activate directly
      const result = await setSystemUsedActive(system.id, true);
      if (result.success) {
        setSystems(prev =>
          prev.map(s => (s.id === system.id ? { ...s, is_active: true } : s))
        );
        toast({ title: "Activated", description: `"${system.label}" is now active.` });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    }
  };

  const confirmDeactivate = async () => {
    if (!systemToDeactivate) return;
    
    const result = await setSystemUsedActive(systemToDeactivate.id, false);
    if (result.success) {
      setSystems(prev =>
        prev.map(s => (s.id === systemToDeactivate.id ? { ...s, is_active: false } : s))
      );
      toast({ title: "Deactivated", description: `"${systemToDeactivate.label}" is now inactive. Users who previously selected it will still see it (muted).` });
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    
    setDeactivateConfirmOpen(false);
    setSystemToDeactivate(null);
  };

  const handleDelete = (system: SystemUsed) => {
    setSystemToDelete(system);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!systemToDelete) return;
    
    const result = await deleteSystemUsed(systemToDelete.id);
    if (result.success) {
      setSystems(prev => prev.filter(s => s.id !== systemToDelete.id));
      toast({ title: "Deleted", description: `"${systemToDelete.label}" has been permanently deleted.` });
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    
    setDeleteConfirmOpen(false);
    setSystemToDelete(null);
  };

  if (authLoading || permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-4">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      <PageHeader
        title="Systems Used"
        subtitle="Manage the systems vendors and reps can select in profile + work setup forms."
      />

      <div className="flex justify-end mb-6">
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add System
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Systems added here will appear in the Work Setup page for both reps and vendors.
        Deactivating a system hides it from new selections, but users who already selected it will still see it with an "Inactive" badge.
      </p>

      <Card className="bg-card-elevated border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="text-center">Sort Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {systems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No systems configured yet. Click "Add System" to create one.
                </TableCell>
              </TableRow>
            ) : (
              systems.map((system) => (
                <TableRow key={system.id} className={!system.is_active ? "opacity-60" : ""}>
                  <TableCell className="font-medium">
                    {system.label}
                    {!system.is_active && (
                      <Badge variant="secondary" className="ml-2">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-xs truncate">
                    {system.description || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={system.is_active}
                      onCheckedChange={() => handleToggleActive(system)}
                    />
                  </TableCell>
                  <TableCell className="text-center">{system.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(system)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(system)}>
                          <Power className="h-4 w-4 mr-2" />
                          {system.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(system)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSystem ? "Edit System" : "Add System"}</DialogTitle>
            <DialogDescription>
              {editingSystem
                ? "Update the system details below."
                : "Add a new system that users can select in their Work Setup."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. EZInspections"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of the system"
                rows={2}
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="active"
                  checked={formActive}
                  onCheckedChange={setFormActive}
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingSystem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={deactivateConfirmOpen} onOpenChange={setDeactivateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate System?</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivating "{systemToDeactivate?.label}" will hide it from new selections.
              Users who already selected it will still see it with an "Inactive" badge.
              You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete System?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{systemToDelete?.label}".
              Users who previously selected it may see an unknown system in their profile.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSystemsUsed;
