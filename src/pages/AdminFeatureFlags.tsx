import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Settings, Plus, Pencil, Trash2, ToggleLeft, Coins } from "lucide-react";
import { toast } from "sonner";
import { FeatureFlag } from "@/hooks/useFeatureFlags";

export default function AdminFeatureFlags() {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const navigate = useNavigate();

  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  
  // Form state for add/edit
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBetaNote, setFormBetaNote] = useState("");
  const [formIsEnabled, setFormIsEnabled] = useState(false);
  const [formIsPaid, setFormIsPaid] = useState(false);
  const [saving, setSaving] = useState(false);

  // Permission check
  useEffect(() => {
    if (!permsLoading && !permissions.canViewAdminDashboard) {
      toast.error("Access denied");
      navigate("/dashboard");
    }
  }, [permsLoading, permissions, navigate]);

  useEffect(() => {
    if (user && permissions.canViewAdminDashboard) {
      loadFlags();
    }
  }, [user, permissions]);

  const loadFlags = async () => {
    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .order("name");

      if (error) throw error;
      setFlags(data as FeatureFlag[]);
    } catch (error) {
      console.error("Error loading feature flags:", error);
      toast.error("Failed to load feature flags");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (flag: FeatureFlag) => {
    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({ is_enabled: !flag.is_enabled })
        .eq("id", flag.id);

      if (error) throw error;

      setFlags(flags.map(f => 
        f.id === flag.id ? { ...f, is_enabled: !f.is_enabled } : f
      ));
      toast.success(`${flag.name} ${!flag.is_enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error("Error toggling flag:", error);
      toast.error("Failed to update feature flag");
    }
  };

  const handleTogglePaid = async (flag: FeatureFlag) => {
    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({ is_paid: !flag.is_paid })
        .eq("id", flag.id);

      if (error) throw error;

      setFlags(flags.map(f => 
        f.id === flag.id ? { ...f, is_paid: !f.is_paid } : f
      ));
      toast.success(`${flag.name} marked as ${!flag.is_paid ? 'paid' : 'free'} feature`);
    } catch (error) {
      console.error("Error toggling paid status:", error);
      toast.error("Failed to update feature flag");
    }
  };

  const openEditDialog = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setFormKey(flag.key);
    setFormName(flag.name);
    setFormDescription(flag.description || "");
    setFormBetaNote(flag.beta_note || "");
    setFormIsEnabled(flag.is_enabled);
    setFormIsPaid(flag.is_paid);
    setEditDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingFlag(null);
    setFormKey("");
    setFormName("");
    setFormDescription("");
    setFormBetaNote("");
    setFormIsEnabled(false);
    setFormIsPaid(false);
    setAddDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFlag) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("feature_flags")
        .update({
          name: formName,
          description: formDescription || null,
          beta_note: formBetaNote || null,
          is_enabled: formIsEnabled,
          is_paid: formIsPaid,
        })
        .eq("id", editingFlag.id);

      if (error) throw error;

      toast.success("Feature flag updated");
      setEditDialogOpen(false);
      loadFlags();
    } catch (error) {
      console.error("Error updating flag:", error);
      toast.error("Failed to update feature flag");
    } finally {
      setSaving(false);
    }
  };

  const handleAddFlag = async () => {
    if (!formKey.trim() || !formName.trim()) {
      toast.error("Key and Name are required");
      return;
    }
    setSaving(true);

    try {
      const { error } = await supabase
        .from("feature_flags")
        .insert({
          key: formKey.toLowerCase().replace(/\s+/g, '_'),
          name: formName,
          description: formDescription || null,
          beta_note: formBetaNote || null,
          is_enabled: formIsEnabled,
          is_paid: formIsPaid,
        });

      if (error) throw error;

      toast.success("Feature flag created");
      setAddDialogOpen(false);
      loadFlags();
    } catch (error: any) {
      console.error("Error creating flag:", error);
      if (error.code === '23505') {
        toast.error("A feature with this key already exists");
      } else {
        toast.error("Failed to create feature flag");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFlag = async (flag: FeatureFlag) => {
    if (!confirm(`Are you sure you want to delete "${flag.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("feature_flags")
        .delete()
        .eq("id", flag.id);

      if (error) throw error;

      toast.success("Feature flag deleted");
      loadFlags();
    } catch (error) {
      console.error("Error deleting flag:", error);
      toast.error("Failed to delete feature flag");
    }
  };

  if (authLoading || permsLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Feature Flags</h1>
            </div>
            <p className="text-muted-foreground">
              Manage which features are enabled and which are paid features.
            </p>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Feature
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Enabled</TableHead>
                  <TableHead className="text-center">Paid Feature</TableHead>
                  <TableHead>Beta Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No feature flags configured yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  flags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell className="font-medium">{flag.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{flag.key}</code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {flag.description || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={flag.is_enabled}
                          onCheckedChange={() => handleToggleEnabled(flag)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={flag.is_paid}
                          onCheckedChange={() => handleTogglePaid(flag)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {flag.beta_note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditDialog(flag)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteFlag(flag)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Feature Flag</DialogTitle>
              <DialogDescription>
                Update the settings for this feature flag.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Key (read-only)</Label>
                <Input value={formKey} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Name</Label>
                <Input 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Feature name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={formDescription} 
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What does this feature do?"
                  rows={2}
                />
              </div>
              <div>
                <Label>Beta Note</Label>
                <Textarea 
                  value={formBetaNote} 
                  onChange={(e) => setFormBetaNote(e.target.value)}
                  placeholder="e.g., 'Free during testing. Will be paid after launch.'"
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch 
                  checked={formIsEnabled} 
                  onCheckedChange={setFormIsEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Paid Feature</Label>
                <Switch 
                  checked={formIsPaid} 
                  onCheckedChange={setFormIsPaid}
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

        {/* Add Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Feature Flag</DialogTitle>
              <DialogDescription>
                Create a new feature flag to control feature availability.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Key</Label>
                <Input 
                  value={formKey} 
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g., match_assistant"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier used in code. Lowercase, underscores allowed.
                </p>
              </div>
              <div>
                <Label>Name</Label>
                <Input 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Feature name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={formDescription} 
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What does this feature do?"
                  rows={2}
                />
              </div>
              <div>
                <Label>Beta Note</Label>
                <Textarea 
                  value={formBetaNote} 
                  onChange={(e) => setFormBetaNote(e.target.value)}
                  placeholder="e.g., 'Free during testing. Will be paid after launch.'"
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch 
                  checked={formIsEnabled} 
                  onCheckedChange={setFormIsEnabled}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Paid Feature</Label>
                <Switch 
                  checked={formIsPaid} 
                  onCheckedChange={setFormIsPaid}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddFlag} disabled={saving}>
                {saving ? "Creating..." : "Create Feature"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
