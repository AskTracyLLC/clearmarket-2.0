import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

interface DimensionStats {
  lifetime: number;
  recent: number;
}

interface RepReputationSnapshotNewProps {
  trustScore: number;
  reviewCount: number;
  recentReviewCount: number;
  onTime: DimensionStats;
  quality: DimensionStats;
  communication: DimensionStats;
}

export function RepReputationSnapshotNew({
  trustScore,
  reviewCount,
  recentReviewCount,
  onTime,
  quality,
  communication,
}: RepReputationSnapshotNewProps) {
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

  const onTimeTrend = getTrendIcon(onTime.recent, onTime.lifetime);
  const qualityTrend = getTrendIcon(quality.recent, quality.lifetime);
  const communicationTrend = getTrendIcon(communication.recent, communication.lifetime);

  // Gentle nudge logic
  const dimensions = [
    { name: "On-Time", score: onTime.lifetime },
    { name: "Quality", score: quality.lifetime },
    { name: "Communication", score: communication.lifetime },
  ];
  const maxScore = Math.max(...dimensions.map(d => d.score));
  const weakDimension = dimensions.find(d => maxScore - d.score > 0.5);

  const getNudgeMessage = (dimension: string) => {
    if (dimension === "On-Time") {
      return "Recent reviews suggest some due dates have been tight. Keeping your availability in Find Work up-to-date can help.";
    }
    if (dimension === "Communication") {
      return "Some vendors mentioned delayed responses. Quick check-ins can boost your Communication rating.";
    }
    if (dimension === "Quality") {
      return "A few vendors noted quality expectations. Double-checking inspection standards can strengthen this dimension.";
    }
    return "";
  };

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
            You're off to a fresh start. As vendors review your work, your Reputation Snapshot will appear here.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
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
                <p className="text-sm font-medium text-foreground">On-Time Performance</p>
                <p className="text-xs text-muted-foreground">Meeting deadlines</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{onTime.lifetime.toFixed(1)} / 5</span>
                <onTimeTrend.Icon className={`h-4 w-4 ${onTimeTrend.color}`} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Quality of Inspection</p>
                <p className="text-xs text-muted-foreground">Thoroughness & standards</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{quality.lifetime.toFixed(1)} / 5</span>
                <qualityTrend.Icon className={`h-4 w-4 ${qualityTrend.color}`} />
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
          </div>
        </div>

        {/* Gentle nudge if a dimension is notably weaker */}
        {weakDimension && (
          <Alert className="border-orange-500/30 bg-orange-500/5">
            <Info className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-sm text-foreground">
              {getNudgeMessage(weakDimension.name)}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
