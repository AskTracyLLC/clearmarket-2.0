import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCommunityPosts,
  fetchUserVotes,
  getCategoryConfig,
  getStatusConfig,
  POST_CATEGORIES,
  CommunityPost,
} from "@/lib/community";
import { CommunityPostDialog } from "@/components/CommunityPostDialog";
import { CommunityVoteButtons } from "@/components/CommunityVoteButtons";
import { ReportFlagButton } from "@/components/ReportFlagButton";
import { ReportUserDialog } from "@/components/ReportUserDialog";
import { NavLink } from "@/components/NavLink";
import {
  MessageSquare,
  Bell,
  ShieldAlert,
  Briefcase,
  Plus,
  MessageCircle,
  Users,
} from "lucide-react";
import { format } from "date-fns";

const CommunityBoard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "helpful" | "comments">("newest");
  const [myPostsOnly, setMyPostsOnly] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTargetPost, setReportTargetPost] = useState<CommunityPost | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [user, categoryFilter, sortBy, myPostsOnly]);

  const loadPosts = async () => {
    if (!user) return;
    setLoading(true);

    const data = await fetchCommunityPosts({
      category: categoryFilter,
      authorId: myPostsOnly ? user.id : undefined,
      sortBy,
      limit: 50,
    });

    setPosts(data);

    // Load user votes
    if (data.length > 0) {
      const votes = await fetchUserVotes(user.id, "post", data.map((p) => p.id));
      setUserVotes(votes);
    }

    setLoading(false);
  };

  const handleReportPost = (post: CommunityPost) => {
    setReportTargetPost(post);
    setReportDialogOpen(true);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header with navigation */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                ClearMarket
              </Link>
              <nav className="hidden md:flex gap-6">
                <NavLink to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <Briefcase className="w-4 h-4" />
                  Dashboard
                </NavLink>
                <NavLink to="/community" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <Users className="w-4 h-4" />
                  Community
                </NavLink>
                <NavLink to="/messages" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <MessageSquare className="w-4 h-4" />
                  Messages
                </NavLink>
                <NavLink to="/notifications" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <Bell className="w-4 h-4" />
                  Notifications
                </NavLink>
                <NavLink to="/safety" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" activeClassName="text-primary">
                  <ShieldAlert className="w-4 h-4" />
                  Safety
                </NavLink>
              </nav>
            </div>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Community Board</h1>
            <p className="text-muted-foreground mt-1">
              Share questions, experiences, and tips with other Vendors and Field Reps.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {POST_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="helpful">Most Helpful</SelectItem>
              <SelectItem value="comments">Most Commented</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={myPostsOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setMyPostsOnly(!myPostsOnly)}
          >
            My Posts
          </Button>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading posts...</div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {myPostsOnly
                  ? "You haven't created any posts yet."
                  : "No posts found. Be the first to share something!"}
              </p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                Create a Post
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const categoryConfig = getCategoryConfig(post.category);
              const statusConfig = getStatusConfig(post.status);

              return (
                <Card
                  key={post.id}
                  className="hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/community/${post.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className={categoryConfig.color}>{categoryConfig.label}</Badge>
                          {post.status !== "active" && (
                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {post.author_anonymous_id || "User"} · {post.author_role === "field_rep" ? "Field Rep" : post.author_role === "vendor" ? "Vendor" : post.author_role === "both" ? "Both" : ""}
                          </span>
                        </div>

                        <h3 className="font-semibold text-foreground line-clamp-1 mb-1">
                          {post.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {post.body}
                        </p>

                        <div className="flex items-center gap-4 mt-3">
                          <div onClick={(e) => e.stopPropagation()}>
                            <CommunityVoteButtons
                              targetType="post"
                              targetId={post.id}
                              userId={user.id}
                              helpfulCount={post.helpful_count}
                              notHelpfulCount={post.not_helpful_count}
                              currentVote={userVotes[post.id]}
                              onVoteChange={loadPosts}
                              size="sm"
                            />
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {post.comments_count} comments
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(post.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <ReportFlagButton
                          onClick={() => handleReportPost(post)}
                          disabled={post.author_id === user.id}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Dialogs */}
      <CommunityPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={user.id}
        onSuccess={loadPosts}
      />

      {reportTargetPost && (
        <ReportUserDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          reportedUserId={reportTargetPost.author_id}
          reporterUserId={user.id}
          targetType="community_post"
          targetId={reportTargetPost.id}
          contextLabel={`Post: ${reportTargetPost.title.substring(0, 50)}...`}
        />
      )}
    </div>
  );
};

export default CommunityBoard;
