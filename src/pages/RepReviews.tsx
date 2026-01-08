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
import { toast } from "sonner";
import { Info } from "lucide-react";
import { 
  fetchTrustScoresForUsers, 
  acceptReview, 
  disputeReview, 
  toggleReviewSpotlight,
  getReviewWorkflowCounts 
} from "@/lib/reviews";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { RepReputationSnapshotNew } from "@/components/RepReputationSnapshotNew";
import { ReputationSharePanel } from "@/components/ReputationSharePanel";

import { ReviewsTable, ReviewRowData } from "@/components/ReviewsTable";
import { AcceptReviewDialog } from "@/components/AcceptReviewDialog";
import { DisputeReviewDialog } from "@/components/DisputeReviewDialog";
import { reviewsCopy } from "@/copy/reviewsCopy";

export default function RepReviews() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"received" | "given">("received");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  
  // Trust Score data
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgOnTime, setAvgOnTime] = useState<number | null>(null);
  const [avgQuality, setAvgQuality] = useState<number | null>(null);
  const [avgCommunication, setAvgCommunication] = useState<number | null>(null);

  // Reviews data
  const [receivedReviews, setReceivedReviews] = useState<ReviewRowData[]>([]);
  const [givenReviews, setGivenReviews] = useState<ReviewRowData[]>([]);

  // Workflow counts
  const [workflowCounts, setWorkflowCounts] = useState({ pending: 0, accepted: 0, disputed: 0, coaching: 0 });

  // Dialog state
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);

  // Accept/Dispute dialog state
  const [acceptDialogReview, setAcceptDialogReview] = useState<ReviewRowData | null>(null);
  const [disputeDialogReview, setDisputeDialogReview] = useState<ReviewRowData | null>(null);

  // Recent reviews (90 days)
  const [recentReviewCount, setRecentReviewCount] = useState(0);
  const [recentAvgOnTime, setRecentAvgOnTime] = useState<number | null>(null);
  const [recentAvgQuality, setRecentAvgQuality] = useState<number | null>(null);
  const [recentAvgCommunication, setRecentAvgCommunication] = useState<number | null>(null);

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

      // Fetch workflow counts
      const counts = await getReviewWorkflowCounts(user.id);
      setWorkflowCounts(counts);

      // Fetch received reviews (vendor_to_rep)
      const { data: received, error: receivedError } = await supabase
        .from("reviews")
        .select("id, reviewer_id, reviewee_id, rating_on_time, rating_quality, rating_communication, comment, created_at, is_exit_review, direction, is_feedback, status, workflow_status, is_spotlighted, state_code, county_name, inspection_category")
        .eq("reviewee_id", user.id)
        .eq("direction", "vendor_to_rep")
        .order("created_at", { ascending: false });

      if (receivedError) throw receivedError;

      // Fetch given reviews (rep_to_vendor)
      const { data: given, error: givenError } = await supabase
        .from("reviews")
        .select("id, reviewer_id, reviewee_id, rating_on_time, rating_quality, rating_communication, comment, created_at, is_exit_review, direction, state_code, county_name, inspection_category, workflow_status")
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

      // Calculate category averages for ACCEPTED received reviews only
      const acceptedReviews = (received || []).filter(r => r.workflow_status === "accepted" && r.status !== "coaching");
      if (acceptedReviews.length > 0) {
        const onTimeSum = acceptedReviews.reduce((sum, r) => sum + (r.rating_on_time || 0), 0);
        const qualitySum = acceptedReviews.reduce((sum, r) => sum + (r.rating_quality || 0), 0);
        const communicationSum = acceptedReviews.reduce((sum, r) => sum + (r.rating_communication || 0), 0);
        
        setAvgOnTime(onTimeSum / acceptedReviews.length);
        setAvgQuality(qualitySum / acceptedReviews.length);
        setAvgCommunication(communicationSum / acceptedReviews.length);
      }

      // Calculate recent (90 days) averages from accepted reviews
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const recentReviews = acceptedReviews.filter(
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

  const enrichReviews = async (reviews: any[], role: "reviewer" | "reviewee"): Promise<ReviewRowData[]> => {
    if (reviews.length === 0) return [];

    const userIds = reviews.map(r => role === "reviewer" ? r.reviewer_id : r.reviewee_id);
    const uniqueIds = [...new Set(userIds)];

    // Fetch vendor profiles for reviewers (when role=reviewer) or rep profiles (when role=reviewee)
    const tableName = role === "reviewer" ? "vendor_profile" : "rep_profile";
    const { data: profiles } = await supabase
      .from(tableName)
      .select("user_id, anonymous_id, profiles:user_id(full_name)")
      .in("user_id", uniqueIds);

    const profileMap = new Map();
    (profiles || []).forEach(p => {
      const fullName = (p.profiles as any)?.full_name || "";
      const firstName = fullName.split(" ")[0] || "";
      profileMap.set(p.user_id, {
        anonymousId: p.anonymous_id,
        firstName,
      });
    });

    return reviews.map(r => ({
      ...r,
      displayAnonymousId: profileMap.get(role === "reviewer" ? r.reviewer_id : r.reviewee_id)?.anonymousId,
      displayName: profileMap.get(role === "reviewer" ? r.reviewer_id : r.reviewee_id)?.firstName,
    }));
  };

  const sortReviews = (reviews: ReviewRowData[]) => {
    const sorted = [...reviews];
    if (sortOrder === "newest") {
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const handleAcceptReview = async (spotlight: boolean) => {
    if (!acceptDialogReview || !user) return;
    
    const result = await acceptReview(acceptDialogReview.id, user.id, spotlight);
    if (result.success) {
      toast.success("Review accepted and will now count toward your Trust Score.");
      loadReviewsData();
    } else {
      toast.error(result.error || "Failed to accept review");
    }
  };

  const handleDisputeReview = async (reason: string, note: string) => {
    if (!disputeDialogReview || !user) return;
    
    const result = await disputeReview(disputeDialogReview.id, user.id, reason, note);
    if (result.success) {
      toast.success("Review disputed. It will not count toward your Trust Score until it's been reviewed.");
      loadReviewsData();
    } else {
      toast.error(result.error || "Failed to dispute review");
    }
  };

  const handleToggleSpotlight = async (review: ReviewRowData) => {
    if (!user) return;
    
    const result = await toggleReviewSpotlight(review.id, user.id);
    if (result.success) {
      toast.success(result.isSpotlighted ? "Review spotlighted on your profile." : "Spotlight removed.");
      loadReviewsData();
    } else {
      toast.error(result.error || "Failed to update spotlight");
    }
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
  <>
    <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">{reviewsCopy.common.sectionTitle}</h1>
          <p className="text-muted-foreground mt-1">
            {reviewsCopy.common.sectionSubtitle}
          </p>
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

        {/* Trust Score Summary with counts */}
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
                Based on {workflowCounts.accepted} accepted review{workflowCounts.accepted !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Review counts summary */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Accepted:</span>
                <Badge variant="secondary" className="bg-green-500/20 text-green-600 border-green-500/30">
                  {workflowCounts.accepted}
                </Badge>
              </div>
              {workflowCounts.pending > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Pending:</span>
                  <Badge variant="outline">{workflowCounts.pending}</Badge>
                </div>
              )}
              {workflowCounts.disputed > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Disputed:</span>
                  <Badge variant="destructive">{workflowCounts.disputed}</Badge>
                </div>
              )}
              {workflowCounts.coaching > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Coaching:</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                            {workflowCounts.coaching}
                          </Badge>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Reviews moved to coaching no longer affect your public rating but are visible to the original vendor and admins.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>

            {reviewCount > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">On-Time</p>
                  <p className="text-sm font-medium">{avgOnTime?.toFixed(1) || "—"} / 5</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Quality of Work</p>
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
                {reviewsCopy.repView.receivedTitle} ({receivedReviews.length})
              </TabsTrigger>
              <TabsTrigger value="given">
                {reviewsCopy.repView.givenTitle} ({givenReviews.length})
              </TabsTrigger>
            </TabsList>

            <Select value={sortOrder} onValueChange={(val) => setSortOrder(val as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border">
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="received" className="space-y-4">
            <ReviewsTable
              reviews={sortedReceived}
              variant="received"
              isRepView={true}
              onViewProfile={(userId) => {
                setProfileDialogUserId(userId);
                setShowProfileDialog(true);
              }}
              onAccept={(review) => setAcceptDialogReview(review)}
              onDispute={(review) => setDisputeDialogReview(review)}
              onToggleSpotlight={handleToggleSpotlight}
            />
          </TabsContent>

          <TabsContent value="given" className="space-y-4">
            <ReviewsTable
              reviews={sortedGiven}
              variant="given"
              isRepView={true}
              onViewProfile={(userId) => {
                setProfileDialogUserId(userId);
                setShowProfileDialog(true);
              }}
            />
          </TabsContent>
      </Tabs>
    </div>

    {/* Profile Dialog */}
    <PublicProfileDialog
      open={showProfileDialog}
      onOpenChange={setShowProfileDialog}
      targetUserId={profileDialogUserId}
    />

    {/* Accept Dialog */}
    <AcceptReviewDialog
      open={!!acceptDialogReview}
      onOpenChange={(open) => !open && setAcceptDialogReview(null)}
      onConfirm={handleAcceptReview}
    />

    {/* Dispute Dialog */}
    <DisputeReviewDialog
      open={!!disputeDialogReview}
      onOpenChange={(open) => !open && setDisputeDialogReview(null)}
      onConfirm={handleDisputeReview}
    />
  </>
  );
}
