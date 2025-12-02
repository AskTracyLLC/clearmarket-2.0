import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DimensionStats {
  lifetime: number;
  recent: number;
}

interface VendorReputationSnapshotProps {
  trustScore: number;
  reviewCount: number;
  recentReviewCount: number;
  helpfulness: DimensionStats;
  communication: DimensionStats;
  payConsistency: DimensionStats;
}

export function VendorReputationSnapshot({
  trustScore,
  reviewCount,
  recentReviewCount,
  helpfulness,
  communication,
  payConsistency,
}: VendorReputationSnapshotProps) {
  const getTrustLabel = (score: number) => {
    if (score >= 4) return "Strong";
    if (score >= 3) return "Average";
    return "Needs attention";
  };

  const getTrendIcon = (recent: number, lifetime: number) => {
    const diff = recent - lifetime;
    if (diff > 0.2) return { Icon: TrendingUp, color: "text-green-500" };
    if (diff < -0.2) return { Icon: TrendingDown, color: "text-orange-500" };
    return { Icon: Minus, color: "text-muted-foreground" };
  };

  const helpfulnessTrend = getTrendIcon(helpfulness.recent, helpfulness.lifetime);
  const communicationTrend = getTrendIcon(communication.recent, communication.lifetime);
  const payTrend = getTrendIcon(payConsistency.recent, payConsistency.lifetime);

  if (reviewCount === 0) {
    return (
      <Card className="mb-6 border-primary/20">
        <CardHeader>
          <CardTitle>Reputation Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="mb-4">
            <Badge variant="secondary" className="text-2xl px-4 py-2">
              Trust Score: {trustScore.toFixed(1)} / 5
            </Badge>
          </div>
          <p className="text-muted-foreground">
            You're off to a fresh start. As reviews come in, your Reputation Snapshot will appear here.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Your baseline score is neutral. It will adjust as verified reviews are added.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader>
        <CardTitle>Reputation Snapshot</CardTitle>
        <p className="text-xs text-muted-foreground">
          Based on {reviewCount} review{reviewCount !== 1 ? "s" : ""} ({recentReviewCount} in the last 90 days). Private to you.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Trust Score */}
          <div className="flex flex-col justify-center items-center md:items-start border-r border-border pr-6">
            <p className="text-sm text-muted-foreground mb-2">Overall Trust Score</p>
            <Badge variant="secondary" className="text-3xl px-4 py-2 mb-2">
              {trustScore.toFixed(1)} / 5
            </Badge>
            <Badge variant="outline" className="text-sm">
              {getTrustLabel(trustScore)}
            </Badge>
          </div>

          {/* Right: Dimension breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Helpfulness</p>
                <p className="text-xs text-muted-foreground">Support & assistance</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{helpfulness.lifetime.toFixed(1)} / 5</span>
                <helpfulnessTrend.Icon className={`h-4 w-4 ${helpfulnessTrend.color}`} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Communication</p>
                <p className="text-xs text-muted-foreground">Responsiveness & clarity</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{communication.lifetime.toFixed(1)} / 5</span>
                <communicationTrend.Icon className={`h-4 w-4 ${communicationTrend.color}`} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Pay Consistency</p>
                <p className="text-xs text-muted-foreground">Reliability & timeliness</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{payConsistency.lifetime.toFixed(1)} / 5</span>
                <payTrend.Icon className={`h-4 w-4 ${payTrend.color}`} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
