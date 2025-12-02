import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Users } from "lucide-react";
import { ReputationSnapshotData } from "@/lib/qualityAnalytics";

interface RepReputationSnapshotProps {
  data: ReputationSnapshotData;
  trustScore: number;
}

export function RepReputationSnapshot({ data, trustScore }: RepReputationSnapshotProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Reputation Snapshot
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Private insights about your performance trends
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Trust Score</p>
            <p className="text-2xl font-bold text-foreground">{trustScore.toFixed(1)} / 5</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Active Connections</p>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-2xl font-bold text-foreground">{data.activeConnectionCount}</p>
            </div>
          </div>
        </div>

        {/* Recent Themes */}
        {data.recentThemes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Recent Feedback Themes</h3>
            <div className="space-y-2">
              {data.recentThemes.map((theme, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {theme.positive ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-orange-500 mt-0.5" />
                  )}
                  <span className="text-sm text-foreground">{theme.theme}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Mini Chart */}
        {(data.onTimeHistory.length > 0 || data.qualityHistory.length > 0 || data.communicationHistory.length > 0) && (
          <div>
            <h3 className="text-sm font-medium mb-3">Performance Over Time (Last 6 Months)</h3>
            <div className="space-y-3">
              {data.onTimeHistory.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">On-Time</span>
                    <Badge variant="outline" className="text-xs">
                      {data.onTimeHistory[data.onTimeHistory.length - 1]?.score.toFixed(1) || "—"} / 5
                    </Badge>
                  </div>
                  <div className="flex items-end gap-1 h-8">
                    {data.onTimeHistory.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-primary/20 rounded-t"
                        style={{ height: `${(point.score / 5) * 100}%` }}
                        title={`${point.month}: ${point.score.toFixed(1)}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {data.qualityHistory.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Quality</span>
                    <Badge variant="outline" className="text-xs">
                      {data.qualityHistory[data.qualityHistory.length - 1]?.score.toFixed(1) || "—"} / 5
                    </Badge>
                  </div>
                  <div className="flex items-end gap-1 h-8">
                    {data.qualityHistory.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-secondary/30 rounded-t"
                        style={{ height: `${(point.score / 5) * 100}%` }}
                        title={`${point.month}: ${point.score.toFixed(1)}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {data.communicationHistory.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Communication</span>
                    <Badge variant="outline" className="text-xs">
                      {data.communicationHistory[data.communicationHistory.length - 1]?.score.toFixed(1) || "—"} / 5
                    </Badge>
                  </div>
                  <div className="flex items-end gap-1 h-8">
                    {data.communicationHistory.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-accent/30 rounded-t"
                        style={{ height: `${(point.score / 5) * 100}%` }}
                        title={`${point.month}: ${point.score.toFixed(1)}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {data.recentThemes.length === 0 && data.onTimeHistory.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Not enough data yet. Your Reputation Snapshot will update as you receive more reviews.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
