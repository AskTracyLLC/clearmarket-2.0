import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getReviewSettings } from "@/lib/reviewSettings";

export function AdminReviewSummaryCard() {
  const navigate = useNavigate();
  const [minDays, setMinDays] = useState<number | null>(null);
  const [recentReviewCount, setRecentReviewCount] = useState<number>(0);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Get settings
    const settings = await getReviewSettings();
    setMinDays(settings.min_days_between_reviews);
    setIsDefault(!settings.id);

    // Get reviews in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString());
    
    setRecentReviewCount(count || 0);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4" />
          Reviews & Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Review cadence: <span className="text-foreground font-medium">every {minDays ?? 30} days</span> per connection
          {isDefault && (
            <span className="block text-xs text-muted-foreground italic mt-1">
              Using default value (30 days)
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Reviews in the last 30 days: <span className="text-foreground font-medium">{recentReviewCount}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate("/admin/review-settings")}
        >
          <Settings className="h-4 w-4 mr-2" />
          Manage review settings
        </Button>
      </CardContent>
    </Card>
  );
}
