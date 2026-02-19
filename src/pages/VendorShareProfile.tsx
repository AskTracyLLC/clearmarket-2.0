import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, Calendar, CheckCircle, ExternalLink, Users, Globe, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { fetchPublicProfileShare } from "@/lib/reputationSharing";
import { getPublicBaseUrl } from "@/lib/publicUrl";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { US_STATES } from "@/lib/constants";

type ProfileView = 'client' | 'recruiting';

// Helper to get state name from code
function getStateName(code: string): string {
  const state = US_STATES.find(s => s.value === code);
  return state?.label || code;
}

// Structured coverage detail from the edge function
interface CoverageDetail {
  stateCode: string;
  stateName: string;
  coverageMode: string; // 'entire_state' | 'entire_state_except' | 'selected_counties'
  counties: string[];
}

// Parse coverage_details from the API response
function normalizeCoverageDetails(details: any[]): CoverageDetail[] {
  return (details || []).map(d => ({
    stateCode: d.state_code,
    stateName: d.state_name,
    coverageMode: d.coverage_mode || 'selected_counties',
    counties: d.counties || [],
  })).sort((a, b) => a.stateCode.localeCompare(b.stateCode));
}

interface SeekingCoverageArea {
  state_code: string;
  counties: string[];
}

interface VendorProfileData {
  role: "vendor";
  anonymous_id: string;
  company_name: string;
  display_name: string;
  contact_name: string | null;
  location: string | null;
  company_description: string | null;
  website: string | null;
  trust_score: number;
  review_count: number;
  community_score: number;
  hide_trust_score_override: boolean;
  hide_community_score_override: boolean;
  dimensions: { on_time: number; quality: number; communication: number };
  systems_used: string[];
  inspection_types: string[];
  coverage_summary: string[];
  coverage_details?: Array<{
    state_code: string;
    state_name: string;
    coverage_mode: string;
    counties: string[];
  }>;
  coverage_states: string[];
  is_accepting_new_reps: boolean;
  seeking_coverage_areas?: SeekingCoverageArea[];
  last_active: string | null;
  recent_reviews: any[];
}

export default function VendorShareProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<VendorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine view mode from query param
  const viewMode: ProfileView = useMemo(() => {
    const v = searchParams.get('view');
    return v === 'client' ? 'client' : 'recruiting';
  }, [searchParams]);

  const isClientView = viewMode === 'client';

  // County detail toggle: counties=1 shows details, default is OFF
  const countiesParam = searchParams.get('counties');
  const showCountyDetails = countiesParam === '1';

  // Coverage footprint toggle for recruiting view
  const showCoverage = searchParams.get('showCoverage') === '1';

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
      
      if (profileData.role !== 'vendor') {
        setError("This is not a Vendor profile");
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
                <CardTitle className="text-3xl">{profile.company_name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Vendor Company</Badge>
                  <span className="text-sm text-muted-foreground">{profile.anonymous_id}</span>
                </div>
                {profile.contact_name && (
                  <p className="text-sm text-muted-foreground">Contact: {profile.contact_name}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </div>
              )}
              {profile.website && (
                <a 
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  Website
                </a>
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
            {/* Company Description */}
            {profile.company_description && (
              <>
                <div className="space-y-2">
                  <h3 className="font-semibold">About the Company</h3>
                  <p className="text-muted-foreground">{profile.company_description}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Trust & Community Score */}
            {(() => {
              const trustVisible = profile.review_count >= 3 && !profile.hide_trust_score_override;
              const communityVisible = (profile.community_score >= 10) && !profile.hide_community_score_override;
              return (
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold">Trust Score</h3>
                    {trustVisible ? (
                      <div className="flex items-center gap-4">
                        <div className="text-4xl font-bold text-primary">
                          {profile.trust_score.toFixed(1)}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            Based on {profile.review_count} {profile.review_count === 1 ? 'review' : 'reviews'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Building reputation — Trust Score appears after 3 verified reviews.
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-semibold">Community Score</h3>
                    {communityVisible ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <span className="text-2xl font-semibold">{profile.community_score}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Building activity — Community Score appears after 10 helpful actions.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}



            {/* Performance Ratings */}
            {profile.review_count > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold">Performance Ratings</h3>
                  <div className="grid gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Helpfulness & Support</div>
                      {renderStars(profile.dimensions.on_time)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Communication</div>
                      {renderStars(profile.dimensions.quality)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Pay Reliability</div>
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
                  <h3 className="font-semibold">Systems We Use</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.systems_used.map((system) => (
                      <Badge key={system} variant="outline">{system}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.inspection_types.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Inspection Types We Assign</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.inspection_types.map((type) => (
                      <Badge key={type} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seeking Coverage Areas - recruiting view: show FIRST and emphasized */}
            {!isClientView && profile.seeking_coverage_areas && profile.seeking_coverage_areas.length > 0 && (
              <>
                <Separator />
                <Card className="border-primary/40 bg-primary/5">
                  <CardContent className="pt-5 pb-4 space-y-3">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Currently seeking field reps in…
                    </h3>
                    <div className="space-y-1.5">
                      {profile.seeking_coverage_areas.map((area) => (
                        <p key={area.state_code} className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{area.state_code}</span>
                          {" — "}
                          {area.counties.join(", ")}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <Separator />

            {/* Coverage - show always for client, only if showCoverage for recruiting */}
            {(isClientView || showCoverage) && (() => {
              const details = normalizeCoverageDetails(profile.coverage_details || []);
              const fullCoverage = details.filter(d => d.coverageMode === 'entire_state');
              const partialCoverage = details.filter(d => d.coverageMode !== 'entire_state');
              
              if (details.length === 0) {
                return (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Coverage & Focus Areas</h3>
                    <p className="text-muted-foreground">Coverage areas not specified</p>
                  </div>
                );
              }
              
              return (
                <div className="space-y-4">
                  <h3 className="font-semibold">Coverage & Focus Areas</h3>
                  
                  {/* All Counties Covered - Condensed paragraph */}
                  {fullCoverage.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">All Counties Covered</span>
                        <Badge variant="secondary" className="text-xs">
                          {fullCoverage.length} {fullCoverage.length === 1 ? "state" : "states"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {fullCoverage.map(s => `${s.stateCode} — ${s.stateName}`).join(", ")}
                      </p>
                    </div>
                  )}
                  
                  {/* Partial Coverage - mode-aware labels */}
                  {partialCoverage.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Partial Coverage</span>
                        <Badge variant="outline" className="text-xs">
                          {partialCoverage.length} {partialCoverage.length === 1 ? "state" : "states"}
                        </Badge>
                      </div>

                      {!showCountyDetails ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {partialCoverage.map(s => `${s.stateCode} — ${s.stateName}`).join(", ")}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {partialCoverage.map((state) => {
                            const modeLabel = state.coverageMode === 'entire_state_except'
                              ? 'Entire state covered except:'
                              : 'Covered counties (only):';

                            if (state.counties.length === 0) {
                              return (
                                <div key={state.stateCode} className="text-sm text-muted-foreground py-1">
                                  <span className="font-medium text-foreground">{state.stateCode} — {state.stateName}</span>
                                </div>
                              );
                            }

                            return (
                              <Collapsible key={state.stateCode}>
                                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors group">
                                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                  <span className="text-sm font-medium text-foreground">{state.stateCode} — {state.stateName}</span>
                                  <Badge variant="outline" className="text-xs ml-auto">
                                    {state.counties.length} counties
                                  </Badge>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pl-6 pt-1 pb-2 space-y-1">
                                  <span className="text-xs font-semibold text-foreground">{modeLabel}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {state.counties.map((county) => (
                                      <Badge key={county} variant="secondary" className="text-xs font-normal">
                                        {county}
                                      </Badge>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {(isClientView || showCoverage) && <Separator />}

            {/* Availability - hidden in client view */}
            {!isClientView && (
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${profile.is_accepting_new_reps ? 'text-green-500' : 'text-muted-foreground'}`} />
                <span>
                  {profile.is_accepting_new_reps ? 'Accepting new field reps' : 'Not currently accepting new field reps'}
                </span>
              </div>
            )}

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
                              <div>Helpfulness: {review.dimension_scores.on_time}/5</div>
                            )}
                            {review.dimension_scores.quality && (
                              <div>Communication: {review.dimension_scores.quality}/5</div>
                            )}
                            {review.dimension_scores.communication && (
                              <div>Pay: {review.dimension_scores.communication}/5</div>
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