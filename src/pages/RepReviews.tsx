import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { toast } from "sonner";
import { ArrowLeft, Eye, TrendingUp, TrendingDown, Minus, Star, MessageSquare, Info, GraduationCap } from "lucide-react";
import { fetchTrustScoresForUsers, canMarkFeedback, markReviewAsFeedback } from "@/lib/reviews";
import { canMoveToCoaching, MAX_COACHING_REVIEWS } from "@/lib/reviewCoaching";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { RepReputationSnapshotNew } from "@/components/RepReputationSnapshotNew";
import { ReputationSharePanel } from "@/components/ReputationSharePanel";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { MoveToCoachingDialog } from "@/components/MoveToCoachingDialog";

interface ReviewData {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating_on_time: number | null;
  rating_quality: number | null;
  rating_communication: number | null;
  comment: string | null;
  created_at: string;
  is_exit_review: boolean;
  direction: string;
  is_feedback?: boolean;
  status?: string;
  converted_to_coaching_at?: string | null;
  coaching_note?: string | null;
  // Enriched data
  reviewerAnonymousId?: string;
  revieweeAnonymousId?: string;
  reviewerFirstName?: string;
  revieweeFirstName?: string;
}

export default function RepReviews() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"received" | "given">("received");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  
  // Trust Score data
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgOnTime, setAvgOnTime] = useState<number | null>(null);
  const [avgQuality, setAvgQuality] = useState<number | null>(null);
  const [avgCommunication, setAvgCommunication] = useState<number | null>(null);

  // Reviews data
  const [receivedReviews, setReceivedReviews] = useState<ReviewData[]>([]);
  const [givenReviews, setGivenReviews] = useState<ReviewData[]>([]);

  // Dialog state
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);

  // Feedback reset state
  const [canUseFeedbackReset, setCanUseFeedbackReset] = useState(true);
  const [feedbackDaysRemaining, setFeedbackDaysRemaining] = useState<number | null>(null);
  const [feedbackNextDate, setFeedbackNextDate] = useState<Date | null>(null);
  const [feedbackConfirmReviewId, setFeedbackConfirmReviewId] = useState<string | null>(null);
  const [markingFeedback, setMarkingFeedback] = useState(false);

  // Recent reviews (90 days)
  const [recentReviewCount, setRecentReviewCount] = useState(0);
  const [recentAvgOnTime, setRecentAvgOnTime] = useState<number | null>(null);
  const [recentAvgQuality, setRecentAvgQuality] = useState<number | null>(null);
  const [recentAvgCommunication, setRecentAvgCommunication] = useState<number | null>(null);

  // Coaching state
  const [canUseCoaching, setCanUseCoaching] = useState(true);
  const [coachingCount, setCoachingCount] = useState(0);
  const [coachingDialogReviewId, setCoachingDialogReviewId] = useState<string | null>(null);
  const [publicReviewCount, setPublicReviewCount] = useState(0);
  const [coachingReviewCount, setCoachingReviewCount] = useState(0);

  useEffect(() => {
    if (!authLoading && user) {
      checkAccess();
    }
  }, [user, authLoading]);

  const checkAccess = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_fieldrep, is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_fieldrep && !profile?.is_admin) {
      toast.error("Access denied: Field rep role required");
      navigate("/dashboard");
      return;
    }

    await loadReviewsData();
  };

  const loadReviewsData = async () => {
    if (!user) return;

    try {
      // Fetch trust score
      const trustScores = await fetchTrustScoresForUsers([user.id]);
      const myTrust = trustScores[user.id];
      setTrustScore(myTrust?.average ?? 3.0);
      setReviewCount(myTrust?.count ?? 0);

      // Fetch received reviews (vendor_to_rep)
      const { data: received, error: receivedError } = await supabase
        .from("reviews")
        .select("*, is_feedback, status, converted_to_coaching_at, coaching_note")
        .eq("reviewee_id", user.id)
        .eq("direction", "vendor_to_rep")
        .order("created_at", { ascending: false });

      if (receivedError) throw receivedError;

      // Check coaching eligibility
      const coachingResult = await canMoveToCoaching(user.id);
      setCanUseCoaching(coachingResult.canMove);
      setCoachingCount(coachingResult.currentCount);

      // Calculate public vs coaching counts
      const publicCount = (received || []).filter(r => r.status !== "coaching").length;
      const coachingCountTotal = (received || []).filter(r => r.status === "coaching").length;
      setPublicReviewCount(publicCount);
      setCoachingReviewCount(coachingCountTotal);

      // Fetch given reviews (rep_to_vendor)
      const { data: given, error: givenError } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewer_id", user.id)
        .eq("direction", "rep_to_vendor")
        .order("created_at", { ascending: false });

      if (givenError) throw givenError;

      // Enrich received reviews with reviewer info
      const enrichedReceived = await enrichReviews(received || [], "reviewer");
      setReceivedReviews(enrichedReceived);

      // Enrich given reviews with reviewee info
      const enrichedGiven = await enrichReviews(given || [], "reviewee");
      setGivenReviews(enrichedGiven);

      // Calculate category averages for received reviews (lifetime)
      if (received && received.length > 0) {
        const onTimeSum = received.reduce((sum, r) => sum + (r.rating_on_time || 0), 0);
        const qualitySum = received.reduce((sum, r) => sum + (r.rating_quality || 0), 0);
        const communicationSum = received.reduce((sum, r) => sum + (r.rating_communication || 0), 0);
        
        setAvgOnTime(onTimeSum / received.length);
        setAvgQuality(qualitySum / received.length);
        setAvgCommunication(communicationSum / received.length);
      }

      // Calculate recent (90 days) averages
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const recentReviews = (received || []).filter(
        r => new Date(r.created_at) >= ninetyDaysAgo
      );

      setRecentReviewCount(recentReviews.length);
      
      if (recentReviews.length > 0) {
        const recentOnTimeSum = recentReviews.reduce((sum, r) => sum + (r.rating_on_time || 0), 0);
        const recentQualSum = recentReviews.reduce((sum, r) => sum + (r.rating_quality || 0), 0);
        const recentCommSum = recentReviews.reduce((sum, r) => sum + (r.rating_communication || 0), 0);
        
        setRecentAvgOnTime(recentOnTimeSum / recentReviews.length);
        setRecentAvgQuality(recentQualSum / recentReviews.length);
        setRecentAvgCommunication(recentCommSum / recentReviews.length);
      } else {
        // No recent reviews, use lifetime averages as recent
        setRecentAvgOnTime(avgOnTime);
        setRecentAvgQuality(avgQuality);
        setRecentAvgCommunication(avgCommunication);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const enrichReviews = async (reviews: any[], role: "reviewer" | "reviewee"): Promise<ReviewData[]> => {
    if (reviews.length === 0) return [];

    const userIds = reviews.map(r => role === "reviewer" ? r.reviewer_id : r.reviewee_id);
    const uniqueIds = [...new Set(userIds)];

    // Fetch vendor profiles
    const { data: vendorProfiles } = await supabase
      .from("vendor_profile")
      .select("user_id, anonymous_id, profiles:user_id(full_name)")
      .in("user_id", uniqueIds);

    const profileMap = new Map();
    (vendorProfiles || []).forEach(p => {
      const fullName = (p.profiles as any)?.full_name || "";
      const firstName = fullName.split(" ")[0] || "";
      profileMap.set(p.user_id, {
        anonymousId: p.anonymous_id,
        firstName,
      });
    });

    return reviews.map(r => ({
      ...r,
      reviewerAnonymousId: role === "reviewer" ? profileMap.get(r.reviewer_id)?.anonymousId : undefined,
      revieweeAnonymousId: role === "reviewee" ? profileMap.get(r.reviewee_id)?.anonymousId : undefined,
      reviewerFirstName: role === "reviewer" ? profileMap.get(r.reviewer_id)?.firstName : undefined,
      revieweeFirstName: role === "reviewee" ? profileMap.get(r.reviewee_id)?.firstName : undefined,
    }));
  };

  const sortReviews = (reviews: ReviewData[]) => {
    const sorted = [...reviews];
    
    switch (sortOrder) {
      case "newest":
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "oldest":
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case "highest":
        return sorted.sort((a, b) => {
          const avgA = ((a.rating_on_time || 0) + (a.rating_quality || 0) + (a.rating_communication || 0)) / 3;
          const avgB = ((b.rating_on_time || 0) + (b.rating_quality || 0) + (b.rating_communication || 0)) / 3;
          return avgB - avgA;
        });
      case "lowest":
        return sorted.sort((a, b) => {
          const avgA = ((a.rating_on_time || 0) + (a.rating_quality || 0) + (a.rating_communication || 0)) / 3;
          const avgB = ((b.rating_on_time || 0) + (b.rating_quality || 0) + (b.rating_communication || 0)) / 3;
          return avgA - avgB;
        });
      default:
        return sorted;
    }
  };

  const getReviewTrend = (review: ReviewData) => {
    const avg = ((review.rating_on_time || 0) + (review.rating_quality || 0) + (review.rating_communication || 0)) / 3;
    if (avg >= 4) return { icon: TrendingUp, color: "text-green-500", label: "Positive" };
    if (avg <= 2) return { icon: TrendingDown, color: "text-red-500", label: "Negative" };
    return { icon: Minus, color: "text-muted-foreground", label: "Neutral" };
  };

  const handleMarkAsFeedback = async () => {
    if (!feedbackConfirmReviewId || !user) return;
    
    setMarkingFeedback(true);
    const result = await markReviewAsFeedback(feedbackConfirmReviewId, user.id);
    setMarkingFeedback(false);
    setFeedbackConfirmReviewId(null);

    if (result.success) {
      toast.success("Review marked as Feedback. It will no longer count against your score.");
      // Reload data
      loadReviewsData();
    } else {
      toast.error(result.error || "Failed to mark review as feedback");
    }
  };

  const renderReviewCard = (review: ReviewData, isReceived: boolean) => {
    const trend = getReviewTrend(review);
    const TrendIcon = trend.icon;
    const displayUserId = isReceived ? review.reviewer_id : review.reviewee_id;
    const displayAnonymousId = isReceived ? review.reviewerAnonymousId : review.revieweeAnonymousId;

    const isCoaching = review.status === "coaching";
    const isPublished = review.status === "published" || !review.status;
    const showFeedbackButton = isReceived && !review.is_feedback && !isCoaching && canUseFeedbackReset;
    const showCoachingButton = isReceived && isPublished && !review.is_feedback && canUseCoaching;

    return (
      <Card key={review.id} className={`mb-3 ${isCoaching ? "border-amber-500/30 bg-amber-500/5" : ""}`}>
        <CardContent className="pt-6">
          {/* Coaching banner for coaching reviews */}
          {isCoaching && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <GraduationCap className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
                    Coaching / Private Feedback
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    This review no longer affects your public rating.
                  </p>
                  {review.coaching_note && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Your note: "{review.coaching_note}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">
                {displayAnonymousId || `Vendor#${displayUserId.substring(0, 6)}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProfileDialogUserId(displayUserId);
                  setShowProfileDialog(true);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {review.is_exit_review && (
                <Badge variant="outline" className="text-xs">
                  Exit Review
                </Badge>
              )}
              {/* Status badges */}
              {isPublished && !review.is_feedback && (
                <Badge variant="secondary" className="text-xs">
                  Public
                </Badge>
              )}
              {isCoaching && (
                <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-600 border-amber-500/30">
                  Coaching
                </Badge>
              )}
              {review.is_feedback && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-600 border-amber-500/30 cursor-help">
                        Feedback – Not scored
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>This review is visible for learning purposes but is excluded from Trust Score calculations.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-4 w-4 ${trend.color}`} />
              <span className="text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {isReceived ? "On-Time" : "Helpfulness"}
              </p>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-secondary text-secondary" />
                <span className="text-sm font-medium">{review.rating_on_time || "—"} / 5</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {isReceived ? "Quality" : "Communication"}
              </p>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-secondary text-secondary" />
                <span className="text-sm font-medium">{review.rating_quality || "—"} / 5</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {isReceived ? "Communication" : "Consistent Pay"}
              </p>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-secondary text-secondary" />
                <span className="text-sm font-medium">{review.rating_communication || "—"} / 5</span>
              </div>
            </div>
          </div>

          {review.comment && (
            <p className="text-sm text-muted-foreground italic mb-3">"{review.comment}"</p>
          )}

          {/* Action buttons for received reviews */}
          {isReceived && isPublished && !review.is_feedback && (
            <div className="pt-3 border-t border-border flex flex-wrap gap-2 items-center">
              {/* Move to Coaching button */}
              {showCoachingButton ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCoachingDialogReviewId(review.id)}
                  className="text-xs"
                >
                  <GraduationCap className="h-3 w-3 mr-1.5" />
                  Move to Coaching
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="text-xs opacity-50"
                      >
                        <GraduationCap className="h-3 w-3 mr-1.5" />
                        Move to Coaching
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>You've already moved the maximum number of reviews ({MAX_COACHING_REVIEWS}) into Coaching. Please focus on improving your process before converting more.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Mark as Feedback button */}
              {showFeedbackButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFeedbackConfirmReviewId(review.id)}
                  className="text-xs"
                >
                  <MessageSquare className="h-3 w-3 mr-1.5" />
                  Mark as Feedback
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const sortedReceived = sortReviews(receivedReviews);
  const sortedGiven = sortReviews(givenReviews);

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reviews</h1>
            <p className="text-muted-foreground mt-1">View reviews you've received and given</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        {/* Reputation Snapshot */}
        <RepReputationSnapshotNew
          trustScore={trustScore || 3.0}
          reviewCount={reviewCount}
          recentReviewCount={recentReviewCount}
          onTime={{
            lifetime: avgOnTime || 0,
            recent: recentAvgOnTime || avgOnTime || 0,
          }}
          quality={{
            lifetime: avgQuality || 0,
            recent: recentAvgQuality || avgQuality || 0,
          }}
          communication={{
            lifetime: avgCommunication || 0,
            recent: recentAvgCommunication || avgCommunication || 0,
          }}
        />

        {/* Share Panel */}
        <ReputationSharePanel roleType="rep" />

        {/* Trust Score Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Reputation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  Trust Score: {trustScore?.toFixed(1)} / 5
                </Badge>
                {reviewCount === 0 && (
                  <Badge variant="outline" className="text-xs">
                    New – not yet rated
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Based on {reviewCount} review{reviewCount !== 1 ? "s" : ""}
              </p>
              
              {/* Public vs Coaching counts */}
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-muted-foreground">
                  Public Reviews: <span className="font-medium text-foreground">{publicReviewCount}</span>
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                        Private Feedback / Coaching: <span className="font-medium text-foreground">{coachingReviewCount}</span>
                        <Info className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>These are reviews you moved into a private coaching bucket. They no longer affect your public rating, but are still visible to the original vendor and ClearMarket Admins.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <p className="text-xs text-muted-foreground mt-1">
                Everyone starts in the middle. Your Trust Score adjusts as verified reviews are added.
              </p>
            </div>

            {reviewCount > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">On-Time</p>
                  <p className="text-sm font-medium">{avgOnTime?.toFixed(1) || "—"} / 5</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Quality</p>
                  <p className="text-sm font-medium">{avgQuality?.toFixed(1) || "—"} / 5</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Communication</p>
                  <p className="text-sm font-medium">{avgCommunication?.toFixed(1) || "—"} / 5</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs: Received vs Given */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "received" | "given")}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="received">
                Received ({receivedReviews.length})
              </TabsTrigger>
              <TabsTrigger value="given">
                Given ({givenReviews.length})
              </TabsTrigger>
            </TabsList>

            <Select value={sortOrder} onValueChange={(val) => setSortOrder(val as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border">
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="highest">Highest rated</SelectItem>
                <SelectItem value="lowest">Lowest rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="received">
            {/* Helper text for feedback reset */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Once every 30 days, you can mark one review as Feedback. Feedback reviews stay visible but don't affect your Trust Score.
              </p>
            </div>
            {sortedReceived.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No reviews yet. As you work with more vendors, verified reviews will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              sortedReceived.map(review => renderReviewCard(review, true))
            )}
          </TabsContent>

          <TabsContent value="given">
            {sortedGiven.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    You haven't left any reviews yet. You can leave Exit Reviews when disconnecting, or through your existing connections.
                  </p>
                </CardContent>
              </Card>
            ) : (
              sortedGiven.map(review => renderReviewCard(review, false))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {showProfileDialog && profileDialogUserId && (
        <PublicProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          targetUserId={profileDialogUserId}
        />
      )}

      {/* Feedback Confirmation Dialog */}
      <AlertDialog open={!!feedbackConfirmReviewId} onOpenChange={(open) => !open && setFeedbackConfirmReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this review as Feedback?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This uses your one Feedback reset for the next 30 days. The review will stay visible, but it won't count against your score.</p>
                <p className="text-muted-foreground text-xs">
                  The vendor who wrote this review will be notified that you chose to treat it as feedback.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markingFeedback}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAsFeedback} disabled={markingFeedback}>
              {markingFeedback ? "Marking..." : "Yes, treat as Feedback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to Coaching Dialog */}
      {coachingDialogReviewId && user && (
        <MoveToCoachingDialog
          open={!!coachingDialogReviewId}
          onOpenChange={(open) => !open && setCoachingDialogReviewId(null)}
          reviewId={coachingDialogReviewId}
          repUserId={user.id}
          onSuccess={() => loadReviewsData()}
        />
      )}
    </AuthenticatedLayout>
  );
}
