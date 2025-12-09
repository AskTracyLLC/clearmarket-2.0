import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import {
  InspectionTypeOption,
  InspectionCategory,
  fetchAllInspectionTypes,
  fetchAllInspectionCategories,
  createInspectionType,
  updateInspectionType,
  toggleInspectionTypeActive,
} from "@/lib/inspectionTypes";

const APPLIES_TO_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'rep', label: 'Reps' },
  { value: 'vendor', label: 'Vendors' },
] as const;

const AdminInspectionTypes = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const { toast } = useToast();

  const [options, setOptions] = useState<InspectionTypeOption[]>([]);
  const [categories, setCategories] = useState<InspectionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<InspectionTypeOption | null>(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAppliesTo, setFilterAppliesTo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formCategory, setFormCategory] = useState<string>("");
  const [formAppliesTo, setFormAppliesTo] = useState<string>("both");
  const [formDescription, setFormDescription] = useState("");
  const [formSortOrder, setFormSortOrder] = useState<number>(100);

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
      loadOptions();
    }
  }, [user, authLoading, permissions, permissionsLoading, navigate]);

  const loadOptions = async () => {
    setLoading(true);
    const [data, cats] = await Promise.all([
      fetchAllInspectionTypes(),
      fetchAllInspectionCategories()
    ]);
    setOptions(data);
    setCategories(cats);
    setLoading(false);
  };

  const resetForm = () => {
    setFormLabel("");
    setFormCategory("");
    setFormAppliesTo("both");
    setFormDescription("");
    setFormSortOrder(100);
    setEditingOption(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (opt: InspectionTypeOption) => {
    setEditingOption(opt);
    setFormLabel(opt.label);
    setFormCategory(opt.category);
    setFormAppliesTo(opt.applies_to);
    setFormDescription(opt.description || "");
    setFormSortOrder(opt.sort_order);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim() || !formCategory) {
      toast({
        title: "Validation Error",
        description: "Label and Category are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    if (editingOption) {
      const result = await updateInspectionType(editingOption.id, {
        label: formLabel.trim(),
        category: formCategory,
        applies_to: formAppliesTo as 'rep' | 'vendor' | 'both',
        description: formDescription.trim() || null,
        sort_order: formSortOrder,
      });

      if (result.success) {
        toast({ title: "Updated", description: "Inspection type updated successfully." });
        setDialogOpen(false);
        resetForm();
        loadOptions();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } else {
      const result = await createInspectionType({
        label: formLabel.trim(),
        category: formCategory,
        applies_to: formAppliesTo as 'rep' | 'vendor' | 'both',
        description: formDescription.trim() || null,
        sort_order: formSortOrder,
        is_active: true,
      });

      if (result.success) {
        toast({ title: "Created", description: "Inspection type created successfully." });
        setDialogOpen(false);
        resetForm();
        loadOptions();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    }

    setSaving(false);
  };

  const handleToggleActive = async (opt: InspectionTypeOption) => {
    const result = await toggleInspectionTypeActive(opt.id, !opt.is_active);
    if (result.success) {
      setOptions(prev =>
        prev.map(o => (o.id === opt.id ? { ...o, is_active: !opt.is_active } : o))
      );
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  // Apply filters
  const filteredOptions = options.filter(opt => {
    if (filterCategory !== "all" && opt.category !== filterCategory) return false;
    if (filterAppliesTo !== "all" && opt.applies_to !== filterAppliesTo) return false;
    if (filterStatus === "active" && !opt.is_active) return false;
    if (filterStatus === "inactive" && opt.is_active) return false;
    return true;
  });

  if (authLoading || permissionsLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
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
          title="Inspection Types"
          subtitle="Manage inspection type options available to Field Reps and Vendors"
        />

        {/* Filters and Add Button */}
        <div className="flex flex-wrap gap-4 items-center mb-6">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Category:</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.label}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Applies To:</Label>
            <Select value={filterAppliesTo} onValueChange={setFilterAppliesTo}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="rep">Reps</SelectItem>
                <SelectItem value="vendor">Vendors</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Status:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto">
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Inspection Type
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className="border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Sort Order</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No inspection types found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOptions.map(opt => (
                  <TableRow key={opt.id} className={!opt.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{opt.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {opt.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {opt.applies_to === 'both' ? 'Both' : opt.applies_to === 'rep' ? 'Reps' : 'Vendors'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={opt.is_active}
                        onCheckedChange={() => handleToggleActive(opt)}
                      />
                    </TableCell>
                    <TableCell className="text-center">{opt.sort_order}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {opt.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(opt)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingOption ? "Edit Inspection Type" : "Add Inspection Type"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="label">Label <span className="text-destructive">*</span></Label>
                <Input
                  id="label"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  placeholder="e.g., Standard Exterior Occupancy"
                />
              </div>

              <div>
                <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.label}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="appliesTo">Applies To</Label>
                <Select value={formAppliesTo} onValueChange={setFormAppliesTo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLIES_TO_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formSortOrder}
                  onChange={e => setFormSortOrder(parseInt(e.target.value) || 100)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first within each category.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingOption ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
};

export default AdminInspectionTypes;
