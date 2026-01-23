import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Eye, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface BlogPostForm {
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  category: string;
  tags: string;
  content_markdown: string;
  status: string;
}

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

export default function AdminBlogPostEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const isEditing = !!id;

  const [form, setForm] = useState<BlogPostForm>({
    title: "",
    slug: "",
    excerpt: "",
    cover_image_url: "",
    category: "",
    tags: "",
    content_markdown: "",
    status: "draft",
  });

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (isAdmin && isEditing && id) {
      loadPost(id);
    }
  }, [isAdmin, isEditing, id]);

  const checkAdminStatus = async () => {
    if (!user) {
      setCheckingAuth(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    const admin = profile?.is_admin || profile?.is_super_admin;
    setIsAdmin(!!admin);
    setCheckingAuth(false);
  };

  const loadPost = async (postId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to load post.",
        variant: "destructive",
      });
      navigate("/admin/blog");
    } else {
      setForm({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || "",
        cover_image_url: data.cover_image_url || "",
        category: data.category || "",
        tags: (data.tags || []).join(", "),
        content_markdown: data.content_markdown,
        status: data.status,
      });
      setSlugManuallyEdited(true); // Don't auto-generate for existing posts
    }
    setLoading(false);
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugManuallyEdited ? prev.slug : generateSlug(title),
    }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setForm((prev) => ({ ...prev, slug: generateSlug(slug) }));
  };

  const validateForm = (): boolean => {
    if (!form.title.trim()) {
      toast({ title: "Validation Error", description: "Title is required.", variant: "destructive" });
      return false;
    }
    if (!form.slug.trim()) {
      toast({ title: "Validation Error", description: "Slug is required.", variant: "destructive" });
      return false;
    }
    if (!form.content_markdown.trim()) {
      toast({ title: "Validation Error", description: "Content is required.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const savePost = async (publish: boolean = false) => {
    if (!validateForm()) return;

    setSaving(true);

    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const postData = {
      title: form.title.trim(),
      slug: form.slug.trim().toLowerCase(),
      excerpt: form.excerpt.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      category: form.category.trim() || null,
      tags: tagsArray,
      content_markdown: form.content_markdown,
      status: publish ? "published" : form.status,
      author_user_id: user?.id,
      ...(publish && form.status !== "published" ? { published_at: new Date().toISOString() } : {}),
    };

    let error;

    if (isEditing && id) {
      const result = await supabase.from("blog_posts").update(postData).eq("id", id);
      error = result.error;
    } else {
      const result = await supabase.from("blog_posts").insert(postData);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      if (error.message.includes("duplicate key") || error.message.includes("unique")) {
        toast({
          title: "Slug Already Exists",
          description: "Please choose a different slug.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to save post.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Success",
        description: publish ? "Post published successfully." : "Post saved.",
      });
      navigate("/admin/blog");
    }
  };

  if (checkingAuth) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Checking permissions...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground mb-2">Not Authorized</h1>
        <p className="text-muted-foreground">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading post...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/blog")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Posts
        </Button>

        <PageHeader
          title={isEditing ? "Edit Post" : "New Blog Post"}
          subtitle={isEditing ? "Update your blog post." : "Create a new blog post for SEO and marketing."}
        />

        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter post title"
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="url-friendly-slug"
            />
            <p className="text-xs text-muted-foreground">
              URL: https://useclearmarket.io/blog/{form.slug || "your-slug"}
            </p>
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              value={form.excerpt}
              onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
              placeholder="Brief summary for previews and SEO..."
              rows={2}
            />
          </div>

          {/* Cover Image URL */}
          <div className="space-y-2">
            <Label htmlFor="cover_image_url">Cover Image URL</Label>
            <Input
              id="cover_image_url"
              value={form.cover_image_url}
              onChange={(e) => setForm((prev) => ({ ...prev, cover_image_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="e.g., Tips, Industry News, Guides"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={form.tags}
              onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="field reps, vendors, property inspection"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content_markdown">Content (Markdown) *</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
            <Textarea
              id="content_markdown"
              value={form.content_markdown}
              onChange={(e) => setForm((prev) => ({ ...prev, content_markdown: e.target.value }))}
              placeholder="Write your post content in Markdown..."
              rows={16}
              className="font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button onClick={() => savePost(false)} disabled={saving} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save {form.status === "draft" ? "Draft" : ""}
            </Button>
            {form.status !== "published" && (
              <Button onClick={() => savePost(true)} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
            )}
            {form.status === "published" && (
              <Button onClick={() => savePost(false)} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Update
              </Button>
            )}
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview</DialogTitle>
            </DialogHeader>
            <div className="prose prose-invert max-w-none">
              <h1 className="text-2xl font-bold text-foreground">{form.title || "Untitled"}</h1>
              {form.excerpt && (
                <p className="text-muted-foreground italic">{form.excerpt}</p>
              )}
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h2>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 text-foreground/90 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-3 text-foreground/90">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-3 text-foreground/90">{children}</ol>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="text-primary hover:underline">
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-3">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {form.content_markdown || "*No content yet*"}
              </ReactMarkdown>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
