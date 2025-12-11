import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, MapPin, Briefcase, AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { doesPostMatchRepRate, NEAR_MISS_THRESHOLD } from "@/lib/rateMatching";

interface NearMissOpportunity {
  id: string;
  title: string;
  state_code: string;
  county_name: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_type: string | null;
  created_at: string;
  vendor_anonymous_id: string | null;
  rep_base_rate: number;
  gap_percent: number;
}

export default function RepMatchAssistant() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { effectiveRole } = useActiveRole();
  const { getFlag, loading: flagsLoading, isEnabled, isPaid } = useFeatureFlags();
  
  const [opportunities, setOpportunities] = useState<NearMissOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const matchAssistantFlag = getFlag("match_assistant");
  const featureAvailable = isEnabled("match_assistant");
  const featureIsPaid = isPaid("match_assistant");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (!authLoading && !flagsLoading && effectiveRole !== "rep") {
      navigate("/dashboard");
      return;
    }
    if (!authLoading && !flagsLoading && !featureAvailable) {
      navigate("/dashboard");
      return;
    }
    if (user && featureAvailable) {
      loadNearMissOpportunities();
    }
  }, [user, authLoading, flagsLoading, effectiveRole, featureAvailable]);

  const loadNearMissOpportunities = async () => {
    if (!user) return;

    try {
      // Get rep's coverage areas with base prices
      const { data: repCoverage } = await supabase
        .from("rep_coverage_areas")
        .select("state_code, county_id, county_name, base_price, covers_entire_state")
        .eq("user_id", user.id);

      if (!repCoverage || repCoverage.length === 0) {
        setOpportunities([]);
        setLoading(false);
        return;
      }

      // Get active posts from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: posts } = await supabase
        .from("seeking_coverage_posts")
        .select(`
          id,
          title,
          state_code,
          county_id,
          covers_entire_state,
          pay_min,
          pay_max,
          pay_type,
          created_at,
          vendor_id
        `)
        .eq("status", "active")
        .is("deleted_at", null)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (!posts || posts.length === 0) {
        setOpportunities([]);
        setLoading(false);
        return;
      }

      // Get vendor anonymous IDs
      const vendorIds = [...new Set(posts.map(p => p.vendor_id))];
      const { data: vendorProfiles } = await supabase
        .from("vendor_profile")
        .select("user_id, anonymous_id")
        .in("user_id", vendorIds);

      const vendorIdMap: Record<string, string> = {};
      (vendorProfiles || []).forEach(vp => {
        vendorIdMap[vp.user_id] = vp.anonymous_id || "Vendor#???";
      });

      // Get county names
      const countyIds = [...new Set(posts.filter(p => p.county_id).map(p => p.county_id))];
      const { data: counties } = countyIds.length > 0 
        ? await supabase.from("us_counties").select("id, county_name").in("id", countyIds)
        : { data: [] };
      
      const countyNameMap: Record<string, string> = {};
      (counties || []).forEach(c => {
        countyNameMap[c.id] = c.county_name;
      });

      // Find near-miss opportunities
      const nearMisses: NearMissOpportunity[] = [];

      for (const post of posts) {
        // Find matching coverage area for this post
        const matchingCoverage = repCoverage.find(coverage => {
          if (post.state_code !== coverage.state_code) return false;
          if (post.covers_entire_state) return true;
          if (coverage.covers_entire_state) return true;
          if (post.county_id && coverage.county_id) {
            return post.county_id === coverage.county_id;
          }
          if (!post.county_id) return true;
          return false;
        });

        if (!matchingCoverage) continue;
        
        const repBaseRate = matchingCoverage.base_price;
        if (!repBaseRate || repBaseRate <= 0) continue;

        const payMin = post.pay_min ?? 0;
        const payMax = post.pay_max ?? Number.POSITIVE_INFINITY;

        // Check if it's a perfect match (should be excluded)
        if (doesPostMatchRepRate(repBaseRate, payMin, payMax)) {
          continue;
        }

        // Check if it's a near-miss (within threshold)
        // Near-miss: vendor's max is below rep's rate but within threshold
        if (payMax !== Number.POSITIVE_INFINITY && payMax < repBaseRate) {
          const gapPercent = ((repBaseRate - payMax) / repBaseRate) * 100;
          
          if (gapPercent <= NEAR_MISS_THRESHOLD * 100) {
            nearMisses.push({
              id: post.id,
              title: post.title,
              state_code: post.state_code || "",
              county_name: post.county_id ? countyNameMap[post.county_id] : null,
              pay_min: post.pay_min,
              pay_max: post.pay_max,
              pay_type: post.pay_type,
              created_at: post.created_at,
              vendor_anonymous_id: vendorIdMap[post.vendor_id],
              rep_base_rate: repBaseRate,
              gap_percent: gapPercent,
            });
          }
        }
      }

      // Sort by gap percentage (closest to matching first)
      nearMisses.sort((a, b) => a.gap_percent - b.gap_percent);
      setOpportunities(nearMisses);
    } catch (error) {
      console.error("Error loading near-miss opportunities:", error);
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
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Match Assistant</h1>
            {featureIsPaid && featureAvailable && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                Beta – Free during testing
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Opportunities that are close to your base rate but don't quite meet it yet.
          </p>
        </div>

        {/* Beta Info Banner */}
        {featureIsPaid && (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Match Assistant (Beta)</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              You're seeing near-miss opportunities that don't currently meet your base rate but are close.
              This feature is free during testing and will be part of a paid plan after launch.
            </AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {opportunities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No near-miss opportunities right now</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                We'll show opportunities here when vendors post work that's close to your rates.
                Check back later or expand your coverage areas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {opportunities.length} near-miss opportunit{opportunities.length === 1 ? 'y' : 'ies'} within {NEAR_MISS_THRESHOLD * 100}% of your base rate.
            </p>
            
            {opportunities.map((opp) => (
              <Card key={opp.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-medium">{opp.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <MapPin className="w-3 h-3" />
                        {opp.county_name ? `${opp.county_name}, ${opp.state_code}` : opp.state_code}
                        <span className="text-muted-foreground/50">•</span>
                        <span>{opp.vendor_anonymous_id}</span>
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {opp.gap_percent.toFixed(0)}% below your rate
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <p className="text-muted-foreground">
                        Your base rate: <span className="text-foreground font-medium">${opp.rep_base_rate.toFixed(2)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Vendor offering: <span className="text-foreground font-medium">
                          {opp.pay_max ? `up to $${opp.pay_max.toFixed(2)}` : 'Rate not specified'}
                        </span>
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/rep/seeking-coverage/${opp.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Posted {format(parseISO(opp.created_at), "MMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
