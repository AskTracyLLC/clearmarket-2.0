import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Mail, Send, Eye, Search } from "lucide-react";
import { format } from "date-fns";

interface EmailTemplate {
  id: string;
  key: string;
  category: string;
  description: string | null;
  subject_template: string;
  body_template: string;
  placeholders_hint: string | null;
  created_at: string;
  updated_at: string;
}

// Brand colors for preview
const BRAND_COLORS = {
  background: "#0d2626",
  surface: "#1a3333",
  primary: "#e07830",
  text: "#f2f2f2",
  textMuted: "#999999",
  border: "#2d4a4a",
  teal: "#3d7a7a",
};

const CATEGORY_LABELS: Record<string, string> = {
  messages: "Messages",
  connections: "Connections",
  reviews: "Reviews",
  system: "System & Safety",
  digest: "Daily Digest",
};

// Sample data for preview
const SAMPLE_PLACEHOLDERS: Record<string, string> = {
  user_first_name: "Alex",
  actor_name: "FieldRep#123",
  summary: "You have a new connection request",
  snippet: "Hi, I'd love to work with you on upcoming inspections in your area.",
  primary_cta_label: "View Details",
  primary_cta_url: "https://app.useclearmarket.io/dashboard",
  app_base_url: "https://app.useclearmarket.io",
};

// Human-readable placeholder labels
const PLACEHOLDER_LABELS: Record<string, string> = {
  user_first_name: "Recipient's first name (the person getting this email)",
  actor_name: "Sender name (vendor or field rep who triggered this email)",
  snippet: "Extra message text or short note",
  summary: "Summary of the notification",
  primary_cta_label: "Button text",
  primary_cta_url: "Button link URL",
  app_base_url: "Base URL of the app",
};

export default function AdminEmailTemplates() {
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    subject_template: "",
    body_template: "",
  });
  const [saving, setSaving] = useState(false);
  
  // Test email state
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (!permLoading && !permissions.canViewAdminDashboard) {
      toast({ title: "Access denied", variant: "destructive" });
      navigate("/dashboard");
      return;
    }
  }, [user, authLoading, permissions, permLoading, navigate, toast]);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("category", { ascending: true })
      .order("key", { ascending: true });

    if (error) {
      console.error("Error loading templates:", error);
      toast({ title: "Failed to load templates", variant: "destructive" });
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  }

  function openEditDialog(template: EmailTemplate) {
    setSelectedTemplate(template);
    setEditForm({
      description: template.description || "",
      subject_template: template.subject_template,
      body_template: template.body_template,
    });
    setEditDialogOpen(true);
  }

  async function saveTemplate() {
    if (!selectedTemplate) return;
    setSaving(true);

    const { error } = await supabase
      .from("email_templates")
      .update({
        description: editForm.description || null,
        subject_template: editForm.subject_template,
        body_template: editForm.body_template,
      })
      .eq("id", selectedTemplate.id);

    if (error) {
      console.error("Error saving template:", error);
      toast({ title: "Failed to save template", variant: "destructive" });
    } else {
      toast({ title: "Template saved successfully" });
      setEditDialogOpen(false);
      loadTemplates();
    }
    setSaving(false);
  }

  function replacePlaceholders(template: string): string {
    let result = template;
    for (const [key, value] of Object.entries(SAMPLE_PLACEHOLDERS)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  function renderPreview() {
    if (!selectedTemplate) return null;

    const subject = replacePlaceholders(editForm.subject_template);
    const body = replacePlaceholders(editForm.body_template);

    return (
      <div 
        style={{ 
          backgroundColor: BRAND_COLORS.background, 
          padding: "20px", 
          borderRadius: "8px",
          maxHeight: "400px",
          overflow: "auto"
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            background: `linear-gradient(135deg, ${BRAND_COLORS.teal} 0%, ${BRAND_COLORS.background} 100%)`,
            padding: "20px 24px",
            borderRadius: "8px 8px 0 0"
          }}
        >
          <h3 style={{ margin: 0, color: BRAND_COLORS.text, fontSize: "20px", fontWeight: 700 }}>
            ClearMarket
          </h3>
        </div>
        
        {/* Content */}
        <div 
          style={{ 
            backgroundColor: BRAND_COLORS.surface, 
            padding: "24px",
            borderLeft: `1px solid ${BRAND_COLORS.border}`,
            borderRight: `1px solid ${BRAND_COLORS.border}`
          }}
        >
          <h4 style={{ margin: "0 0 16px 0", color: BRAND_COLORS.text, fontSize: "18px" }}>
            {subject}
          </h4>
          <div 
            style={{ color: BRAND_COLORS.text, fontSize: "14px", lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
          <button
            style={{
              marginTop: "20px",
              backgroundColor: BRAND_COLORS.primary,
              color: "#fff",
              padding: "10px 20px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            {SAMPLE_PLACEHOLDERS.primary_cta_label}
          </button>
        </div>
        
        {/* Footer */}
        <div 
          style={{ 
            backgroundColor: BRAND_COLORS.background, 
            padding: "20px 24px",
            border: `1px solid ${BRAND_COLORS.border}`,
            borderTop: "none",
            borderRadius: "0 0 8px 8px"
          }}
        >
          <p style={{ margin: 0, color: BRAND_COLORS.textMuted, fontSize: "12px" }}>
            You're receiving this email because email notifications are enabled in your ClearMarket account.
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px" }}>
            <a href="#" style={{ color: BRAND_COLORS.primary, textDecoration: "none" }}>
              Manage notification settings →
            </a>
          </p>
        </div>
      </div>
    );
  }

  async function sendTestEmail() {
    if (!selectedTemplate || !testEmail) return;
    setSendingTest(true);

    try {
      const { error } = await supabase.functions.invoke("send-notification-email", {
        body: {
          to: testEmail,
          templateKey: selectedTemplate.key,
          placeholders: SAMPLE_PLACEHOLDERS,
          ctaLabel: SAMPLE_PLACEHOLDERS.primary_cta_label,
          ctaUrl: SAMPLE_PLACEHOLDERS.primary_cta_url,
        },
      });

      if (error) throw error;

      toast({ title: `Test email sent to ${testEmail}` });
      setTestEmailDialogOpen(false);
    } catch (err: any) {
      console.error("Error sending test email:", err);
      toast({ title: "Failed to send test email", description: err.message, variant: "destructive" });
    }
    setSendingTest(false);
  }

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = searchQuery === "" || 
      t.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = [...new Set(templates.map(t => t.category))];

  if (authLoading || permLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Manage the content of ClearMarket notification emails. Layout and branding are fixed.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat] || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Templates ({filteredTemplates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-mono text-sm">{template.key}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {template.description || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(template.updated_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(template)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTemplates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No templates found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Email Template</DialogTitle>
              <DialogDescription>
                <span className="font-mono text-sm">{selectedTemplate?.key}</span>
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">Edit Content</TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Description (admin only)</Label>
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Brief description of when this email is sent"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={editForm.subject_template}
                    onChange={(e) => setEditForm({ ...editForm, subject_template: e.target.value })}
                    placeholder="Email subject line"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can use the placeholders listed below. They'll be filled in automatically (for example, sender name, recipient name, etc.).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Body (HTML)</Label>
                  <Textarea
                    value={editForm.body_template}
                    onChange={(e) => setEditForm({ ...editForm, body_template: e.target.value })}
                    rows={8}
                    placeholder="Email body content with HTML"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can use the placeholders listed below. They'll be filled in automatically (for example, sender name, recipient name, etc.).
                  </p>
                </div>

                {selectedTemplate?.placeholders_hint && (
                  <div className="bg-muted p-3 rounded-md space-y-2">
                    <p className="text-sm font-medium">Available placeholders:</p>
                    <div className="space-y-1">
                      {selectedTemplate.placeholders_hint.split(", ").map(p => (
                        <div key={p} className="flex items-start gap-2 text-sm">
                          <code className="px-1.5 py-0.5 bg-background rounded text-xs shrink-0">
                            {`{{${p}}}`}
                          </code>
                          <span className="text-muted-foreground">
                            {PLACEHOLDER_LABELS[p] || p}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Preview with sample data. The layout, header, and footer are fixed.
                  </p>
                  {renderPreview()}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setTestEmail(user?.email || "");
                  setTestEmailDialogOpen(true);
                }}
                disabled={saving}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Test Email
              </Button>
              <div className="flex gap-2 ml-auto">
                <Button variant="ghost" onClick={() => setEditDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveTemplate} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Email Dialog */}
        <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Test Email</DialogTitle>
              <DialogDescription>
                Send this template to an email address with sample data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTestEmailDialogOpen(false)} disabled={sendingTest}>
                Cancel
              </Button>
              <Button onClick={sendTestEmail} disabled={sendingTest || !testEmail}>
                {sendingTest ? "Sending..." : "Send Test"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
