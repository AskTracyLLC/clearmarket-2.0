import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { fetchTrustScoresForUsers } from "@/lib/reviews";
import { fetchCommunityScoresForUsers, formatCommunityScore } from "@/lib/communityScore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ReviewData {
  id: string;
  reviewer_id: string;
  rating_on_time: number | null;
  rating_quality: number | null;
  rating_communication: number | null;
  comment: string | null;
  created_at: string;
  is_exit_review: boolean;
  reviewerAnonymousId?: string;
}

export default function PublicVendorReviews() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [trustScore, setTrustScore] = useState<number>(3.0);
  const [reviewCount, setReviewCount] = useState(0);
  const [communityScore, setCommunityScore] = useState<number>(0);
  const [reviews, setReviews] = useState<ReviewData[]>([]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      // Check if this is a valid vendor user
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendor_profile")
        .select("user_id, anonymous_id, company_name, city, state")
        .eq("user_id", id)
        .maybeSingle();

      if (vendorError || !vendorData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setVendorProfile(vendorData);

      // Fetch trust score
      const trustScores = await fetchTrustScoresForUsers([id]);
      const userTrust = trustScores[id];
      setTrustScore(userTrust?.average ?? 3.0);
      setReviewCount(userTrust?.count ?? 0);

      // Fetch community score
      const communityScores = await fetchCommunityScoresForUsers([id]);
      setCommunityScore(communityScores[id]?.communityScore ?? 0);

      // Fetch last 5 ACCEPTED reviews (rep_to_vendor direction) with proper exclusion filters
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewee_id", id)
        .eq("direction", "rep_to_vendor")
        .eq("workflow_status", "accepted")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (reviewsData && reviewsData.length > 0) {
        // Enrich with reviewer info
        const reviewerIds = [...new Set(reviewsData.map(r => r.reviewer_id))];
        const { data: repProfiles } = await supabase
          .from("rep_profile")
          .select("user_id, anonymous_id")
          .in("user_id", reviewerIds);

        const profileMap = new Map<string, string>();
        (repProfiles || []).forEach(p => {
          profileMap.set(p.user_id, p.anonymous_id || `FieldRep#${p.user_id.substring(0, 6)}`);
        });

        const enriched = reviewsData.map(r => ({
          ...r,
          reviewerAnonymousId: profileMap.get(r.reviewer_id) || `FieldRep#${r.reviewer_id.substring(0, 6)}`,
        }));

        setReviews(enriched);
      }
    } catch (error) {
      console.error("Error loading public vendor reviews:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const getReviewTrend = (review: ReviewData) => {
    const avg = ((review.rating_on_time || 0) + (review.rating_quality || 0) + (review.rating_communication || 0)) / 3;
    if (avg >= 4) return { icon: TrendingUp, color: "text-green-500" };
    if (avg <= 2) return { icon: TrendingDown, color: "text-red-500" };
    return { icon: Minus, color: "text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Vendor not found.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {vendorProfile?.anonymous_id || vendorProfile?.company_name || "Vendor"} Reputation
              </h1>
              <p className="text-muted-foreground mt-1">
                {vendorProfile?.city && vendorProfile?.state ? `${vendorProfile.city}, ${vendorProfile.state}` : "Public reputation snapshot"}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Trust Score & Community Score */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Trust Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-xl px-4 py-2">
                  {trustScore.toFixed(1)} / 5
                </Badge>
                {reviewCount === 0 && (
                  <Badge variant="outline" className="text-xs">New – not yet rated</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Based on {reviewCount} review{reviewCount !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4" />
                Community Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant={communityScore >= 0 ? "secondary" : "outline"} 
                    className="text-xl px-4 py-2 cursor-help"
                  >
                    {formatCommunityScore(communityScore)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Community Score is based on how other members rate this user's posts and comments as Helpful or Not Helpful on the Community Board.</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-sm text-muted-foreground mt-2">
                From Community Board activity
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Reviews */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No reviews yet. This vendor hasn't received any verified reviews.
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const trend = getReviewTrend(review);
                  const TrendIcon = trend.icon;
                  
                  return (
                    <div key={review.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">
                            {review.reviewerAnonymousId}
                          </span>
                          {review.is_exit_review && (
                            <Badge variant="outline" className="text-xs">Exit Review</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendIcon className={`h-4 w-4 ${trend.color}`} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-secondary text-secondary" />
                          <span className="text-xs text-muted-foreground">Helpfulness: {review.rating_on_time || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-secondary text-secondary" />
                          <span className="text-xs text-muted-foreground">Comm: {review.rating_quality || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-secondary text-secondary" />
                          <span className="text-xs text-muted-foreground">Pay: {review.rating_communication || "—"}</span>
                        </div>
                      </div>

                      {review.comment && (
                        <p className="text-sm text-muted-foreground italic">"{review.comment}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          This is a public, read-only view of reputation data on ClearMarket.
        </p>
      </div>
    </div>
  );
}
