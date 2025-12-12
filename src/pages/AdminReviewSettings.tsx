import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { getReviewSettings, updateReviewSettings } from "@/lib/reviewSettings";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

export default function AdminReviewSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions, loading: permLoading } = useStaffPermissions();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minDays, setMinDays] = useState(30);
  const [enforceWaitingPeriod, setEnforceWaitingPeriod] = useState(true);
  const [originalMinDays, setOriginalMinDays] = useState(30);
  const [originalEnforceWaitingPeriod, setOriginalEnforceWaitingPeriod] = useState(true);

  useEffect(() => {
    if (!permLoading && !permissions.canViewAdminDashboard) {
      toast({
        title: "Access denied",
        description: "You don't have permission to view this page.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    loadSettings();
  }, [permLoading, permissions]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settings = await getReviewSettings();
      setMinDays(settings.min_days_between_reviews);
      setEnforceWaitingPeriod(settings.enforce_waiting_period);
      setOriginalMinDays(settings.min_days_between_reviews);
      setOriginalEnforceWaitingPeriod(settings.enforce_waiting_period);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate
    if (minDays < 7 || minDays > 60) {
      toast({
        title: "Invalid value",
        description: "Minimum days must be between 7 and 60.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const result = await updateReviewSettings(minDays, enforceWaitingPeriod);
      if (result.success) {
        setOriginalMinDays(minDays);
        setOriginalEnforceWaitingPeriod(enforceWaitingPeriod);
        toast({
          title: "Settings updated",
          description: enforceWaitingPeriod 
            ? `Review settings updated. Waiting period: ${minDays} days.`
            : "Review settings updated. Waiting period is disabled.",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update settings",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = minDays !== originalMinDays || enforceWaitingPeriod !== originalEnforceWaitingPeriod;

  if (permLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container max-w-2xl py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Review Settings</h1>
            <p className="text-muted-foreground">
              Configure global review and feedback settings
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reviews & Feedback Settings</CardTitle>
            <CardDescription>
              These settings control how often users can post reviews and mark reviews as feedback.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Toggle for enabling/disabling waiting period */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="enforceWaitingPeriod" className="text-base font-medium">
                  Enforce waiting period
                </Label>
                <p className="text-sm text-muted-foreground">
                  {enforceWaitingPeriod 
                    ? "Users must wait between reviews for the same connection."
                    : "Waiting period is disabled. Users can post reviews anytime (testing mode)."}
                </p>
              </div>
              <Switch
                id="enforceWaitingPeriod"
                checked={enforceWaitingPeriod}
                onCheckedChange={setEnforceWaitingPeriod}
              />
            </div>

            {/* Days input - only meaningful when waiting period is enforced */}
            <div className={`space-y-2 ${!enforceWaitingPeriod ? "opacity-50" : ""}`}>
              <Label htmlFor="minDays">Minimum days between reviews per connection</Label>
              <Input
                id="minDays"
                type="number"
                min={7}
                max={60}
                value={minDays}
                onChange={(e) => setMinDays(parseInt(e.target.value) || 30)}
                className="max-w-[200px]"
                disabled={!enforceWaitingPeriod}
              />
              <p className="text-sm text-muted-foreground">
                This controls how often a vendor or field rep can post a new review for the same connection. 
                Example: 30 means one review every 30 days. The same interval applies to the "mark as feedback" feature.
              </p>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save changes
                  </>
                )}
              </Button>
              {hasChanges && (
                <p className="text-sm text-muted-foreground">
                  You have unsaved changes
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}