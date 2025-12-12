import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { NEAR_MISS_THRESHOLD, doesPostMatchRepRate } from "@/lib/rateMatching";

export function MatchAssistantCard() {
  const { user } = useAuth();
  const { isEnabled, isPaid, loading: flagsLoading } = useFeatureFlags();
  const [nearMissCount, setNearMissCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const featureAvailable = isEnabled("match_assistant");
  const featureIsPaid = isPaid("match_assistant");

  useEffect(() => {
    if (user && featureAvailable && !flagsLoading) {
      loadNearMissCount();
    } else {
      setLoading(false);
    }
  }, [user, featureAvailable, flagsLoading]);

  const loadNearMissCount = async () => {
    if (!user) return;

    try {
      // Get rep's coverage areas with base prices
      const { data: repCoverage } = await supabase
        .from("rep_coverage_areas")
        .select("state_code, county_id, base_price, covers_entire_state")
        .eq("user_id", user.id);

      if (!repCoverage || repCoverage.length === 0) {
        setNearMissCount(0);
        setLoading(false);
        return;
      }

      // Get active posts from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: posts } = await supabase
        .from("seeking_coverage_posts")
        .select("id, state_code, county_id, covers_entire_state, pay_min, pay_max")
        .eq("status", "active")
        .is("deleted_at", null)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (!posts || posts.length === 0) {
        setNearMissCount(0);
        setLoading(false);
        return;
      }

      // Count near-misses
      let count = 0;

      for (const post of posts) {
        const matchingCoverage = repCoverage.find(coverage => {
          // State must match
          if (post.state_code !== coverage.state_code) return false;
          
          // If post covers entire state, any coverage in that state matches
          if (post.covers_entire_state) return true;
          
          // If rep covers entire state, they match any post in that state
          if (coverage.covers_entire_state) return true;
          
          // County-level matching
          if (post.county_id && coverage.county_id) {
            return post.county_id === coverage.county_id;
          }
          
          // If post has no county specified, any coverage in the state matches
          if (!post.county_id) return true;
          
          // Skip rows with missing county data that aren't entire_state
          if (!coverage.county_id && !coverage.covers_entire_state) {
            return false;
          }
          
          return false;
        });

        if (!matchingCoverage) continue;
        
        const repBaseRate = matchingCoverage.base_price;
        if (!repBaseRate || repBaseRate <= 0) continue;

        const payMin = post.pay_min ?? 0;
        const payMax = post.pay_max ?? Number.POSITIVE_INFINITY;

        // Skip perfect matches
        if (doesPostMatchRepRate(repBaseRate, payMin, payMax)) continue;

        // Check if it's a near-miss
        if (payMax !== Number.POSITIVE_INFINITY && payMax < repBaseRate) {
          const gapPercent = ((repBaseRate - payMax) / repBaseRate) * 100;
          if (gapPercent <= NEAR_MISS_THRESHOLD * 100) {
            count++;
          }
        }
      }

      setNearMissCount(count);
    } catch (error) {
      console.error("Error loading near-miss count:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if feature is disabled
  if (flagsLoading || !featureAvailable) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Match Assistant</CardTitle>
          </div>
          {featureIsPaid && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              Beta – Free during testing
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm">
          Match Assistant can show you work that's slightly below your current rates in your coverage areas.
          {featureIsPaid && (
            <span className="block mt-1 text-xs text-muted-foreground/80">
              Free for testers right now – this will become a paid feature after launch.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center justify-between">
          <div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Checking...</p>
            ) : nearMissCount > 0 ? (
              <p className="text-sm">
                <span className="font-medium text-primary">{nearMissCount}</span>
                <span className="text-muted-foreground"> near-miss opportunit{nearMissCount === 1 ? 'y' : 'ies'}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No near-miss opportunities right now</p>
            )}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/rep/match-assistant">
              View potential matches
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
