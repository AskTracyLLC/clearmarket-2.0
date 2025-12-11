import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchCommunityPosts,
  fetchUserVotes,
  getCategoryConfig,
  getStatusConfig,
  getCategoriesForChannel,
  CommunityPost,
  CommunityChannel,
} from "@/lib/community";
import { getSavedPostIds } from "@/lib/postSaves";
import { formatCommunityScore } from "@/lib/communityScore";
import { CommunityPostDialog } from "@/components/CommunityPostDialog";
import { CommunityVoteButtons } from "@/components/CommunityVoteButtons";
import { CommunityImageGallery } from "@/components/CommunityImageGallery";
import { ReportFlagButton } from "@/components/ReportFlagButton";
import { ReportUserDialog } from "@/components/ReportUserDialog";
import { PostBookmarkButton } from "@/components/PostBookmarkButton";
import {
  Plus,
  MessageCircle,
  Award,
  HelpCircle,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";

const TRUSTED_CONTRIBUTOR_MIN_SCORE = 20;

interface Props {
  userId: string;
  channel?: CommunityChannel;
  canCreate?: boolean;
}

export function CommunityTab({ userId, channel = "community", canCreate = true }: Props) {
  const navigate = useNavigate();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "helpful" | "comments" | "author_score">("newest");
  const [myPostsOnly, setMyPostsOnly] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTargetPost, setReportTargetPost] = useState<CommunityPost | null>(null);

  const categories = getCategoriesForChannel(channel);

  useEffect(() => {
    loadPosts();
  }, [userId, channel, categoryFilter, sortBy, myPostsOnly]);

  const loadPosts = async () => {
    setLoading(true);

    const data = await fetchCommunityPosts({
      channel,
      category: categoryFilter,
      authorId: myPostsOnly ? userId : undefined,
      sortBy,
      limit: 50,
    });

    setPosts(data);

    if (data.length > 0) {
      const votes = await fetchUserVotes(userId, "post", data.map((p) => p.id));
      setUserVotes(votes);
    }

    // Load saved status for all posts
    const savedIds = await getSavedPostIds(userId);
    setSavedPostIds(savedIds);

    setLoading(false);
  };

  const handleReportPost = (post: CommunityPost) => {
    setReportTargetPost(post);
    setReportDialogOpen(true);
  };

  const getEmptyMessage = () => {
    switch (channel) {
      case "community":
        return myPostsOnly
          ? "You haven't created any community posts yet."
          : "No community posts found. Be the first to share something!";
      case "network":
        return myPostsOnly
          ? "You haven't sent any network alerts yet."
          : "No network alerts found.";
      case "announcements":
        return "No announcements yet. Check back later for updates from ClearMarket.";
      default:
        return "No posts found.";
    }
  };

  const getNewPostLabel = () => {
    switch (channel) {
      case "community":
        return "New Post";
      case "network":
        return "New Alert";
      case "announcements":
        return "New Announcement";
      default:
        return "New Post";
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="helpful">Most Helpful</SelectItem>
              <SelectItem value="comments">Most Commented</SelectItem>
              <SelectItem value="author_score">Author Community Score (High → Low)</SelectItem>
            </SelectContent>
          </Select>

          {channel !== "announcements" && (
            <Button
              variant={myPostsOnly ? "secondary" : "outline"}
              size="sm"
              onClick={() => setMyPostsOnly(!myPostsOnly)}
            >
              My Posts
            </Button>
          )}
        </div>

        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {getNewPostLabel()}
          </Button>
        )}
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading posts...</div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{getEmptyMessage()}</p>
            {canCreate && channel !== "announcements" && (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                Create a Post
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const categoryConfig = getCategoryConfig(post.category, channel);
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
                          {post.author_anonymous_id || "User"} · {post.author_role === "field_rep" ? "Field Rep" : post.author_role === "vendor" ? "Vendor" : post.author_role === "both" ? "Both" : post.author_role === "admin" ? "Admin" : post.author_role === "moderator" ? "Moderator" : post.author_role === "support" ? "Support" : ""}
                        </span>
                        {post.author_community_score !== null && post.author_community_score >= TRUSTED_CONTRIBUTOR_MIN_SCORE && (
                          <Badge variant="secondary" className="text-[11px] gap-1">
                            <Award className="w-3 h-3" />
                            Trusted Contributor
                          </Badge>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[11px] gap-1 cursor-help">
                                <HelpCircle className="w-3 h-3" />
                                {post.author_community_score !== null
                                  ? `Score: ${formatCommunityScore(post.author_community_score)}`
                                  : "Score: N/A"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px]">
                              <p className="text-xs">Community Score is based on how other members rate this user's posts and comments as Helpful or Not Helpful.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <h3 className="font-semibold text-foreground line-clamp-1 mb-1">
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.body}
                      </p>

                      {/* Image indicator for posts with images */}
                      {post.image_urls && post.image_urls.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <ImageIcon className="w-3 h-3" />
                          <span>{post.image_urls.length} image{post.image_urls.length > 1 ? "s" : ""}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <CommunityVoteButtons
                            targetType="post"
                            targetId={post.id}
                            userId={userId}
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

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <PostBookmarkButton
                        postId={post.id}
                        userId={userId}
                        initialSaved={savedPostIds.has(post.id)}
                        onToggle={(saved) => {
                          setSavedPostIds(prev => {
                            const newSet = new Set(prev);
                            if (saved) {
                              newSet.add(post.id);
                            } else {
                              newSet.delete(post.id);
                            }
                            return newSet;
                          });
                        }}
                      />
                      <ReportFlagButton
                        onClick={() => handleReportPost(post)}
                        disabled={post.author_id === userId}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <CommunityPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={userId}
        channel={channel}
        onSuccess={loadPosts}
      />

      {reportTargetPost && (
        <ReportUserDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          reportedUserId={reportTargetPost.author_id}
          reporterUserId={userId}
          targetType="community_post"
          targetId={reportTargetPost.id}
          contextLabel={`Post: ${reportTargetPost.title.substring(0, 50)}...`}
        />
      )}
    </div>
  );
}
