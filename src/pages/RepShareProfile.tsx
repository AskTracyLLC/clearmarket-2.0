import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, Calendar, Shield, Key, Wrench, CheckCircle, ExternalLink, Users, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { fetchPublicProfileShare } from "@/lib/reputationSharing";
import { getPublicBaseUrl } from "@/lib/publicUrl";

interface RepProfileData {
  role: "rep";
  anonymous_id: string;
  display_name: string;
  location: string | null;
  bio: string | null;
  trust_score: number;
  review_count: number;
  community_score: number;
  dimensions: { on_time: number; quality: number; communication: number };
  systems_used: string[];
  inspection_types: string[];
  coverage_summary: string[];
  coverage_states: string[];
  background_check_status: string;
  has_hud_keys: boolean | null;
  hud_keys_details: string | null;
  equipment_notes: string | null;
  certifications: string[];
  is_accepting_new_vendors: boolean;
  willing_to_travel: boolean;
  last_active: string | null;
  recent_reviews: any[];
}

export default function RepShareProfile() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<RepProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Invalid profile URL");
      setLoading(false);
      return;
    }
    loadProfile();
  }, [slug]);

  async function loadProfile() {
    try {
      const profileData = await fetchPublicProfileShare(slug!);
      
      if (profileData.role !== 'rep') {
        setError("This is not a Field Rep profile");
        return;
      }

      setProfile(profileData);
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(err.message || "Profile not found or disabled");
    } finally {
      setLoading(false);
    }
  }

  const renderStars = (rating: number) => {
    if (!rating || rating === 0) return null;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted'
            }`}
          />
        ))}
        <span className="ml-2 text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardContent className="p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
              <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardContent className="p-12 text-center space-y-4">
            <div className="text-6xl">🔒</div>
            <h1 className="text-2xl font-bold">Profile Not Available</h1>
            <p className="text-muted-foreground">
              {error || "This shared profile is no longer available. The owner may have disabled the link."}
            </p>
            <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline">
              Visit ClearMarket <ExternalLink className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <h2 className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              ClearMarket Profile
            </h2>
          </Link>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-3xl">{profile.display_name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Field Representative</Badge>
                  <span className="text-sm text-muted-foreground">{profile.anonymous_id}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </div>
              )}
              {profile.last_active && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Active {formatDistanceToNow(new Date(profile.last_active), { addSuffix: true })}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Bio */}
            {profile.bio && (
              <>
                <div className="space-y-2">
                  <h3 className="font-semibold">About</h3>
                  <p className="text-muted-foreground">{profile.bio}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Trust & Community Score */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold">Trust Score</h3>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-primary">
                    {profile.trust_score.toFixed(1)}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">
                      Based on {profile.review_count} {profile.review_count === 1 ? 'review' : 'reviews'}
                    </div>
                    {profile.review_count === 0 && (
                      <Badge variant="outline" className="text-xs">New – building reputation</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold">Community Score</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-semibold">{profile.community_score}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Ratings */}
            {profile.review_count > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold">Performance Ratings</h3>
                  <div className="grid gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">On-Time Performance</div>
                      {renderStars(profile.dimensions.on_time)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Quality of Inspections</div>
                      {renderStars(profile.dimensions.quality)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Communication</div>
                      {renderStars(profile.dimensions.communication)}
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Systems & Inspection Types */}
            <div className="grid sm:grid-cols-2 gap-6">
              {profile.systems_used.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Systems I Use</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.systems_used.map((system) => (
                      <Badge key={system} variant="outline">{system}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.inspection_types.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Inspection Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.inspection_types.map((type) => (
                      <Badge key={type} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Coverage */}
            <div className="space-y-3">
              <h3 className="font-semibold">Coverage Areas</h3>
              {profile.coverage_summary.length > 0 ? (
                <div className="space-y-2">
                  {profile.coverage_summary.map((summary, idx) => (
                    <div key={idx} className="text-muted-foreground">{summary}</div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Coverage areas not specified</p>
              )}
            </div>

            <Separator />

            {/* Background Check & Capabilities */}
            <div className="space-y-4">
              <h3 className="font-semibold">Background Check & Capabilities</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className={`h-5 w-5 ${profile.background_check_status.includes('Completed') ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span>Background Check: {profile.background_check_status}</span>
                </div>
                {profile.has_hud_keys && (
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <span>HUD Keys: {profile.hud_keys_details || 'Yes'}</span>
                  </div>
                )}
                {profile.equipment_notes && (
                  <div className="flex items-start gap-2">
                    <Wrench className="h-5 w-5 mt-0.5" />
                    <span>{profile.equipment_notes}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Availability */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${profile.is_accepting_new_vendors ? 'text-green-500' : 'text-muted-foreground'}`} />
                <span>
                  {profile.is_accepting_new_vendors ? 'Accepting new vendors' : 'Not currently accepting new vendors'}
                </span>
              </div>
              {profile.willing_to_travel && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  <span>Willing to travel out of state</span>
                </div>
              )}
            </div>

            {/* Recent Reviews */}
            {profile.recent_reviews.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold">Recent Feedback</h3>
                  <div className="space-y-4">
                    {profile.recent_reviews.map((review: any, idx: number) => (
                      <Card key={idx} className="border-muted">
                        <CardContent className="pt-4 space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                          </div>
                          <div className="flex gap-4 text-sm">
                            {review.dimension_scores.on_time && (
                              <div>On-Time: {review.dimension_scores.on_time}/5</div>
                            )}
                            {review.dimension_scores.quality && (
                              <div>Quality: {review.dimension_scores.quality}/5</div>
                            )}
                            {review.dimension_scores.communication && (
                              <div>Communication: {review.dimension_scores.communication}/5</div>
                            )}
                          </div>
                          {review.comment && (
                            <p className="text-muted-foreground italic">"{review.comment}"</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* CTA Panel */}
        {!user ? (
          <Card className="border-primary/30 bg-card-elevated">
            <CardContent className="p-6 text-center space-y-4">
              <h3 className="text-xl font-semibold">Not on ClearMarket yet?</h3>
              <p className="text-muted-foreground">
                Join ClearMarket to connect with field reps and vendors, build your reputation, and track coverage opportunities.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate("/signup?vendor=1")}>
                  Join as Vendor
                </Button>
                <Button variant="secondary" onClick={() => navigate("/signup?rep=1")}>
                  Join as Field Rep
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card-elevated border-border">
            <CardContent className="p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Already on ClearMarket? Head back to your dashboard to manage your own profile and connections.
              </p>
              <Button variant="secondary" size="sm" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Branding Footer with Website URL */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <a 
              href={getPublicBaseUrl()} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {getPublicBaseUrl().replace(/^https?:\/\//, '')}
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Profile hosted by ClearMarket. Information provided by the profile owner.
          </p>
        </div>
      </div>
    </div>
  );
}