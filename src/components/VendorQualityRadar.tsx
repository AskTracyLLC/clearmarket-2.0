import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, AlertTriangle, Star } from "lucide-react";
import { QualityRadarData } from "@/lib/qualityAnalytics";

interface VendorQualityRadarProps {
  data: QualityRadarData;
}

export function VendorQualityRadar({ data }: VendorQualityRadarProps) {
  const hasAlerts = data.recentReportCount >= 3 || data.communicationComplaints >= 2;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Quality Radar
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Private coaching insights from your reviews and feedback
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Strengths */}
        {data.strengths.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Top Strengths
            </h3>
            <div className="space-y-2">
              {data.strengths.map((strength, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{strength.dimension}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                      <Star className="h-3 w-3 fill-current mr-1" />
                      {strength.score.toFixed(1)} / 5
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak Signals */}
        {data.weakSignals.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              Areas to Watch
            </h3>
            <div className="space-y-2">
              {data.weakSignals.map((signal, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{signal.dimension}</span>
                  <Badge variant="outline" className="border-orange-500 text-orange-600">
                    {signal.score.toFixed(1)} / 5
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {hasAlerts && (
          <Alert className="border-orange-500/50 bg-orange-500/10">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-sm">
              {data.recentReportCount >= 3 && (
                <p className="mb-2">
                  You've had {data.recentReportCount} reports in the last 90 days. 
                  Most are resolved, but staying responsive can help prevent future issues.
                </p>
              )}
              {data.communicationComplaints >= 2 && (
                <p>
                  Multiple reps mentioned communication concerns. 
                  Quick replies and clear expectations can improve your ratings.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {data.strengths.length === 0 && data.weakSignals.length === 0 && !hasAlerts && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Not enough data yet. Your Quality Radar will update as you receive more reviews.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
