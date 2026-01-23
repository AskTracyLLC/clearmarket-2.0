import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Plus, Edit, Eye, EyeOff, Archive, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  published_at: string | null;
  updated_at: string;
}

export default function AdminBlogPosts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

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

    if (admin) {
      loadPosts();
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, title, slug, status, category, published_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading blog posts:", error);
      toast({
        title: "Error",
        description: "Failed to load blog posts.",
        variant: "destructive",
      });
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  const updateStatus = async (postId: string, newStatus: string) => {
    const updates: { status: string; published_at?: string | null } = { status: newStatus };

    // Set published_at when publishing
    if (newStatus === "published") {
      const post = posts.find((p) => p.id === postId);
      if (!post?.published_at) {
        updates.published_at = new Date().toISOString();
      }
    }

    const { error } = await supabase.from("blog_posts").update(updates).eq("id", postId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update post status.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Post ${newStatus === "published" ? "published" : newStatus === "archived" ? "archived" : "unpublished"}.`,
      });
      loadPosts();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-600 hover:bg-green-700">Published</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <PageHeader
          title="Blog Posts"
          subtitle="Manage public blog content for SEO and marketing."
        />

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/blog" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Public Blog
              </a>
            </Button>
          </div>
          <Button asChild>
            <Link to="/admin/blog/new">
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading posts...</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground mb-4">No blog posts yet.</p>
            <Button asChild>
              <Link to="/admin/blog/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Post
              </Link>
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {post.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {post.slug}
                    </TableCell>
                    <TableCell>
                      {post.category ? (
                        <Badge variant="secondary" className="text-xs">
                          {post.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {post.published_at
                        ? format(new Date(post.published_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(post.updated_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/admin/blog/${post.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {post.status === "published" && (
                            <DropdownMenuItem asChild>
                              <a
                                href={`/blog/${post.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Live
                              </a>
                            </DropdownMenuItem>
                          )}
                          {post.status !== "published" && (
                            <DropdownMenuItem onClick={() => updateStatus(post.id, "published")}>
                              <Eye className="h-4 w-4 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          {post.status === "published" && (
                            <DropdownMenuItem onClick={() => updateStatus(post.id, "draft")}>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Unpublish
                            </DropdownMenuItem>
                          )}
                          {post.status !== "archived" && (
                            <DropdownMenuItem onClick={() => updateStatus(post.id, "archived")}>
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
