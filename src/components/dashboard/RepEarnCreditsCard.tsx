/**
 * RepEarnCreditsCard
 * 
 * Displays rep milestone (2 credits) and full onboarding (5 total) reward progress on the dashboard.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import { useRepRewardSummary } from "@/hooks/useRepRewardSummary";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface RepEarnCreditsCardProps {
  className?: string;
}

export function RepEarnCreditsCard({ className }: RepEarnCreditsCardProps) {
  const navigate = useNavigate();
  const { summary, loading, claiming } = useRepRewardSummary();

  // Don't render if loading or no summary
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  // Don't show if all rewards earned
  if (summary.total_earned >= summary.total_possible) {
    return null;
  }

  const getMissingLabel = (key: string): string => {
    const labels: Record<string, string> = {
      profile: "Create your rep profile",
      location: "Add your city & state",
      inspection_types: "Select your inspection types",
      coverage_pricing: "Set coverage pricing",
      route_alert_sent: "Send a route/availability alert",
    };
    return labels[key] || key;
  };

  const getActionPath = (key: string): string => {
    const paths: Record<string, string> = {
      profile: "/rep/profile",
      location: "/rep/profile",
      inspection_types: "/rep/profile",
      coverage_pricing: "/work-setup",
      route_alert_sent: "/rep/availability",
    };
    return paths[key] || "/rep/profile";
  };

  // Find first missing item for milestone
  const firstMilestoneMissing = summary.milestone_missing[0];
  // Find first missing item for onboarding (that's not in milestone)
  const firstOnboardingMissing = summary.onboarding_missing.find(
    (m) => !summary.milestone_missing.includes(m)
  );

  return (
    <Card className={`bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-primary/20 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Earn Credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Milestone Row (2 credits) */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50">
          <div className="mt-0.5">
            {summary.milestone_earned ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : summary.milestone_complete ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-pulse" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">
                Complete profile & pricing
              </span>
              <Badge variant={summary.milestone_earned ? "default" : "secondary"} className="text-xs">
                <Coins className="h-3 w-3 mr-1" />
                {summary.milestone_earned ? "2 earned" : "+2 credits"}
              </Badge>
            </div>
            {!summary.milestone_earned && (
              <div className="space-y-1">
                {summary.milestone_missing.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Next: {getMissingLabel(firstMilestoneMissing)}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-600">
                    {claiming ? "Awarding credits..." : "Ready to claim!"}
                  </p>
                )}
                {firstMilestoneMissing && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={() => navigate(getActionPath(firstMilestoneMissing))}
                  >
                    Go to {firstMilestoneMissing === "coverage_pricing" ? "coverage" : "profile"}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full Onboarding Row (remaining credits to 5) */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50">
          <div className="mt-0.5">
            {summary.onboarding_earned ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : summary.onboarding_complete ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-pulse" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">
                Finish required onboarding
              </span>
              <Badge variant={summary.onboarding_earned ? "default" : "secondary"} className="text-xs">
                <Coins className="h-3 w-3 mr-1" />
                {summary.onboarding_earned 
                  ? `${summary.total_earned} total` 
                  : "+3 more"}
              </Badge>
            </div>
            {summary.remaining > 0 && (
              <div className="space-y-1">
                {firstOnboardingMissing ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Next: {getMissingLabel(firstOnboardingMissing)}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-primary"
                      onClick={() => navigate(getActionPath(firstOnboardingMissing))}
                    >
                      Go to {firstOnboardingMissing === "route_alert_sent" ? "availability" : "profile"}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </>
                ) : summary.milestone_missing.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Complete milestone first
                  </p>
                ) : (
                  <p className="text-xs text-emerald-600">
                    {claiming ? "Awarding credits..." : "Ready to claim!"}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary footer */}
        <div className="text-xs text-center text-muted-foreground pt-1">
          {summary.total_earned > 0 && (
            <span className="text-emerald-600 font-medium">{summary.total_earned} earned</span>
          )}
          {summary.total_earned > 0 && summary.remaining > 0 && " · "}
          {summary.remaining > 0 && (
            <span>{summary.remaining} more available</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
