import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Users,
  ClipboardList,
  GripVertical,
  Crown,
} from "lucide-react";
import { useVendorChecklists, TemplateAssignee } from "@/hooks/useVendorChecklists";
import { ChecklistItemDefinition } from "@/lib/checklists";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { vendorChecklistsCopy } from "@/copy/vendorChecklistsCopy";

interface VendorChecklistManagerProps {
  className?: string;
}

export function VendorChecklistManager({ className }: VendorChecklistManagerProps) {
  const { toast } = useToast();
  const {
    templates,
    loading,
    createTemplate,
    addItem,
    getItems,
    getAssignees,
    deleteTemplate,
    updateItem,
    deleteItem,
    reload,
  } = useVendorChecklists();

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

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setCreating(true);
    const id = await createTemplate(newTemplateName.trim());
    if (id) {
      toast({ title: "Template created", description: "Your onboarding checklist template has been created." });
      setNewTemplateName("");
      setShowCreateDialog(false);
    } else {
      toast({ title: "Error", description: "Failed to create template.", variant: "destructive" });
    }
    setCreating(false);
  };

  const loadTemplateData = async (templateId: string) => {
    const [items, assignees] = await Promise.all([
      getItems(templateId),
      getAssignees(templateId),
    ]);
    setTemplateItems(prev => ({ ...prev, [templateId]: items }));
    setTemplateAssignees(prev => ({ ...prev, [templateId]: assignees }));
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
    
    const id = await addItem(addItemTemplateId, newItemTitle.trim(), newItemDescription.trim(), sortOrder, newItemRequired);
    if (id) {
      toast({ title: "Item added", description: "Checklist item has been added." });
      setNewItemTitle("");
      setNewItemDescription("");
      setNewItemRequired(true);
      setAddItemTemplateId(null);
      await loadTemplateData(addItemTemplateId);
    } else {
      toast({ title: "Error", description: "Failed to add item.", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (templateId: string, itemId: string) => {
    const success = await deleteItem(itemId);
    if (success) {
      toast({ title: "Item deleted" });
      await loadTemplateData(templateId);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const success = await deleteTemplate(templateId);
    if (success) {
      toast({ title: "Template deleted" });
      setExpandedTemplate(null);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading checklists...
        </CardContent>
      </Card>
    );
  }

  const copy = vendorChecklistsCopy;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {copy.manager.header}
            <Badge variant="secondary" className="text-xs">
              <Crown className="h-3 w-3 mr-1" />
              {copy.manager.paidBadge}
            </Badge>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {copy.manager.subtitle}
          </p>
        </div>
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

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">{copy.manager.noTemplates}</h4>
            <p className="text-sm text-muted-foreground mb-4">
              {copy.manager.noTemplatesHelper}
            </p>
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
                          <CardTitle className="text-base">{template.name}</CardTitle>
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
                    <CardContent className="pt-0">
                      <Tabs defaultValue="items" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                          <TabsTrigger value="items">{copy.editor.checklistItemsTab}</TabsTrigger>
                          <TabsTrigger value="assignees">
                            {copy.editor.assignedRepsTab} ({assignees.length})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="items" className="space-y-3">
                          {items.map((item, index) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 border rounded-lg"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{item.title}</span>
                                  {item.is_required && (
                                    <Badge variant="secondary" className="text-xs">{copy.itemEditor.requiredBadge}</Badge>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {item.description}
                                  </p>
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

                          {/* Add Item */}
                          <Dialog
                            open={addItemTemplateId === template.id}
                            onOpenChange={(open) => setAddItemTemplateId(open ? template.id : null)}
                          >
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
                                  <Switch
                                    checked={newItemRequired}
                                    onCheckedChange={setNewItemRequired}
                                  />
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
                              <p className="text-xs mt-1">
                                {copy.repStatus.noAssignmentsHelper}
                              </p>
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
                                          <span className="text-muted-foreground ml-2">
                                            ({assignee.fullName})
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-3">
                                        <Progress value={assignee.percent} className="w-20 h-2" />
                                        <span className="text-sm font-medium w-12">
                                          {assignee.percent}%
                                        </span>
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

      {/* Add Item Dialog */}
    </div>
  );
}
