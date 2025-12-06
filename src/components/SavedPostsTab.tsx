import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchUserVotes,
  getCategoryConfig,
  getStatusConfig,
  CommunityPost,
  CommunityChannel,
  COMMUNITY_CATEGORIES,
  NETWORK_CATEGORIES,
  ANNOUNCEMENT_CATEGORIES,
} from "@/lib/community";
import { fetchSavedPosts } from "@/lib/postSaves";
import { formatCommunityScore } from "@/lib/communityScore";
import { CommunityVoteButtons } from "@/components/CommunityVoteButtons";
import { ReportFlagButton } from "@/components/ReportFlagButton";
import { ReportUserDialog } from "@/components/ReportUserDialog";
import { PostBookmarkButton } from "@/components/PostBookmarkButton";
import {
  MessageCircle,
  Award,
  HelpCircle,
  BookmarkX,
} from "lucide-react";
import { format } from "date-fns";

const TRUSTED_CONTRIBUTOR_MIN_SCORE = 20;

interface Props {
  userId: string;
}

export function SavedPostsTab({ userId }: Props) {
  const navigate = useNavigate();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<"all" | CommunityChannel>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTargetPost, setReportTargetPost] = useState<CommunityPost | null>(null);

  // Get available categories based on channel filter
  const getAvailableCategories = () => {
    if (channelFilter === "all") {
      return [
        ...COMMUNITY_CATEGORIES,
        ...NETWORK_CATEGORIES,
        ...ANNOUNCEMENT_CATEGORIES,
      ];
    }
    switch (channelFilter) {
      case "community":
        return COMMUNITY_CATEGORIES;
      case "network":
        return NETWORK_CATEGORIES;
      case "announcements":
        return ANNOUNCEMENT_CATEGORIES;
      default:
        return [];
    }
  };

  useEffect(() => {
    loadSavedPosts();
  }, [userId, channelFilter, categoryFilter]);

  const loadSavedPosts = async () => {
    setLoading(true);

    const data = await fetchSavedPosts(userId, {
      channel: channelFilter !== "all" ? channelFilter : undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
    });

    setPosts(data);

    if (data.length > 0) {
      const votes = await fetchUserVotes(userId, "post", data.map((p) => p.id));
      setUserVotes(votes);
    }

    setLoading(false);
  };

  const handleReportPost = (post: CommunityPost) => {
    setReportTargetPost(post);
    setReportDialogOpen(true);
  };

  const handleUnsave = () => {
    // Reload the list after unsaving
    loadSavedPosts();
  };

  const getChannelLabel = (channel: CommunityChannel) => {
    switch (channel) {
      case "community":
        return "Community";
      case "network":
        return "Network & Alerts";
      case "announcements":
        return "Announcements";
      default:
        return channel;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select 
          value={channelFilter} 
          onValueChange={(v) => {
            setChannelFilter(v as "all" | CommunityChannel);
            setCategoryFilter("all"); // Reset category when channel changes
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="community">Community</SelectItem>
            <SelectItem value="network">Network & Alerts</SelectItem>
            <SelectItem value="announcements">Announcements</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {getAvailableCategories().map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading saved posts...</div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookmarkX className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              You haven't saved any posts yet. Tap the bookmark icon on a post to save it for later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const categoryConfig = getCategoryConfig(post.category, post.channel);
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
                        <Badge variant="outline" className="text-xs">
                          {getChannelLabel(post.channel)}
                        </Badge>
                        <Badge className={categoryConfig.color}>{categoryConfig.label}</Badge>
                        {post.status !== "active" && (
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {post.author_anonymous_id || "User"} · {post.author_role === "field_rep" ? "Field Rep" : post.author_role === "vendor" ? "Vendor" : post.author_role === "both" ? "Both" : ""}
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

                      <div className="flex items-center gap-4 mt-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <CommunityVoteButtons
                            targetType="post"
                            targetId={post.id}
                            userId={userId}
                            helpfulCount={post.helpful_count}
                            notHelpfulCount={post.not_helpful_count}
                            currentVote={userVotes[post.id]}
                            onVoteChange={loadSavedPosts}
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
                        initialSaved={true}
                        onToggle={handleUnsave}
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