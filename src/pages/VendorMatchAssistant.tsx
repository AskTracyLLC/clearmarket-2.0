import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, MapPin, ArrowLeft, Info, AlertTriangle, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { analyzeVendorPostsPricing, PostPricingIssue } from "@/lib/vendorRateAnalysis";

export default function VendorMatchAssistant() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { effectiveRole } = useActiveRole();
  const { getFlag, loading: flagsLoading, isEnabled, isPaid } = useFeatureFlags();
  
  const [issues, setIssues] = useState<PostPricingIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const vendorMAFlag = getFlag("vendor_match_assistant");
  const featureAvailable = isEnabled("vendor_match_assistant");
  const featureIsPaid = isPaid("vendor_match_assistant");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (!authLoading && !flagsLoading && effectiveRole !== "vendor") {
      navigate("/dashboard");
      return;
    }
    if (!authLoading && !flagsLoading && !featureAvailable) {
      navigate("/dashboard");
      return;
    }
    if (user && featureAvailable) {
      loadPricingIssues();
    }
  }, [user, authLoading, flagsLoading, effectiveRole, featureAvailable]);

  const loadPricingIssues = async () => {
    if (!user) return;

    try {
      const results = await analyzeVendorPostsPricing(user.id);
      setIssues(results);
    } catch (error) {
      console.error("Error loading pricing issues:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || flagsLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Vendor Match Assistant</h1>
            {featureIsPaid && featureAvailable && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                Beta – Free during testing
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Identify Seeking Coverage posts where your offered rate may be below rep expectations.
          </p>
        </div>

        {/* Beta Info Banner */}
        {featureIsPaid && (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Match Assistant (Beta)</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              We analyze your posts against rep base rates in each area. When your offered rate is below what reps typically charge, we'll let you know.
              This feature is free during testing and will be part of a paid plan after launch.
            </AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {issues.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No pricing issues detected</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                All your active Seeking Coverage posts appear to be priced competitively for the areas you're targeting.
                We'll let you know if that changes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {issues.length} post{issues.length === 1 ? '' : 's'} where your offered rate may be too low for the area.
            </p>
            
            {issues.map((issue) => (
              <Card key={issue.postId} className="hover:border-amber-500/50 transition-colors border-amber-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-medium">{issue.postTitle}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <MapPin className="w-3 h-3" />
                        {issue.countyName ? `${issue.countyName}, ${issue.stateCode}` : issue.stateCode}
                        {issue.coversEntireState && <span className="text-xs">(Statewide)</span>}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Pricing Alert
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Rate comparison */}
                  <div className="bg-muted/50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Your offered rate</p>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {issue.payMax ? `Up to $${issue.payMax.toFixed(2)}` : 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Rep rates in this area</p>
                        <p className="font-medium text-foreground">
                          {issue.analysis.minRepRate && issue.analysis.maxRepRate ? (
                            issue.analysis.minRepRate === issue.analysis.maxRepRate
                              ? `$${issue.analysis.minRepRate.toFixed(2)}`
                              : `$${issue.analysis.minRepRate.toFixed(2)} – $${issue.analysis.maxRepRate.toFixed(2)}`
                          ) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-sm mb-4">
                    <p className="text-muted-foreground">
                      <span className="text-foreground font-medium">{issue.analysis.totalReps}</span> rep{issue.analysis.totalReps === 1 ? '' : 's'} in this area
                    </p>
                    <p className="text-muted-foreground">
                      <span className="text-foreground font-medium">{issue.analysis.rateMatches}</span> rep{issue.analysis.rateMatches === 1 ? '' : 's'} whose rates match your offer
                    </p>
                    <p className="text-amber-500">
                      <span className="font-medium">{issue.analysis.rateTooHigh}</span> rep{issue.analysis.rateTooHigh === 1 ? '' : 's'} priced above your max
                    </p>
                  </div>

                  {/* Suggestion */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-foreground">
                      Your max rate of <span className="font-medium">${issue.payMax?.toFixed(2) || '?'}</span> is likely too low for this area.
                      {issue.analysis.medianRepRate && (
                        <> Reps here typically charge around <span className="font-medium">${issue.analysis.medianRepRate.toFixed(2)}</span>.</>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Consider raising your offer or negotiating higher pay from your client.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Posted {format(parseISO(issue.createdAt), "MMM d, yyyy")}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/vendor/seeking-coverage?highlightPostId=${issue.postId}`}>
                          View Post
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
