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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, Pencil, Trash2, GripVertical, Users } from "lucide-react";
import { toast } from "sonner";

interface ChecklistTemplate {
  id: string;
  name: string;
  role: "field_rep" | "vendor" | "both";
  owner_type: "system" | "vendor";
  owner_id: string | null;
  is_default: boolean;
  requires_paid_plan: boolean;
  created_at: string;
}

interface ChecklistItem {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  auto_track_key: string | null;
  sort_order: number;
  is_required: boolean;
  role: "field_rep" | "vendor" | "both";
}

interface CompletionStats {
  templateId: string;
  totalAssigned: number;
  fullyCompleted: number;
  avgPercentComplete: number;
}

export default function AdminChecklists() {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [stats, setStats] = useState<CompletionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Dialog states
  const [editTemplateOpen, setEditTemplateOpen] = useState(false);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);

  // Template form state
  const [formTemplateName, setFormTemplateName] = useState("");
  const [formTemplateRole, setFormTemplateRole] = useState<"field_rep" | "vendor" | "both">("field_rep");
  const [formTemplateIsDefault, setFormTemplateIsDefault] = useState(false);

  // Item form state
  const [formItemTitle, setFormItemTitle] = useState("");
  const [formItemDescription, setFormItemDescription] = useState("");
  const [formItemAutoTrackKey, setFormItemAutoTrackKey] = useState("");
  const [formItemIsRequired, setFormItemIsRequired] = useState(true);
  const [formItemRole, setFormItemRole] = useState<"field_rep" | "vendor" | "both">("both");

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
      loadTemplates();
    }
  }, [user, permissions]);

  useEffect(() => {
    if (selectedTemplateId) {
      loadItems(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("owner_type", "system")
        .order("role")
        .order("name");

      if (error) throw error;
      setTemplates(data as ChecklistTemplate[]);

      // Load completion stats
      await loadCompletionStats(data.map(t => t.id));

      // Auto-select first template
      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load checklist templates");
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order");

      if (error) throw error;
      setItems(data as ChecklistItem[]);
    } catch (error) {
      console.error("Error loading items:", error);
      toast.error("Failed to load checklist items");
    }
  };

  const loadCompletionStats = async (templateIds: string[]) => {
    try {
      // Get assignment counts and completion for each template
      const statsPromises = templateIds.map(async (templateId) => {
        // Count total assignments
        const { count: totalAssigned } = await supabase
          .from("user_checklist_assignments")
          .select("*", { count: "exact", head: true })
          .eq("template_id", templateId);

        // Get all assignments with their items for completion calculation
        const { data: assignments } = await supabase
          .from("user_checklist_assignments")
          .select(`
            id,
            user_checklist_items (
              status
            )
          `)
          .eq("template_id", templateId);

        let fullyCompleted = 0;
        let totalPercent = 0;

        if (assignments && assignments.length > 0) {
          assignments.forEach((a: any) => {
            const items = a.user_checklist_items || [];
            const completed = items.filter((i: any) => i.status === "completed").length;
            const percent = items.length > 0 ? (completed / items.length) * 100 : 0;
            totalPercent += percent;
            if (percent === 100) fullyCompleted++;
          });
        }

        return {
          templateId,
          totalAssigned: totalAssigned || 0,
          fullyCompleted,
          avgPercentComplete: assignments && assignments.length > 0 
            ? Math.round(totalPercent / assignments.length) 
            : 0
        };
      });

      const results = await Promise.all(statsPromises);
      setStats(results);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const getStatsForTemplate = (templateId: string) => {
    return stats.find(s => s.templateId === templateId);
  };

  // Template CRUD
  const openAddTemplateDialog = () => {
    setEditingTemplate(null);
    setFormTemplateName("");
    setFormTemplateRole("field_rep");
    setFormTemplateIsDefault(false);
    setAddTemplateOpen(true);
  };

  const openEditTemplateDialog = (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setFormTemplateName(template.name);
    setFormTemplateRole(template.role);
    setFormTemplateIsDefault(template.is_default);
    setEditTemplateOpen(true);
  };

  const handleSaveTemplate = async (isNew: boolean) => {
    if (!formTemplateName.trim()) {
      toast.error("Template name is required");
      return;
    }
    setSaving(true);

    try {
      if (isNew) {
        const { error } = await supabase
          .from("checklist_templates")
          .insert({
            name: formTemplateName,
            role: formTemplateRole,
            owner_type: "system",
            is_default: formTemplateIsDefault,
            requires_paid_plan: false,
          });
        if (error) throw error;
        toast.success("Template created");
        setAddTemplateOpen(false);
      } else if (editingTemplate) {
        const { error } = await supabase
          .from("checklist_templates")
          .update({
            name: formTemplateName,
            role: formTemplateRole,
            is_default: formTemplateIsDefault,
          })
          .eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Template updated");
        setEditTemplateOpen(false);
      }
      await loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: ChecklistTemplate) => {
    if (!confirm(`Delete "${template.name}"? This will remove all items and assignments.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("checklist_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;
      toast.success("Template deleted");
      if (selectedTemplateId === template.id) {
        setSelectedTemplateId(null);
        setItems([]);
      }
      await loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  // Item CRUD
  const openAddItemDialog = () => {
    setEditingItem(null);
    setFormItemTitle("");
    setFormItemDescription("");
    setFormItemAutoTrackKey("");
    setFormItemIsRequired(true);
    setFormItemRole("both");
    setAddItemOpen(true);
  };

  const openEditItemDialog = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormItemTitle(item.title);
    setFormItemDescription(item.description || "");
    setFormItemAutoTrackKey(item.auto_track_key || "");
    setFormItemIsRequired(item.is_required);
    setFormItemRole(item.role);
    setEditItemOpen(true);
  };

  const handleSaveItem = async (isNew: boolean) => {
    if (!formItemTitle.trim()) {
      toast.error("Item title is required");
      return;
    }
    if (!selectedTemplateId) {
      toast.error("No template selected");
      return;
    }
    setSaving(true);

    try {
      if (isNew) {
        // Get next sort order
        const maxOrder = items.reduce((max, i) => Math.max(max, i.sort_order), -1);
        
        const { error } = await supabase
          .from("checklist_items")
          .insert({
            template_id: selectedTemplateId,
            title: formItemTitle,
            description: formItemDescription || null,
            auto_track_key: formItemAutoTrackKey || null,
            is_required: formItemIsRequired,
            role: formItemRole,
            sort_order: maxOrder + 1,
          });
        if (error) throw error;
        toast.success("Item added");
        setAddItemOpen(false);
      } else if (editingItem) {
        const { error } = await supabase
          .from("checklist_items")
          .update({
            title: formItemTitle,
            description: formItemDescription || null,
            auto_track_key: formItemAutoTrackKey || null,
            is_required: formItemIsRequired,
            role: formItemRole,
          })
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Item updated");
        setEditItemOpen(false);
      }
      await loadItems(selectedTemplateId);
    } catch (error) {
      console.error("Error saving item:", error);
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item: ChecklistItem) => {
    if (!confirm(`Delete "${item.title}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      toast.success("Item deleted");
      if (selectedTemplateId) {
        await loadItems(selectedTemplateId);
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item");
    }
  };

  const handleMoveItem = async (item: ChecklistItem, direction: "up" | "down") => {
    const currentIndex = items.findIndex(i => i.id === item.id);
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;

    const swapItem = items[newIndex];
    
    try {
      await supabase
        .from("checklist_items")
        .update({ sort_order: swapItem.sort_order })
        .eq("id", item.id);
      
      await supabase
        .from("checklist_items")
        .update({ sort_order: item.sort_order })
        .eq("id", swapItem.id);

      if (selectedTemplateId) {
        await loadItems(selectedTemplateId);
      }
    } catch (error) {
      console.error("Error reordering items:", error);
      toast.error("Failed to reorder items");
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

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
              <ClipboardList className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Checklists</h1>
            </div>
            <p className="text-muted-foreground">
              Manage system onboarding checklists for Field Reps and Vendors.
            </p>
          </div>
          <Button onClick={openAddTemplateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Template
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Templates List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Templates</CardTitle>
                <CardDescription className="text-sm">Select a template to edit its items</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {templates.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No templates yet.
                    </div>
                  ) : (
                    templates.map((template) => {
                      const templateStats = getStatsForTemplate(template.id);
                      const isSelected = selectedTemplateId === template.id;
                      return (
                        <div
                          key={template.id}
                          className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                            isSelected ? "bg-muted" : ""
                          }`}
                          onClick={() => setSelectedTemplateId(template.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{template.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {template.role === "field_rep" ? "Rep" : template.role === "vendor" ? "Vendor" : "Both"}
                                </Badge>
                                {template.is_default && (
                                  <Badge variant="secondary" className="text-xs">Default</Badge>
                                )}
                              </div>
                              {templateStats && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <Users className="inline w-3 h-3 mr-1" />
                                  {templateStats.totalAssigned} assigned · {templateStats.avgPercentComplete}% avg
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditTemplateDialog(template);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTemplate(template);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items Editor */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {selectedTemplate ? selectedTemplate.name : "Select a template"}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {selectedTemplate ? `${items.length} items` : "Choose a template from the list"}
                    </CardDescription>
                  </div>
                  {selectedTemplate && (
                    <Button size="sm" onClick={openAddItemDialog}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedTemplate ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Select a template to view and edit its items.
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No items in this template yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Auto-Track Key</TableHead>
                        <TableHead className="text-center">Required</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="w-10">
                            <div className="flex flex-col gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                disabled={index === 0}
                                onClick={() => handleMoveItem(item, "up")}
                              >
                                ▲
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                disabled={index === items.length - 1}
                                onClick={() => handleMoveItem(item, "down")}
                              >
                                ▼
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-xs">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.auto_track_key ? (
                              <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                {item.auto_track_key}
                              </code>
                            ) : (
                              <span className="text-xs text-muted-foreground">Manual</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.is_required ? (
                              <Badge variant="default" className="text-xs">Yes</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditItemDialog(item)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteItem(item)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Template Dialog */}
        <Dialog open={editTemplateOpen} onOpenChange={setEditTemplateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
              <DialogDescription>Update the template settings.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formTemplateName}
                  onChange={(e) => setFormTemplateName(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formTemplateRole} onValueChange={(v: any) => setFormTemplateRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="field_rep">Field Rep</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-assign to new users</Label>
                <Switch checked={formTemplateIsDefault} onCheckedChange={setFormTemplateIsDefault} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTemplateOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSaveTemplate(false)} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Template Dialog */}
        <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Template</DialogTitle>
              <DialogDescription>Create a new system checklist template.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formTemplateName}
                  onChange={(e) => setFormTemplateName(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formTemplateRole} onValueChange={(v: any) => setFormTemplateRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="field_rep">Field Rep</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-assign to new users</Label>
                <Switch checked={formTemplateIsDefault} onCheckedChange={setFormTemplateIsDefault} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddTemplateOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSaveTemplate(true)} disabled={saving}>
                {saving ? "Creating..." : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={editItemOpen} onOpenChange={setEditItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
              <DialogDescription>Update the checklist item.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={formItemTitle}
                  onChange={(e) => setFormItemTitle(e.target.value)}
                  placeholder="Item title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formItemDescription}
                  onChange={(e) => setFormItemDescription(e.target.value)}
                  placeholder="Optional description or help text"
                  rows={2}
                />
              </div>
              <div>
                <Label>Auto-Track Key</Label>
                <Input
                  value={formItemAutoTrackKey}
                  onChange={(e) => setFormItemAutoTrackKey(e.target.value)}
                  placeholder="e.g., profile_completed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for manual completion. Use keys like: password_reset, profile_completed, first_community_post, etc.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Required for completion</Label>
                <Switch checked={formItemIsRequired} onCheckedChange={setFormItemIsRequired} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItemOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSaveItem(false)} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Item Dialog */}
        <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Item</DialogTitle>
              <DialogDescription>Add a new item to this checklist.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={formItemTitle}
                  onChange={(e) => setFormItemTitle(e.target.value)}
                  placeholder="Item title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formItemDescription}
                  onChange={(e) => setFormItemDescription(e.target.value)}
                  placeholder="Optional description or help text"
                  rows={2}
                />
              </div>
              <div>
                <Label>Auto-Track Key</Label>
                <Input
                  value={formItemAutoTrackKey}
                  onChange={(e) => setFormItemAutoTrackKey(e.target.value)}
                  placeholder="e.g., profile_completed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty for manual completion. Use keys like: password_reset, profile_completed, first_community_post, etc.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Required for completion</Label>
                <Switch checked={formItemIsRequired} onCheckedChange={setFormItemIsRequired} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSaveItem(true)} disabled={saving}>
                {saving ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
