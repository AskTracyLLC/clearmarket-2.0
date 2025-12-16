import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  ClipboardList,
  GripVertical,
  Crown,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { vendorChecklistsCopy } from "@/copy/vendorChecklistsCopy";
import { vendorChecklistAssignmentsCopy } from "@/copy/vendorChecklistAssignmentsCopy";
import { vendorChecklistTemplateCopy } from "@/copy/vendorChecklistTemplateCopy";
import { assignTemplateToRep, ChecklistItemDefinition } from "@/lib/checklists";

interface ChecklistTemplate {
  id: string;
  name: string;
  role: "field_rep" | "vendor" | "both";
  owner_type: "system" | "vendor";
  owner_id: string | null;
  is_default: boolean;
  requires_paid_plan: boolean;
  auto_assign_on_connect: boolean;
  created_at: string;
}

interface TemplateAssignee {
  userId: string;
  anonymousId: string;
  fullName: string | null;
  completedCount: number;
  totalCount: number;
  percent: number;
}

interface ConnectedRep {
  id: string;
  full_name: string | null;
  states: string[];
  already_assigned: boolean;
}

export default function VendorChecklists() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("templates");
  
  // Templates state
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [templateItems, setTemplateItems] = useState<Record<string, ChecklistItemDefinition[]>>({});
  const [templateAssignees, setTemplateAssignees] = useState<Record<string, TemplateAssignee[]>>({});

  // Add item dialog state
  const [addItemTemplateId, setAddItemTemplateId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemRequired, setNewItemRequired] = useState(true);

  // Assign tab state
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null);
  const [connectedReps, setConnectedReps] = useState<ConnectedRep[]>([]);
  const [loadingReps, setLoadingReps] = useState(false);
  const [selectedRepIds, setSelectedRepIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (user) {
      loadTemplates();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (assignTemplateId && activeTab === "assign") {
      loadConnectedReps();
    }
  }, [assignTemplateId, activeTab]);

  const loadTemplates = async () => {
    if (!user) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("owner_type", "vendor")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading templates:", error);
    } else {
      setTemplates((data || []).map(t => ({
        ...t,
        auto_assign_on_connect: (t as any).auto_assign_on_connect ?? false
      })));
    }
    setLoading(false);
  };

  const loadConnectedReps = async () => {
    if (!user || !assignTemplateId) return;
    setLoadingReps(true);

    // Get connected reps
    const { data: connections, error: connError } = await supabase
      .from("vendor_connections")
      .select("field_rep_id")
      .eq("vendor_id", user.id)
      .eq("status", "connected");

    if (connError || !connections) {
      setLoadingReps(false);
      return;
    }

    const repIds = connections.map(c => c.field_rep_id);
    if (repIds.length === 0) {
      setConnectedReps([]);
      setLoadingReps(false);
      return;
    }

    // Get rep profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", repIds);

    // Get rep coverage states
    const { data: coverageData } = await supabase
      .from("rep_coverage_areas")
      .select("user_id, state_code")
      .in("user_id", repIds);

    // Get existing assignments for this template
    const { data: existingAssignments } = await supabase
      .from("user_checklist_assignments")
      .select("user_id")
      .eq("template_id", assignTemplateId)
      .in("user_id", repIds);

    const assignedSet = new Set(existingAssignments?.map(a => a.user_id) || []);

    // Build states map
    const statesMap = new Map<string, Set<string>>();
    coverageData?.forEach(c => {
      if (!statesMap.has(c.user_id)) {
        statesMap.set(c.user_id, new Set());
      }
      statesMap.get(c.user_id)!.add(c.state_code);
    });

    const reps: ConnectedRep[] = (profiles || []).map(p => ({
      id: p.id,
      full_name: p.full_name,
      states: Array.from(statesMap.get(p.id) || []).sort(),
      already_assigned: assignedSet.has(p.id),
    }));

    setConnectedReps(reps);
    setSelectedRepIds(new Set());
    setLoadingReps(false);
  };

  const handleCreateTemplate = async () => {
    if (!user || !newTemplateName.trim()) return;
    setCreating(true);

    const { data, error } = await supabase
      .from("checklist_templates")
      .insert({
        name: newTemplateName.trim(),
        role: "field_rep",
        owner_type: "vendor",
        owner_id: user.id,
        is_default: false,
        requires_paid_plan: true,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Failed to create template");
    } else {
      toast.success(vendorChecklistsCopy.toasts.templateCreated);
      setNewTemplateName("");
      setShowCreateDialog(false);
      loadTemplates();
    }
    setCreating(false);
  };

  const loadTemplateData = async (templateId: string) => {
    const [{ data: items }, assignees] = await Promise.all([
      supabase
        .from("checklist_items")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order", { ascending: true }),
      loadAssignees(templateId),
    ]);
    
    setTemplateItems(prev => ({ ...prev, [templateId]: items || [] }));
    setTemplateAssignees(prev => ({ ...prev, [templateId]: assignees }));
  };

  const loadAssignees = async (templateId: string): Promise<TemplateAssignee[]> => {
    const { data: assignments } = await supabase
      .from("user_checklist_assignments")
      .select(`user_id, user_checklist_items(status)`)
      .eq("template_id", templateId);

    if (!assignments) return [];

    const { count: totalItems } = await supabase
      .from("checklist_items")
      .select("*", { count: "exact", head: true })
      .eq("template_id", templateId);

    const results: TemplateAssignee[] = [];

    for (const assignment of assignments) {
      const { data: repProfile } = await supabase
        .from("rep_profile")
        .select("anonymous_id")
        .eq("user_id", assignment.user_id)
        .maybeSingle();

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", assignment.user_id)
        .maybeSingle();

      const items = (assignment.user_checklist_items as Array<{ status: string }>) || [];
      const completedCount = items.filter(i => i.status === "completed").length;
      const total = totalItems || items.length;

      results.push({
        userId: assignment.user_id,
        anonymousId: repProfile?.anonymous_id || "FieldRep#???",
        fullName: profile?.full_name || null,
        completedCount,
        totalCount: total,
        percent: total > 0 ? Math.round((completedCount / total) * 100) : 0,
      });
    }

    return results;
  };

  const handleToggleExpand = async (templateId: string) => {
    if (expandedTemplate === templateId) {
      setExpandedTemplate(null);
    } else {
      setExpandedTemplate(templateId);
      if (!templateItems[templateId]) {
        await loadTemplateData(templateId);
      }
    }
  };

  const handleAddItem = async () => {
    if (!addItemTemplateId || !newItemTitle.trim()) return;

    const currentItems = templateItems[addItemTemplateId] || [];
    const sortOrder = currentItems.length + 1;

    const { error } = await supabase
      .from("checklist_items")
      .insert({
        template_id: addItemTemplateId,
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || null,
        sort_order: sortOrder,
        role: "field_rep",
        is_required: newItemRequired,
      });

    if (error) {
      toast.error("Failed to add item");
    } else {
      toast.success(vendorChecklistsCopy.toasts.itemAdded);
      setNewItemTitle("");
      setNewItemDescription("");
      setNewItemRequired(true);
      setAddItemTemplateId(null);
      await loadTemplateData(addItemTemplateId);
    }
  };

  const handleDeleteItem = async (templateId: string, itemId: string) => {
    const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
    if (!error) {
      toast.success(vendorChecklistsCopy.toasts.itemDeleted);
      await loadTemplateData(templateId);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const { error } = await supabase.from("checklist_templates").delete().eq("id", templateId);
    if (!error) {
      toast.success(vendorChecklistsCopy.toasts.templateDeleted);
      setExpandedTemplate(null);
      loadTemplates();
    }
  };

  const handleToggleAutoAssign = async (templateId: string, enabled: boolean) => {
    const { error } = await supabase
      .from("checklist_templates")
      .update({ auto_assign_on_connect: enabled })
      .eq("id", templateId);

    if (!error) {
      setTemplates(prev =>
        prev.map(t => (t.id === templateId ? { ...t, auto_assign_on_connect: enabled } : t))
      );
      toast.success(enabled ? "Auto-assign enabled" : "Auto-assign disabled");
    }
  };

  const toggleRepSelection = (repId: string) => {
    setSelectedRepIds(prev => {
      const next = new Set(prev);
      if (next.has(repId)) {
        next.delete(repId);
      } else {
        next.add(repId);
      }
      return next;
    });
  };

  const filteredReps = connectedReps.filter(rep => {
    if (!searchQuery.trim()) return true;
    return rep.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const eligibleReps = filteredReps.filter(r => !r.already_assigned);
  const allSelected = eligibleReps.length > 0 && eligibleReps.every(r => selectedRepIds.has(r.id));
  const selectedCount = filteredReps.filter(r => selectedRepIds.has(r.id)).length;

  const toggleAllReps = () => {
    if (allSelected) {
      setSelectedRepIds(prev => {
        const next = new Set(prev);
        filteredReps.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRepIds(prev => {
        const next = new Set(prev);
        eligibleReps.forEach(r => next.add(r.id));
        return next;
      });
    }
  };

  const handleBulkAssign = async () => {
    if (!assignTemplateId || selectedRepIds.size === 0) return;
    setAssigning(true);

    let successCount = 0;
    for (const repId of selectedRepIds) {
      const rep = connectedReps.find(r => r.id === repId);
      if (rep?.already_assigned) continue;

      const assignmentId = await assignTemplateToRep(supabase, assignTemplateId, repId);
      if (assignmentId) successCount++;
    }

    if (successCount > 0) {
      toast.success(
        vendorChecklistAssignmentsCopy.actions.toast.success.replace("{count}", String(successCount))
      );
      loadConnectedReps();
    } else {
      toast.error(vendorChecklistAssignmentsCopy.actions.toast.error);
    }

    setSelectedRepIds(new Set());
    setConfirmAssignOpen(false);
    setAssigning(false);
  };

  const assignTemplate = templates.find(t => t.id === assignTemplateId);
  const copy = vendorChecklistsCopy;

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Onboarding Checklists
              <Badge variant="secondary" className="text-xs">
                <Crown className="h-3 w-3 mr-1" />
                {copy.manager.paidBadge}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">{copy.manager.subtitle}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="assign">{vendorChecklistAssignmentsCopy.tabTitle}</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    {copy.manager.newTemplateButton}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{copy.editor.createDialogTitle}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>{copy.editor.templateNameLabel}</Label>
                      <Input
                        placeholder={copy.editor.templateNamePlaceholder}
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        {copy.editor.cancelButton}
                      </Button>
                      <Button onClick={handleCreateTemplate} disabled={creating || !newTemplateName.trim()}>
                        {creating ? copy.editor.creatingButton : copy.editor.createButton}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
              </Card>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h4 className="font-medium mb-2">{copy.manager.noTemplates}</h4>
                  <p className="text-sm text-muted-foreground mb-4">{copy.manager.noTemplatesHelper}</p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {copy.manager.createFirstTemplateButton}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => {
                  const isExpanded = expandedTemplate === template.id;
                  const items = templateItems[template.id] || [];
                  const assignees = templateAssignees[template.id] || [];

                  return (
                    <Card key={template.id} className="overflow-hidden">
                      <Collapsible open={isExpanded} onOpenChange={() => handleToggleExpand(template.id)}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                  {template.name}
                                  {template.auto_assign_on_connect && (
                                    <Badge variant="outline" className="text-xs">Onboarding</Badge>
                                  )}
                                </CardTitle>
                                <CardDescription className="text-sm mt-1">
                                  {items.length} {copy.templateList.itemsLabel} • {assignees.length} {copy.templateList.assignedRepsLabel}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTemplate(template.id);
                                  }}
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <CardContent className="pt-0 space-y-4">
                            {/* Checklist Type section */}
                            <div className="p-4 border rounded-lg bg-muted/30">
                              <h4 className="text-sm font-medium mb-1">{vendorChecklistTemplateCopy.sectionTitle}</h4>
                              <p className="text-xs text-muted-foreground mb-3">{vendorChecklistTemplateCopy.sectionHelper}</p>
                              <div className="space-y-3">
                                <label className="flex items-start gap-3 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`type-${template.id}`}
                                    checked={template.auto_assign_on_connect}
                                    onChange={() => handleToggleAutoAssign(template.id, true)}
                                    className="mt-1"
                                  />
                                  <div>
                                    <div className="font-medium text-sm">{vendorChecklistTemplateCopy.options.onboardingLabel}</div>
                                    <div className="text-xs text-muted-foreground">{vendorChecklistTemplateCopy.options.onboardingDescription}</div>
                                  </div>
                                </label>
                                <label className="flex items-start gap-3 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`type-${template.id}`}
                                    checked={!template.auto_assign_on_connect}
                                    onChange={() => handleToggleAutoAssign(template.id, false)}
                                    className="mt-1"
                                  />
                                  <div>
                                    <div className="font-medium text-sm">{vendorChecklistTemplateCopy.options.manualLabel}</div>
                                    <div className="text-xs text-muted-foreground">{vendorChecklistTemplateCopy.options.manualDescription}</div>
                                  </div>
                                </label>
                              </div>
                              <p className="text-xs text-muted-foreground mt-3 italic">{vendorChecklistTemplateCopy.infoNote}</p>
                            </div>

                            <Tabs defaultValue="items" className="w-full">
                              <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="items">{copy.editor.checklistItemsTab}</TabsTrigger>
                                <TabsTrigger value="assignees">{copy.editor.assignedRepsTab} ({assignees.length})</TabsTrigger>
                              </TabsList>

                              <TabsContent value="items" className="space-y-3">
                                {items.map((item) => (
                                  <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                                    <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{item.title}</span>
                                        {item.is_required && (
                                          <Badge variant="secondary" className="text-xs">{copy.itemEditor.requiredBadge}</Badge>
                                        )}
                                      </div>
                                      {item.description && (
                                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteItem(template.id, item.id)}
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}

                                <Dialog open={addItemTemplateId === template.id} onOpenChange={(open) => setAddItemTemplateId(open ? template.id : null)}>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full">
                                      <Plus className="h-4 w-4 mr-1" />
                                      {copy.editor.addItemButton}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>{copy.itemEditor.addItemDialogTitle}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                      <div>
                                        <Label>{copy.itemEditor.titleLabel}</Label>
                                        <Input
                                          placeholder={copy.itemEditor.titlePlaceholder}
                                          value={newItemTitle}
                                          onChange={(e) => setNewItemTitle(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <Label>{copy.itemEditor.descriptionLabel}</Label>
                                        <Textarea
                                          placeholder={copy.itemEditor.descriptionPlaceholder}
                                          value={newItemDescription}
                                          onChange={(e) => setNewItemDescription(e.target.value)}
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Switch checked={newItemRequired} onCheckedChange={setNewItemRequired} />
                                        <Label>{copy.itemEditor.requiredToggleLabel}</Label>
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setAddItemTemplateId(null)}>
                                          {copy.itemEditor.cancelButton}
                                        </Button>
                                        <Button onClick={handleAddItem} disabled={!newItemTitle.trim()}>
                                          {copy.itemEditor.addButton}
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TabsContent>

                              <TabsContent value="assignees">
                                {assignees.length === 0 ? (
                                  <div className="text-center py-8 text-muted-foreground">
                                    <Users className="h-8 w-8 mx-auto mb-2" />
                                    <p className="text-sm">{copy.repStatus.noAssignments}</p>
                                    <p className="text-xs mt-1">{copy.repStatus.noAssignmentsHelper}</p>
                                  </div>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Field Rep</TableHead>
                                        <TableHead className="text-right">{copy.repStatus.completionLabel}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {assignees.map((assignee) => (
                                        <TableRow key={assignee.userId}>
                                          <TableCell>
                                            <div>
                                              <span className="font-medium">{assignee.anonymousId}</span>
                                              {assignee.fullName && (
                                                <span className="text-muted-foreground ml-2">({assignee.fullName})</span>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-3">
                                              <Progress value={assignee.percent} className="w-20 h-2" />
                                              <span className="text-sm font-medium w-12">{assignee.percent}%</span>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </TabsContent>
                            </Tabs>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assign" className="space-y-4">
            {templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Create a template first to assign it to your reps.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Select Template</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {templates.map((template) => (
                        <Button
                          key={template.id}
                          variant={assignTemplateId === template.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAssignTemplateId(template.id)}
                        >
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {!assignTemplateId ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      {vendorChecklistAssignmentsCopy.selectTemplatePrompt}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{vendorChecklistAssignmentsCopy.yourReps.header}</CardTitle>
                      <CardDescription>{vendorChecklistAssignmentsCopy.yourReps.helper}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        placeholder={vendorChecklistAssignmentsCopy.yourReps.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />

                      <div className="flex items-center gap-2 py-2 border-b">
                        <Checkbox
                          id="masterReps"
                          checked={allSelected && eligibleReps.length > 0}
                          disabled={eligibleReps.length === 0}
                          onCheckedChange={toggleAllReps}
                        />
                        <Label htmlFor="masterReps" className="text-sm font-medium cursor-pointer">
                          {vendorChecklistAssignmentsCopy.yourReps.masterLabel}
                        </Label>
                      </div>

                      {loadingReps ? (
                        <div className="py-8 text-center text-muted-foreground">Loading...</div>
                      ) : connectedReps.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                          {vendorChecklistAssignmentsCopy.yourReps.empty.noUsers}
                        </div>
                      ) : filteredReps.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                          {vendorChecklistAssignmentsCopy.yourReps.empty.noMatches}
                        </div>
                      ) : (
                        <ScrollArea className="h-[280px]">
                          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                            {filteredReps.map((rep) => {
                              const statesLabel = rep.states.length > 0 ? ` (${rep.states.join(", ")})` : "";
                              const displayName = rep.full_name || "Unknown";

                              return (
                                <div
                                  key={rep.id}
                                  className={`flex items-start gap-2 py-1.5 px-1 rounded hover:bg-muted/50 ${rep.already_assigned ? "opacity-50" : "cursor-pointer"}`}
                                  onClick={() => !rep.already_assigned && toggleRepSelection(rep.id)}
                                >
                                  <Checkbox
                                    checked={selectedRepIds.has(rep.id)}
                                    disabled={rep.already_assigned}
                                    onCheckedChange={() => toggleRepSelection(rep.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5 shrink-0"
                                  />
                                  <span className="text-sm break-words">
                                    {displayName}{statesLabel}
                                    {rep.already_assigned && (
                                      <Badge variant="outline" className="text-xs ml-1">
                                        {vendorChecklistAssignmentsCopy.badges.alreadyAssigned}
                                      </Badge>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}

                      <div className="pt-2 border-t text-sm text-muted-foreground">
                        {selectedCount === 0
                          ? vendorChecklistAssignmentsCopy.yourReps.footer.noneSelected
                          : vendorChecklistAssignmentsCopy.yourReps.footer.someSelected.replace("{count}", String(selectedCount))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {assignTemplateId && (
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      {selectedRepIds.size === 0
                        ? vendorChecklistAssignmentsCopy.actions.assignDisabled
                        : `${selectedRepIds.size} rep(s) selected`}
                    </div>
                    <Button onClick={() => setConfirmAssignOpen(true)} disabled={assigning || selectedRepIds.size === 0}>
                      {assigning ? "Assigning..." : vendorChecklistAssignmentsCopy.actions.assignButton}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog open={confirmAssignOpen} onOpenChange={setConfirmAssignOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{vendorChecklistAssignmentsCopy.actions.confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {vendorChecklistAssignmentsCopy.actions.confirm.description
                  .replace("{templateName}", assignTemplate?.name || "")
                  .replace("{count}", String(selectedRepIds.size))}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{vendorChecklistAssignmentsCopy.actions.confirm.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkAssign} disabled={assigning}>
                {assigning ? "Assigning..." : vendorChecklistAssignmentsCopy.actions.confirm.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AuthenticatedLayout>
  );
}
