import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCommunityPost,
  fetchCommentsForPost,
  fetchUserVotes,
  createCommunityComment,
  notifyPostAuthorOfComment,
  getCategoryConfig,
  getStatusConfig,
  isUserWatchingPost,
  watchPost,
  unwatchPost,
  CommunityPost,
  CommunityComment,
} from "@/lib/community";
import { formatCommunityScore, fetchCommunityScoresForUsers } from "@/lib/communityScore";
import { CommunityPostDialog } from "@/components/CommunityPostDialog";
import { CommunityVoteButtons } from "@/components/CommunityVoteButtons";
import { ReportFlagButton } from "@/components/ReportFlagButton";
import { ReportUserDialog } from "@/components/ReportUserDialog";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { CommunityImageGallery } from "@/components/CommunityImageGallery";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import {
  MessageSquare,
  Bell,
  ShieldAlert,
  Briefcase,
  ArrowLeft,
  Eye,
  Edit,
  Users,
  Lock,
  BellRing,
  Award,
  HelpCircle,
} from "lucide-react";
import { format } from "date-fns";

const TRUSTED_CONTRIBUTOR_MIN_SCORE = 20;

const CommunityPostDetail = () => {
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [postAuthorScore, setPostAuthorScore] = useState<number | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [postVote, setPostVote] = useState<string | undefined>();
  const [commentVotes, setCommentVotes] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: string; id: string; authorId: string; context: string } | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileTargetUserId, setProfileTargetUserId] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user && postId) {
      loadPost();
    }
  }, [user, postId]);

  const loadPost = async () => {
    if (!user || !postId) return;
    setLoading(true);

    const postData = await fetchCommunityPost(postId);
    if (!postData) {
      toast({ title: "Post not found", variant: "destructive" });
      navigate("/community");
      return;
    }
    setPost(postData);

    // Fetch post author's community score
    const authorScores = await fetchCommunityScoresForUsers([postData.author_id]);
    setPostAuthorScore(authorScores[postData.author_id]?.communityScore ?? null);

    // Load votes for the post
    const postVotes = await fetchUserVotes(user.id, "post", [postId]);
    setPostVote(postVotes[postId]);

    // Load comments (now includes author_community_score)
    const commentsData = await fetchCommentsForPost(postId);
    setComments(commentsData);

    // Load comment votes
    if (commentsData.length > 0) {
      const cVotes = await fetchUserVotes(user.id, "comment", commentsData.map((c) => c.id));
      setCommentVotes(cVotes);
    }

    // Check if user is watching this post (for under_review status)
    if (postData.status === "under_review") {
      const watching = await isUserWatchingPost(user.id, postId);
      setIsWatching(watching);
    }

    setLoading(false);
  };

  const handlePingForUpdates = async () => {
    if (!user || !post) return;
    setWatchLoading(true);

    const result = await watchPost(user.id, post.id);
    if (result.success) {
      setIsWatching(true);
      toast({ title: "You'll be notified when this post is resolved" });
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }

    setWatchLoading(false);
  };

  const handleUnwatch = async () => {
    if (!user || !post) return;
    setWatchLoading(true);

    const result = await unwatchPost(user.id, post.id);
    if (result.success) {
      setIsWatching(false);
      toast({ title: "You've unfollowed this post" });
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }

    setWatchLoading(false);
  };

  const handleSubmitComment = async () => {
    if (!user || !post || !newComment.trim()) return;
    if (post.status === "locked") {
      toast({ title: "Post is locked", description: "New comments are disabled.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const result = await createCommunityComment(post.id, user.id, newComment.trim());

    if (result.success) {
      toast({ title: "Comment posted" });
      setNewComment("");
      // Notify post author if not self
      if (post.author_id !== user.id) {
        await notifyPostAuthorOfComment(post.id, post.author_id, user.id, post.title);
      }
      loadPost();
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleReportPost = () => {
    if (!post) return;
    setReportTarget({
      type: "community_post",
      id: post.id,
      authorId: post.author_id,
      context: `Post: ${post.title.substring(0, 50)}...`,
    });
    setReportDialogOpen(true);
  };

  const handleReportComment = (comment: CommunityComment) => {
    setReportTarget({
      type: "community_comment",
      id: comment.id,
      authorId: comment.author_id,
      context: `Comment: ${comment.body.substring(0, 50)}...`,
    });
    setReportDialogOpen(true);
  };

  const handleViewProfile = (userId: string) => {
    setProfileTargetUserId(userId);
    setProfileDialogOpen(true);
  };

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Post not found</p>
      </div>
    );
  }

  const categoryConfig = getCategoryConfig(post.category);
  const statusConfig = getStatusConfig(post.status);
  const isLocked = post.status === "locked";
  const isAuthor = post.author_id === user.id;

  return (
    <AuthenticatedLayout>
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="outline" onClick={() => navigate("/community")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Community
        </Button>
        {/* Post Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge className={categoryConfig.color}>{categoryConfig.label}</Badge>
              {post.status !== "active" && (
                <Badge className={statusConfig.color}>
                  {isLocked && <Lock className="w-3 h-3 mr-1" />}
                  {statusConfig.label}
                </Badge>
              )}
            </div>

            {/* Ping for updates control for under_review posts */}
            {post.status === "under_review" && (
              <div className="bg-muted/50 border border-border rounded-lg p-3 mb-3">
                {isWatching ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BellRing className="w-4 h-4" />
                      <span>You'll be notified when this is resolved</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUnwatch}
                      disabled={watchLoading}
                    >
                      Unfollow
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">
                      This post is under review by moderators.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePingForUpdates}
                      disabled={watchLoading}
                    >
                      <BellRing className="w-4 h-4 mr-1" />
                      Ping for updates
                    </Button>
                  </div>
                )}
              </div>
            )}

            <h1 className="text-2xl font-bold text-foreground mb-2">{post.title}</h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
              <button
                onClick={() => handleViewProfile(post.author_id)}
                className="hover:text-foreground flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                {post.author_anonymous_id || "User"}
              </button>
              <span>·</span>
              <span>{post.author_role === "field_rep" ? "Field Rep" : post.author_role === "vendor" ? "Vendor" : post.author_role === "both" ? "Both" : ""}</span>
              <span>·</span>
              <span>{format(new Date(post.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
              <span>·</span>
              {postAuthorScore !== null && postAuthorScore >= TRUSTED_CONTRIBUTOR_MIN_SCORE && (
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
                      {postAuthorScore !== null
                        ? `Score: ${formatCommunityScore(postAuthorScore)}`
                        : "Score: N/A"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px]">
                    <p className="text-xs">Community Score is based on how other members rate this user's posts and comments as Helpful or Not Helpful.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="prose prose-invert max-w-none mb-4">
              <p className="whitespace-pre-wrap text-foreground">{post.body}</p>
            </div>

            {/* Post images */}
            {post.image_urls && post.image_urls.length > 0 && (
              <CommunityImageGallery images={post.image_urls} />
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <CommunityVoteButtons
                targetType="post"
                targetId={post.id}
                userId={user.id}
                helpfulCount={post.helpful_count}
                notHelpfulCount={post.not_helpful_count}
                currentVote={postVote}
                onVoteChange={loadPost}
              />

              <div className="flex items-center gap-2">
                {isAuthor && (
                  <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                {!isAuthor && (
                  <ReportFlagButton onClick={handleReportPost} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Locked notice */}
        {isLocked && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6 flex items-center gap-2 text-destructive">
            <Lock className="w-5 h-5" />
            <span>This post has been locked by moderators. New comments are disabled.</span>
          </div>
        )}

        {/* Comments Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
          </h2>

          {/* Comment Composer */}
          {!isLocked && (
            <Card>
              <CardContent className="p-4">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  maxLength={2000}
                />
                <div className="flex justify-end mt-2">
                  <Button onClick={handleSubmitComment} disabled={submitting || !newComment.trim()}>
                    {submitting ? "Posting..." : "Post Comment"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments List */}
          {comments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No comments yet. Be the first to comment!</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <Card key={comment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
                          <button
                            onClick={() => handleViewProfile(comment.author_id)}
                            className="hover:text-foreground flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            {comment.author_anonymous_id || "User"}
                          </button>
                          <span>·</span>
                          <span>
                            {comment.author_role === "field_rep"
                              ? "Field Rep"
                              : comment.author_role === "vendor"
                              ? "Vendor"
                              : comment.author_role === "both"
                              ? "Both"
                              : ""}
                          </span>
                          <span>·</span>
                          <span>{format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                          <span>·</span>
                          {comment.author_community_score !== null && comment.author_community_score !== undefined && comment.author_community_score >= TRUSTED_CONTRIBUTOR_MIN_SCORE && (
                            <Badge variant="secondary" className="text-[11px] gap-1">
                              <Award className="w-3 h-3" />
                              Trusted
                            </Badge>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-[11px] gap-1 cursor-help">
                                  <HelpCircle className="w-3 h-3" />
                                  {comment.author_community_score !== null && comment.author_community_score !== undefined
                                    ? `${formatCommunityScore(comment.author_community_score)}`
                                    : "N/A"}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[200px]">
                                <p className="text-xs">Community Score is based on how other members rate this user's posts and comments as Helpful or Not Helpful.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{comment.body}</p>
                        <div className="mt-2">
                          <CommunityVoteButtons
                            targetType="comment"
                            targetId={comment.id}
                            userId={user.id}
                            helpfulCount={comment.helpful_count}
                            notHelpfulCount={comment.not_helpful_count}
                            currentVote={commentVotes[comment.id]}
                            onVoteChange={loadPost}
                            size="sm"
                          />
                        </div>
                      </div>
                      {comment.author_id !== user.id && (
                        <ReportFlagButton onClick={() => handleReportComment(comment)} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <CommunityPostDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        userId={user.id}
        existingPost={post}
        onSuccess={loadPost}
      />

      {reportTarget && (
        <ReportUserDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          reportedUserId={reportTarget.authorId}
          reporterUserId={user.id}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          contextLabel={reportTarget.context}
        />
      )}

      {profileTargetUserId && (
        <PublicProfileDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          targetUserId={profileTargetUserId}
        />
      )}
    </AuthenticatedLayout>
  );
};

export default CommunityPostDetail;
