import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, Calendar, Shield, Key, Wrench, CheckCircle, ExternalLink } from "lucide-react";
import { fetchPublicSnapshot } from "@/lib/reputationSharing";
import { formatDistanceToNow } from "date-fns";

export default function PublicReputationSnapshot() {
  const { slug } = useParams<{ slug: string }>();
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Invalid snapshot URL");
      setLoading(false);
      return;
    }

    loadSnapshot();
  }, [slug]);

  async function loadSnapshot() {
    try {
      const data = await fetchPublicSnapshot(slug!);
      setSnapshot(data);
    } catch (err: any) {
      console.error('Error loading snapshot:', err);
      setError(err.error || "Snapshot not found or disabled");
    } finally {
      setLoading(false);
    }
  }

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

  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardContent className="p-12 text-center space-y-4">
            <div className="text-6xl">🔒</div>
            <h1 className="text-2xl font-bold">Snapshot Not Available</h1>
            <p className="text-muted-foreground">
              {error || "This snapshot is no longer available or has been disabled."}
            </p>
            <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline">
              Visit ClearMarket <ExternalLink className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { role_type, snapshot: data } = snapshot;
  const isRep = role_type === 'rep';

  const getTrustScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-500';
    if (score >= 4.0) return 'text-blue-500';
    if (score >= 3.0) return 'text-yellow-500';
    if (score > 0) return 'text-muted-foreground';
    return 'text-muted-foreground';
  };

  const renderStars = (rating: number) => {
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

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-block">
            <h2 className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              ClearMarket Reputation Snapshot
            </h2>
          </Link>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-3xl">{data.display_name}</CardTitle>
                <Badge variant="secondary">{isRep ? 'Field Representative' : 'Vendor Company'}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {data.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {data.location}
                </div>
              )}
              {data.last_active && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Active {formatDistanceToNow(new Date(data.last_active), { addSuffix: true })}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Trust Score */}
            <div className="space-y-3">
              <h3 className="font-semibold">Trust Score</h3>
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold ${getTrustScoreColor(data.trust_score)}`}>
                  {data.trust_score > 0 ? data.trust_score.toFixed(1) : '—'}
                </div>
                <div className="space-y-1">
                  <div className="font-medium">
                    {data.trust_score > 0 ? `${data.trust_score.toFixed(1)} / 5` : 'No Rating Yet'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Based on {data.review_count} accepted review{data.review_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dimension Breakdown */}
            <div className="space-y-4">
              <h3 className="font-semibold">Performance Ratings</h3>
              <div className="grid gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    {isRep ? 'On-Time Performance' : 'Helpfulness & Support'}
                  </div>
                  {renderStars(data.dimensions.on_time)}
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    {isRep ? 'Quality of Inspections' : 'Communication'}
                  </div>
                  {renderStars(data.dimensions.quality)}
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    {isRep ? 'Communication' : 'Pay Reliability'}
                  </div>
                  {renderStars(data.dimensions.communication)}
                </div>
              </div>
            </div>

            <Separator />

            {/* Rep-specific info */}
            {isRep && (
              <>
                {/* Background Check & Capabilities */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Background Check & Capabilities</h3>
                  <div className="space-y-3">
                    {data.background_check.has_active && (
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-green-500" />
                        <span>Background Check: Active {data.background_check.provider ? `(${data.background_check.provider})` : ''}</span>
                      </div>
                    )}
                    {!data.background_check.has_active && data.background_check.is_willing_to_obtain && (
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <span>Background Check: Willing to Obtain</span>
                      </div>
                    )}
                    {data.hud_keys && (
                      <div className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        <span>HUD Keys: {data.hud_keys}</span>
                      </div>
                    )}
                    {data.equipment_summary && (
                      <div className="flex items-start gap-2">
                        <Wrench className="h-5 w-5 mt-0.5" />
                        <span>{data.equipment_summary}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* Vendor-specific info */}
            {!isRep && (
              <>
                {data.company_description && (
                  <>
                    <div className="space-y-2">
                      <h3 className="font-semibold">About</h3>
                      <p className="text-muted-foreground">{data.company_description}</p>
                    </div>
                    <Separator />
                  </>
                )}
              </>
            )}

            {/* Coverage */}
            <div className="space-y-3">
              <h3 className="font-semibold">Coverage</h3>
              <p className="text-muted-foreground">{data.coverage_summary}</p>
            </div>

            {/* Systems & Types */}
            {(data.systems_used?.length > 0 || data.inspection_types?.length > 0) && (
              <>
                <Separator />
                <div className="grid sm:grid-cols-2 gap-4">
                  {data.systems_used?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Systems Used</h4>
                      <div className="flex flex-wrap gap-2">
                        {data.systems_used.map((system: string) => (
                          <Badge key={system} variant="outline">{system}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.inspection_types?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Inspection Types</h4>
                      <div className="flex flex-wrap gap-2">
                        {data.inspection_types.map((type: string) => (
                          <Badge key={type} variant="outline">{type}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Availability */}
            {(data.accepting_new_vendors !== undefined || data.accepting_new_reps !== undefined) && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>
                    {isRep 
                      ? (data.accepting_new_vendors ? 'Accepting new vendors' : 'Not currently accepting new vendors')
                      : (data.accepting_new_reps ? 'Accepting new reps' : 'Not currently accepting new reps')
                    }
                  </span>
                </div>
              </>
            )}

            {/* Spotlighted Reviews */}
            {isRep && data.spotlighted_reviews?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                    Spotlighted Reviews
                  </h3>
                  <div className="space-y-4">
                    {data.spotlighted_reviews.map((review: any, idx: number) => (
                      <Card key={idx} className="border-primary/20 bg-primary/5">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="text-sm font-medium">From: {review.vendor_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span>Area: {review.area}</span>
                            <span>Work Type: {review.work_type}</span>
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

            {/* No spotlighted reviews message */}
            {isRep && (!data.spotlighted_reviews || data.spotlighted_reviews.length === 0) && data.review_count > 0 && (
              <>
                <Separator />
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No spotlighted reviews yet.</p>
                </div>
              </>
            )}

            {/* Recent Reviews */}
            {data.recent_reviews?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold">Recent Feedback</h3>
                  <div className="space-y-4">
                    {data.recent_reviews.map((review: any, idx: number) => (
                      <Card key={idx} className="border-muted">
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex gap-3 text-sm text-muted-foreground">
                              <span>Area: {review.area}</span>
                              <span>Work Type: {review.work_type}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                            </div>
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

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>This snapshot is generated by ClearMarket based on reviews and activity.</p>
          <p>Contact info is not shown here for privacy.</p>
          <Link to="/" className="inline-flex items-center gap-1 text-primary hover:underline">
            Learn more about ClearMarket <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}