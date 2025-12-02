import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Eye, TrendingUp, TrendingDown, Minus, Star } from "lucide-react";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { VendorReputationSnapshot } from "@/components/VendorReputationSnapshot";
import { ReputationSharePanel } from "@/components/ReputationSharePanel";

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
  // Enriched data
  reviewerAnonymousId?: string;
  revieweeAnonymousId?: string;
  reviewerFirstName?: string;
  revieweeFirstName?: string;
}

export default function VendorReviews() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"received" | "given">("received");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  
  // Trust Score data
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgHelpfulness, setAvgHelpfulness] = useState<number | null>(null);
  const [avgCommunication, setAvgCommunication] = useState<number | null>(null);
  const [avgPay, setAvgPay] = useState<number | null>(null);

  // Reviews data
  const [receivedReviews, setReceivedReviews] = useState<ReviewData[]>([]);
  const [givenReviews, setGivenReviews] = useState<ReviewData[]>([]);

  // Dialog state
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);

  // Recent reviews (90 days)
  const [recentReviewCount, setRecentReviewCount] = useState(0);
  const [recentAvgHelpfulness, setRecentAvgHelpfulness] = useState<number | null>(null);
  const [recentAvgCommunication, setRecentAvgCommunication] = useState<number | null>(null);
  const [recentAvgPay, setRecentAvgPay] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      checkAccess();
    }
  }, [user, authLoading]);

  const checkAccess = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_vendor_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_vendor_admin) {
      toast.error("Access denied: Vendor role required");
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

      // Fetch received reviews (rep_to_vendor)
      const { data: received, error: receivedError } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewee_id", user.id)
        .eq("direction", "rep_to_vendor")
        .order("created_at", { ascending: false });

      if (receivedError) throw receivedError;

      // Fetch given reviews (vendor_to_rep)
      const { data: given, error: givenError } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewer_id", user.id)
        .eq("direction", "vendor_to_rep")
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
        const helpfulnessSum = received.reduce((sum, r) => sum + (r.rating_on_time || 0), 0);
        const communicationSum = received.reduce((sum, r) => sum + (r.rating_quality || 0), 0);
        const paySum = received.reduce((sum, r) => sum + (r.rating_communication || 0), 0);
        
        setAvgHelpfulness(helpfulnessSum / received.length);
        setAvgCommunication(communicationSum / received.length);
        setAvgPay(paySum / received.length);
      }

      // Calculate recent (90 days) averages
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const recentReviews = (received || []).filter(
        r => new Date(r.created_at) >= ninetyDaysAgo
      );

      setRecentReviewCount(recentReviews.length);
      
      if (recentReviews.length > 0) {
        const recentHelpSum = recentReviews.reduce((sum, r) => sum + (r.rating_on_time || 0), 0);
        const recentCommSum = recentReviews.reduce((sum, r) => sum + (r.rating_quality || 0), 0);
        const recentPaySum = recentReviews.reduce((sum, r) => sum + (r.rating_communication || 0), 0);
        
        setRecentAvgHelpfulness(recentHelpSum / recentReviews.length);
        setRecentAvgCommunication(recentCommSum / recentReviews.length);
        setRecentAvgPay(recentPaySum / recentReviews.length);
      } else {
        // No recent reviews, use lifetime averages as recent
        setRecentAvgHelpfulness(avgHelpfulness);
        setRecentAvgCommunication(avgCommunication);
        setRecentAvgPay(avgPay);
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

    // Fetch rep profiles
    const { data: repProfiles } = await supabase
      .from("rep_profile")
      .select("user_id, anonymous_id, profiles:user_id(full_name)")
      .in("user_id", uniqueIds);

    const profileMap = new Map();
    (repProfiles || []).forEach(p => {
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

  const renderReviewCard = (review: ReviewData, isReceived: boolean) => {
    const trend = getReviewTrend(review);
    const TrendIcon = trend.icon;
    const displayUserId = isReceived ? review.reviewer_id : review.reviewee_id;
    const displayAnonymousId = isReceived ? review.reviewerAnonymousId : review.revieweeAnonymousId;

    return (
      <Card key={review.id} className="mb-3">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {displayAnonymousId || `FieldRep#${displayUserId.substring(0, 6)}`}
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
                {isReceived ? "Helpfulness" : "On-Time"}
              </p>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-secondary text-secondary" />
                <span className="text-sm font-medium">{review.rating_on_time || "—"} / 5</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Communication</p>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-secondary text-secondary" />
                <span className="text-sm font-medium">{review.rating_quality || "—"} / 5</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {isReceived ? "Consistent Pay" : "Communication"}
              </p>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-secondary text-secondary" />
                <span className="text-sm font-medium">{review.rating_communication || "—"} / 5</span>
              </div>
            </div>
          </div>

          {review.comment && (
            <p className="text-sm text-muted-foreground italic">"{review.comment}"</p>
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Reviews</h1>
              <p className="text-muted-foreground mt-1">
                View reviews you've received and given
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Reputation Snapshot */}
        <VendorReputationSnapshot
          trustScore={trustScore || 3.0}
          reviewCount={reviewCount}
          recentReviewCount={recentReviewCount}
          helpfulness={{
            lifetime: avgHelpfulness || 0,
            recent: recentAvgHelpfulness || avgHelpfulness || 0,
          }}
          communication={{
            lifetime: avgCommunication || 0,
            recent: recentAvgCommunication || avgCommunication || 0,
          }}
          payConsistency={{
            lifetime: avgPay || 0,
            recent: recentAvgPay || avgPay || 0,
          }}
        />

        {/* Share Panel */}
        <ReputationSharePanel roleType="vendor" />

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
              <p className="text-xs text-muted-foreground mt-1">
                Everyone starts in the middle. Your Trust Score adjusts as verified reviews are added.
              </p>
            </div>

            {reviewCount > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Helpfulness</p>
                  <p className="text-sm font-medium">{avgHelpfulness?.toFixed(1) || "—"} / 5</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Communication</p>
                  <p className="text-sm font-medium">{avgCommunication?.toFixed(1) || "—"} / 5</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Consistent Pay</p>
                  <p className="text-sm font-medium">{avgPay?.toFixed(1) || "—"} / 5</p>
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
            {sortedReceived.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No reviews yet. As you work with more field reps, verified reviews will appear here.
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
    </div>
  );
}
