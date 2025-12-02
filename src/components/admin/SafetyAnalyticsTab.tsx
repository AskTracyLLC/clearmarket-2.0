import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, AlertTriangle, ShieldCheck, Eye } from "lucide-react";
import { SafetyAnalyticsData } from "@/lib/qualityAnalytics";

interface SafetyAnalyticsTabProps {
  data: SafetyAnalyticsData;
  onViewProfile: (userId: string) => void;
}

export function SafetyAnalyticsTab({ data, onViewProfile }: SafetyAnalyticsTabProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">False Positive Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{data.falsePositiveRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Reports dismissed as not valid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upheld Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{data.upheldRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Reports confirmed and resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports by Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Reports by Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.reportsByType.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-foreground capitalize">{item.type}</span>
                <Badge variant="secondary">{item.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reports Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Report Volume (Last 90 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.reportsOverTime.length > 0 ? (
            <div className="flex items-end gap-1 h-32">
              {data.reportsOverTime.slice(-30).map((point, idx) => (
                <div
                  key={idx}
                  className="flex-1 bg-primary/20 rounded-t hover:bg-primary/30 transition-colors"
                  style={{ height: `${Math.min((point.count / Math.max(...data.reportsOverTime.map(p => p.count))) * 100, 100)}%` }}
                  title={`${point.date}: ${point.count} reports`}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No report data in the last 90 days</p>
          )}
        </CardContent>
      </Card>

      {/* Top Reported Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Top 10 Most Reported Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topReportedAccounts.length > 0 ? (
            <div className="space-y-2">
              {data.topReportedAccounts.map((account, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                    <span className="text-sm font-medium text-foreground">{account.anonymousId}</span>
                    <Badge variant="destructive">{account.count} reports</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewProfile(account.userId)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No reported accounts</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
