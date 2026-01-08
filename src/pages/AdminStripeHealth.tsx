import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, CreditCard, Webhook, Key, Building2 } from "lucide-react";
import { format } from "date-fns";

interface StripeHealthData {
  mode: "live" | "test" | "unknown";
  modeInferred: boolean;
  usedKeyPrefix: "sk_live" | "sk_test" | null;
  accountId: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  lastEvent: {
    type: string;
    created: number;
    livemode: boolean;
  } | null;
  lastWebhook: {
    eventType: string;
    eventId: string;
    livemode: boolean;
    receivedAt: string;
  } | null;
  keysConfigured: {
    live: boolean;
    test: boolean;
  };
  error?: string;
}

const AdminStripeHealth: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [healthData, setHealthData] = useState<StripeHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-health");
      
      if (error) {
        throw error;
      }

      setHealthData(data);
    } catch (err) {
      console.error("Failed to fetch Stripe health:", err);
      toast({
        title: "Error",
        description: "Failed to fetch Stripe health status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchHealth();
    }
  }, [authLoading, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealth();
  };

  // Auth/permission guards
  if (authLoading || permLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/sign-in");
    return null;
  }

  if (!permissions.canManageCredits) {
    navigate("/dashboard");
    return null;
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "live":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "test":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "live":
        return "LIVE";
      case "test":
        return "TEST";
      default:
        return "UNKNOWN";
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Stripe Health Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify production Stripe configuration
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading Stripe status...</span>
            </div>
          </CardContent>
        </Card>
      ) : healthData?.error && !healthData.mode ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Configuration Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{healthData.error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please ensure STRIPE_SECRET_KEY (live) or STRIPE_SECRET_TESTKEY (test) is configured in your environment.
            </p>
          </CardContent>
        </Card>
      ) : healthData ? (
        <div className="space-y-6">
          {/* Mode Badge - Large prominent display */}
          <Card>
            <CardContent className="py-6">
              <div className="flex flex-col items-center gap-3">
                <Badge 
                  variant="outline"
                  className={`text-2xl px-6 py-3 font-bold ${getModeColor(healthData.mode)}`}
                >
                  {getModeLabel(healthData.mode)} MODE
                </Badge>
                {healthData.usedKeyPrefix && (
                  <div className="text-sm text-muted-foreground">
                    Using key: <code className="bg-muted px-2 py-0.5 rounded">{healthData.usedKeyPrefix}_...</code>
                  </div>
                )}
              </div>
              {healthData.modeInferred && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-400" />
                  <span className="text-blue-400 text-sm">
                    Mode inferred from server key (no Stripe events found yet).
                  </span>
                </div>
              )}
              {healthData.usedKeyPrefix === "sk_test" && healthData.mode === "live" && !healthData.modeInferred && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <span className="text-yellow-400 text-sm">
                    Warning: Using test key but events show live mode. Check configuration.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Account Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account ID</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {healthData.accountId || "N/A"}
                  </code>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Charges Enabled</span>
                  {healthData.chargesEnabled === true ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : healthData.chargesEnabled === false ? (
                    <XCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Payouts Enabled</span>
                  {healthData.payoutsEnabled === true ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : healthData.payoutsEnabled === false ? (
                    <XCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* API Keys Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  API Keys
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Live Key</span>
                  {healthData.keysConfigured.live ? (
                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                      Missing
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Test Key</span>
                  {healthData.keysConfigured.test ? (
                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      Missing
                    </Badge>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Key</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {healthData.usedKeyPrefix || "N/A"}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Last Stripe Event */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  Last Stripe Event
                </CardTitle>
                <CardDescription>From Stripe API</CardDescription>
              </CardHeader>
              <CardContent>
                {healthData.lastEvent ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {healthData.lastEvent.type}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span className="text-sm">
                        {format(new Date(healthData.lastEvent.created * 1000), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Mode</span>
                      <Badge variant="outline" className={getModeColor(healthData.lastEvent.livemode ? "live" : "test")}>
                        {healthData.lastEvent.livemode ? "LIVE" : "TEST"}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No events found in Stripe</p>
                )}
              </CardContent>
            </Card>

            {/* Last Webhook Received */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-muted-foreground" />
                  Last Webhook Received
                </CardTitle>
                <CardDescription>From webhook endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                {healthData.lastWebhook ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {healthData.lastWebhook.eventType}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Received</span>
                      <span className="text-sm">
                        {format(new Date(healthData.lastWebhook.receivedAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Mode</span>
                      <Badge variant="outline" className={getModeColor(healthData.lastWebhook.livemode ? "live" : "test")}>
                        {healthData.lastWebhook.livemode ? "LIVE" : "TEST"}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No webhooks received yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminStripeHealth;
