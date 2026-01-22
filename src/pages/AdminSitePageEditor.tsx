import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ExternalLink, Save } from "lucide-react";
import { format } from "date-fns";

type PageType = "tos" | "privacy" | "support";

interface SitePage {
  id: string;
  page_type: PageType;
  title: string;
  slug: string;
  content: string;
  effective_at: string | null;
  last_updated_at: string;
  last_updated_by: string | null;
  is_published: boolean;
  announced_on: string | null;
  created_at: string;
}

const pageTypeConfig: Record<PageType, { label: string; showEffectiveDate: boolean }> = {
  tos: { label: "Terms of Service", showEffectiveDate: true },
  privacy: { label: "Privacy Policy", showEffectiveDate: true },
  support: { label: "Support Page", showEffectiveDate: false },
};

export default function AdminSitePageEditor() {
  const { pageType } = useParams<{ pageType: string }>();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<SitePage | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [lastUpdatedByEmail, setLastUpdatedByEmail] = useState<string | null>(null);

  const validPageType = pageType as PageType;
  const config = pageTypeConfig[validPageType];

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
      if (!config) {
        toast({
          title: "Invalid Page Type",
          description: "The requested page type does not exist.",
          variant: "destructive",
        });
        navigate("/admin/legal");
        return;
      }
      loadPage();
    }
  }, [user, authLoading, permLoading, permissions, navigate, toast, validPageType]);

  async function loadPage() {
    try {
      const { data, error } = await supabase
        .from("site_pages")
        .select("*")
        .eq("page_type", validPageType)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setPage(data as SitePage);
        setTitle(data.title);
        setContent(data.content || "");
        setEffectiveAt(data.effective_at ? format(new Date(data.effective_at), "yyyy-MM-dd") : "");
        setIsPublished(data.is_published);

        if (data.last_updated_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, staff_anonymous_id")
            .eq("id", data.last_updated_by)
            .single();
          if (profile) {
            setLastUpdatedByEmail(profile.staff_anonymous_id || profile.full_name || "Unknown");
          }
        }
      }
    } catch (err) {
      console.error("Error loading page:", err);
      toast({
        title: "Error",
        description: "Failed to load page content.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    
    setSaving(true);
    try {
      const updateData = {
        title,
        content,
        effective_at: config.showEffectiveDate && effectiveAt ? new Date(effectiveAt).toISOString() : null,
        is_published: isPublished,
        last_updated_at: new Date().toISOString(),
        last_updated_by: user.id,
      };

      if (page) {
        const { error } = await supabase
          .from("site_pages")
          .update(updateData)
          .eq("id", page.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_pages")
          .insert({
            ...updateData,
            page_type: validPageType,
            slug: validPageType === "tos" ? "/legal/terms" : validPageType === "privacy" ? "/legal/privacy" : "/support",
          });

        if (error) throw error;
      }

      toast({
        title: "Saved",
        description: `${config.label} has been updated successfully.`,
      });

      loadPage();
    } catch (err) {
      console.error("Error saving page:", err);
      toast({
        title: "Error",
        description: "Failed to save page content.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function handlePreview() {
    const previewUrl = validPageType === "tos" ? "/legal/terms" : validPageType === "privacy" ? "/legal/privacy" : "/support";
    window.open(previewUrl, "_blank");
  }

  if (loading || authLoading || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/legal")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={`Edit ${config?.label || "Page"}`}
            subtitle="Update the content and settings for this page"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Page Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Page title"
              />
            </div>

            {config?.showEffectiveDate && (
              <div className="space-y-2">
                <Label htmlFor="effectiveAt">Effective Date</Label>
                <Input
                  id="effectiveAt"
                  type="date"
                  value={effectiveAt}
                  onChange={(e) => setEffectiveAt(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  The date when this version becomes effective
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                id="isPublished"
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
              <Label htmlFor="isPublished">Published</Label>
            </div>

            {page && (
              <div className="text-sm text-muted-foreground space-y-1 pt-4 border-t">
                <p>
                  Last updated: {format(new Date(page.last_updated_at), "MMM d, yyyy 'at' h:mm a")}
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
              <Label htmlFor="content">Page Content (Markdown supported)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter page content here..."
                className="min-h-[400px] font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handlePreview}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
    </div>
  );
}
