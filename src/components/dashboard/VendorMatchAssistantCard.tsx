import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { analyzeVendorPostsPricing } from "@/lib/vendorRateAnalysis";

export function VendorMatchAssistantCard() {
  const { user } = useAuth();
  const { isEnabled, isPaid, loading: flagsLoading } = useFeatureFlags();
  const [issueCount, setIssueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const featureAvailable = isEnabled("vendor_match_assistant");
  const featureIsPaid = isPaid("vendor_match_assistant");

  useEffect(() => {
    if (user && featureAvailable && !flagsLoading) {
      loadPricingIssues();
    } else {
      setLoading(false);
    }
  }, [user, featureAvailable, flagsLoading]);

  const loadPricingIssues = async () => {
    if (!user) return;

    try {
      const issues = await analyzeVendorPostsPricing(user.id);
      setIssueCount(issues.length);
    } catch (error) {
      console.error("Error loading pricing issues:", error);
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
            <TrendingUp className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Vendor Match Assistant</CardTitle>
          </div>
          {featureIsPaid && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              Beta – Free during testing
            </Badge>
          )}
        </div>
        <CardDescription className="text-sm">
          We'll analyze your Seeking Coverage posts and show you when your pay is below what reps are charging in that area.
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
              <p className="text-sm text-muted-foreground">Analyzing...</p>
            ) : issueCount > 0 ? (
              <p className="text-sm">
                <span className="font-medium text-amber-500">{issueCount}</span>
                <span className="text-muted-foreground"> post{issueCount === 1 ? '' : 's'} with pricing issues</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No pricing issues detected on your current posts.</p>
            )}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/vendor/match-assistant">
              View pricing insights
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
