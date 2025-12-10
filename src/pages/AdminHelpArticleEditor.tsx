import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ExternalLink, Save, Trash2 } from "lucide-react";
import { format } from "date-fns";

const CATEGORY_OPTIONS = [
  { key: "getting_started", label: "Getting Started" },
  { key: "accounts_access", label: "Accounts & Access" },
  { key: "credits_billing", label: "Credits & Billing" },
  { key: "safety_support", label: "Safety & Support" },
];

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  content: string;
  is_published: boolean;
  display_order: number;
  last_updated_at: string;
  last_updated_by: string | null;
  created_at: string;
}

export default function AdminHelpArticleEditor() {
  const { articleId } = useParams<{ articleId: string }>();
  const isNew = articleId === "new";
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].key);
  const [content, setContent] = useState("");
  const [displayOrder, setDisplayOrder] = useState(100);
  const [isPublished, setIsPublished] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lastUpdatedByEmail, setLastUpdatedByEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !permLoading) {
      if (!user) {
        navigate("/signin");
        return;
      }
      if (!permissions.canViewAdminDashboard) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      if (!isNew) {
        loadArticle();
      }
    }
  }, [user, authLoading, permLoading, permissions, navigate, toast, articleId, isNew]);

  // Auto-generate slug from title
  useEffect(() => {
    if (isNew && title) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setSlug(generatedSlug);
    }
  }, [title, isNew]);

  async function loadArticle() {
    try {
      const { data, error } = await supabase
        .from("help_center_articles")
        .select("*")
        .eq("id", articleId)
        .single();

      if (error) throw error;

      setArticle(data as HelpArticle);
      setTitle(data.title);
      setSlug(data.slug);
      setCategory(data.category);
      setContent(data.content || "");
      setDisplayOrder(data.display_order);
      setIsPublished(data.is_published);

      if (data.last_updated_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, staff_anonymous_id")
          .eq("id", data.last_updated_by)
          .single();
        if (profile) {
          setLastUpdatedByEmail(profile.staff_anonymous_id || profile.email);
        }
      }
    } catch (err) {
      console.error("Error loading article:", err);
      toast({
        title: "Error",
        description: "Failed to load article.",
        variant: "destructive",
      });
      navigate("/admin/help-articles");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!title.trim() || !category || !slug.trim()) {
      toast({
        title: "Validation Error",
        description: "Title, category, and slug are required.",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    try {
      const articleData = {
        title: title.trim(),
        slug: slug.trim(),
        category,
        content,
        display_order: displayOrder,
        is_published: isPublished,
        last_updated_at: new Date().toISOString(),
        last_updated_by: user.id,
      };

      if (isNew) {
        const { error } = await supabase
          .from("help_center_articles")
          .insert(articleData);

        if (error) throw error;

        toast({
          title: "Created",
          description: "Article has been created successfully.",
        });
        navigate("/admin/help-articles");
      } else {
        const { error } = await supabase
          .from("help_center_articles")
          .update(articleData)
          .eq("id", articleId);

        if (error) throw error;

        toast({
          title: "Saved",
          description: "Article has been updated successfully.",
        });
        loadArticle();
      }
    } catch (err: any) {
      console.error("Error saving article:", err);
      toast({
        title: "Error",
        description: err.message?.includes("duplicate") 
          ? "An article with this slug already exists." 
          : "Failed to save article.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!articleId || isNew) return;

    try {
      const { error } = await supabase
        .from("help_center_articles")
        .delete()
        .eq("id", articleId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Article has been deleted.",
      });
      navigate("/admin/help-articles");
    } catch (err) {
      console.error("Error deleting article:", err);
      toast({
        title: "Error",
        description: "Failed to delete article.",
        variant: "destructive",
      });
    }
  }

  function handlePreview() {
    window.open(`/help/${slug}`, "_blank");
  }

  if (loading || authLoading || permLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/help-articles")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={isNew ? "New Article" : "Edit Article"}
            subtitle={isNew ? "Create a new help center article" : "Update article content and settings"}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Article Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 100)}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="article-slug"
              />
              <p className="text-sm text-muted-foreground">
                URL: /help/{slug || "article-slug"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="isPublished"
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
              <Label htmlFor="isPublished">Published</Label>
            </div>

            {article && (
              <div className="text-sm text-muted-foreground space-y-1 pt-4 border-t">
                <p>
                  Last updated: {format(new Date(article.last_updated_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {lastUpdatedByEmail && (
                  <p>Updated by: {lastUpdatedByEmail}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="content">Article Content (Markdown supported)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter article content here..."
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {!isNew && (
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {!isNew && isPublished && (
              <Button variant="outline" onClick={handlePreview}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : isNew ? "Create Article" : "Save Changes"}
          </Button>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Article</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this article? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AuthenticatedLayout>
  );
}
