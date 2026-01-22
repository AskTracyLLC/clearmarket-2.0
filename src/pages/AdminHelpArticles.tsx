import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowLeft, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  getting_started: "Getting Started",
  accounts_access: "Accounts & Access",
  credits_billing: "Credits & Billing",
  safety_support: "Safety & Support",
};

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

export default function AdminHelpArticles() {
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<HelpArticle | null>(null);

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
      loadArticles();
    }
  }, [user, authLoading, permLoading, permissions, navigate, toast]);

  async function loadArticles() {
    try {
      const { data, error } = await supabase
        .from("help_center_articles")
        .select("*")
        .order("category")
        .order("display_order");

      if (error) throw error;
      setArticles(data || []);
    } catch (err) {
      console.error("Error loading articles:", err);
      toast({
        title: "Error",
        description: "Failed to load help articles.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function togglePublished(article: HelpArticle) {
    try {
      const { error } = await supabase
        .from("help_center_articles")
        .update({
          is_published: !article.is_published,
          last_updated_at: new Date().toISOString(),
          last_updated_by: user?.id,
        })
        .eq("id", article.id);

      if (error) throw error;

      toast({
        title: article.is_published ? "Unpublished" : "Published",
        description: `Article "${article.title}" has been ${article.is_published ? "unpublished" : "published"}.`,
      });

      loadArticles();
    } catch (err) {
      console.error("Error toggling publish:", err);
      toast({
        title: "Error",
        description: "Failed to update article status.",
        variant: "destructive",
      });
    }
  }

  async function handleDelete() {
    if (!articleToDelete) return;

    try {
      const { error } = await supabase
        .from("help_center_articles")
        .delete()
        .eq("id", articleToDelete.id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `Article "${articleToDelete.title}" has been deleted.`,
      });

      setDeleteDialogOpen(false);
      setArticleToDelete(null);
      loadArticles();
    } catch (err) {
      console.error("Error deleting article:", err);
      toast({
        title: "Error",
        description: "Failed to delete article.",
        variant: "destructive",
      });
    }
  }

  if (loading || authLoading || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/legal")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <PageHeader
              title="Help Center Articles"
              subtitle="Manage FAQ and help documentation for users"
            />
          </div>
          <Button onClick={() => navigate("/admin/help-articles/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Article
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {articles.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No articles yet. Create your first help article to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium">{article.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {CATEGORY_LABELS[article.category] || article.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {article.is_published ? (
                          <Badge variant="default">Published</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(article.last_updated_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => togglePublished(article)}
                            title={article.is_published ? "Unpublish" : "Publish"}
                          >
                            {article.is_published ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/help-articles/${article.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setArticleToDelete(article);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Article</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{articleToDelete?.title}"? This action cannot be undone.
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
  );
}
