import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Plus, Pencil, Trash2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SYSTEM_MESSAGE_TEMPLATES_REP } from "@/lib/systemMessageTemplatesRep";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";


interface RepTemplate {
  id: string;
  name: string;
  body: string;
  scope: string;
  created_at: string;
  updated_at: string;
}

export default function RepMessageTemplates() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<RepTemplate[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RepTemplate | null>(null);
  const [formData, setFormData] = useState({ name: "", body: "" });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    checkRepAccess();
  }, [user, authLoading, navigate]);

  async function checkRepAccess() {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep, is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_fieldrep && !profile?.is_admin) {
      toast({
        title: "Access Denied",
        description: "This page is only available to field reps",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    loadTemplates();
  }

  async function loadTemplates() {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("vendor_message_templates")
      .select("*")
      .eq("user_id", user.id)
      .eq("target_role", "rep")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading templates:", error);
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      });
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  }

  function openCreateDialog() {
    setIsCreating(true);
    setEditingTemplate(null);
    setFormData({ name: "", body: "" });
    setEditDialogOpen(true);
  }

  function openEditDialog(template: RepTemplate) {
    setIsCreating(false);
    setEditingTemplate(template);
    setFormData({ name: template.name, body: template.body });
    setEditDialogOpen(true);
  }

  async function handleSaveTemplate() {
    if (!user || !formData.name.trim() || !formData.body.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and body are required",
        variant: "destructive",
      });
      return;
    }

    if (isCreating) {
      // Create new template
      const { error } = await supabase
        .from("vendor_message_templates")
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          body: formData.body.trim(),
          scope: "seeking_coverage",
          target_role: "rep",
        });

      if (error) {
        console.error("Error creating template:", error);
        toast({
          title: "Error",
          description: "Failed to create template",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Template created successfully",
        });
        setEditDialogOpen(false);
        loadTemplates();
      }
    } else if (editingTemplate) {
      // Update existing template
      const { error } = await supabase
        .from("vendor_message_templates")
        .update({
          name: formData.name.trim(),
          body: formData.body.trim(),
        })
        .eq("id", editingTemplate.id);

      if (error) {
        console.error("Error updating template:", error);
        toast({
          title: "Error",
          description: "Failed to update template",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Template updated successfully",
        });
        setEditDialogOpen(false);
        loadTemplates();
      }
    }
  }

  async function handleDeleteTemplate() {
    if (!templateToDelete) return;

    const { error } = await supabase
      .from("vendor_message_templates")
      .delete()
      .eq("id", templateToDelete);

    if (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      loadTemplates();
    }
    
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Message Templates</h1>
            <p className="text-muted-foreground mt-1">
              Manage your message templates for Seeking Coverage conversations
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        {/* Smart Placeholders Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Smart Placeholders</AlertTitle>
          <AlertDescription className="space-y-2 mt-2">
            <p>Use placeholders in your templates that will be automatically replaced when inserted:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Post-related:</p>
                <ul className="space-y-0.5 text-muted-foreground font-mono text-xs">
                  <li><code className="bg-muted px-1 rounded">{"{{POST_TITLE}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{POST_STATE_CODE}}"}</code> (e.g., WI)</li>
                  <li><code className="bg-muted px-1 rounded">{"{{POST_COUNTY}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{POST_RATE}}"}</code> (formatted pricing)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Vendor-related:</p>
                <ul className="space-y-0.5 text-muted-foreground font-mono text-xs">
                  <li><code className="bg-muted px-1 rounded">{"{{VENDOR_CONTACT_FIRST_NAME}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{VENDOR_ANON}}"}</code> (e.g., Vendor#1)</li>
                  <li><code className="bg-muted px-1 rounded">{"{{VENDOR_COMPANY}}"}</code></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Your Rep Profile:</p>
                <ul className="space-y-0.5 text-muted-foreground font-mono text-xs">
                  <li><code className="bg-muted px-1 rounded">{"{{REP_ANON}}"}</code> (your anonymous ID)</li>
                  <li><code className="bg-muted px-1 rounded">{"{{REP_STATE}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{REP_SYSTEMS}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{REP_INSPECTION_TYPES}}"}</code></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Generic:</p>
                <ul className="space-y-0.5 text-muted-foreground font-mono text-xs">
                  <li><code className="bg-muted px-1 rounded">{"{{TODAY_DATE}}"}</code></li>
                </ul>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Your Templates */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Your Templates</h2>
            <p className="text-sm text-muted-foreground">
              Custom templates you've created for quick messaging
            </p>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No custom templates yet. Create your first template to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Seeking Coverage
                          </Badge>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(template)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTemplateToDelete(template.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {template.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Recommended Templates */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Recommended Templates</h2>
            <p className="text-sm text-muted-foreground">
              Pre-written templates you can use in your conversations (read-only)
            </p>
          </div>

          <div className="grid gap-4">
            {SYSTEM_MESSAGE_TEMPLATES_REP.map((template, index) => (
              <Card key={index} className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {template.name}
                    <Badge variant="secondary" className="text-xs">System</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {template.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this template? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTemplate}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create/Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isCreating ? "Create New Template" : "Edit Template"}
              </DialogTitle>
              <DialogDescription>
                {isCreating 
                  ? "Create a reusable message template for Seeking Coverage conversations."
                  : "Update your message template."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Quick Intro, Rate Discussion"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="body">Message Body</Label>
                <Textarea
                  id="body"
                  placeholder="Enter your message template..."
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="min-h-[200px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate}>
                {isCreating ? "Create Template" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
