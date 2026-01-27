import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useMimic } from "@/hooks/useMimic";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Briefcase, Building2, Users, Clock, CheckCircle2, XCircle, Shield, RefreshCw, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { DualRoleRequestModal } from "./DualRoleRequestModal";

// Feature is disabled until further notice
const DUAL_ROLE_REQUESTS_ENABLED = false;

interface DualRoleRequest {
  id: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  decision_note: string | null;
}

interface GLBadgeInfo {
  has_active_gl_badge: boolean;
  gl_expires_on: string | null;
}

export function DualRoleAccessCard() {
  const { user } = useAuth();
  const { isRep, isVendor, isDualRole, loading: roleLoading } = useActiveRole();
  const { mimickedUser } = useMimic();
  const isInMimicMode = !!mimickedUser;

  const [latestRequest, setLatestRequest] = useState<DualRoleRequest | null>(null);
  const [glBadge, setGlBadge] = useState<GLBadgeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const effectiveUserId = mimickedUser?.id || user?.id;

  useEffect(() => {
    if (effectiveUserId) {
      loadData();
    }
  }, [effectiveUserId]);

  async function loadData() {
    if (!effectiveUserId) return;
    
    setLoading(true);
    try {
      // Load latest dual role request
      const { data: requestData, error: requestError } = await supabase
        .from("dual_role_access_requests")
        .select("id, status, created_at, reviewed_at, decision_note")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestError) {
        console.error("Error loading dual role request:", requestError);
      } else {
        setLatestRequest(requestData);
      }

      // Load GL badge status if user is a vendor or dual role
      if (isDualRole || isVendor) {
        const { data: glData, error: glError } = await supabase
          .from("public_vendor_gl_badges")
          .select("has_active_gl_badge, gl_expires_on")
          .eq("user_id", effectiveUserId)
          .maybeSingle();

        if (glError) {
          console.error("Error loading GL badge:", glError);
        } else {
          setGlBadge(glData);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelRequest() {
    if (!latestRequest || latestRequest.status !== "pending") return;
    
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("dual_role_access_requests")
        .update({ status: "cancelled" })
        .eq("id", latestRequest.id);

      if (error) {
        toast.error("Failed to cancel request", { description: error.message });
      } else {
        toast.success("Request cancelled");
        loadData();
      }
    } finally {
      setCancelling(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    // Also trigger a reload of role state by invalidating caches
    window.location.reload();
  }

  function handleRequestSuccess() {
    setModalOpen(false);
    loadData();
  }

  // Determine what to show
  const canRequestAccess = 
    !isDualRole && 
    (!latestRequest || ["denied", "cancelled"].includes(latestRequest.status));
  
  const hasPendingRequest = latestRequest?.status === "pending";
  const isApprovedButNotSynced = latestRequest?.status === "approved" && !isDualRole;

  if (loading || roleLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Dual Role Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Dual Role Access
          </CardTitle>
          <CardDescription>
            Switch between Field Rep and Vendor dashboards with Dual Role access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInMimicMode && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              Read-only while mimicking.
            </div>
          )}

          {/* Current Access Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Current Access</h4>
            <div className="grid gap-2">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <span className="text-sm">Field Rep Access</span>
                </div>
                {isRep ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    No
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-secondary" />
                  <span className="text-sm">Vendor Access</span>
                </div>
                {isVendor ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    No
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Dual Role Enabled</span>
                </div>
                {isDualRole ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    No
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Dual Role is enabled */}
          {isDualRole && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-green-500">Dual Role is enabled</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use the role switcher in the top navigation to switch views.
                  </p>
                </div>
              </div>

              {/* GL Badge Status */}
              {glBadge?.has_active_gl_badge && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="gap-1.5 bg-green-600 hover:bg-green-700">
                    <Shield className="h-3.5 w-3.5" />
                    GL Insured
                  </Badge>
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
              )}
            </div>
          )}

          {/* Pending Request */}
          {hasPendingRequest && !isDualRole && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <Clock className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-600">Request Pending Review</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your Dual Role access request is being reviewed by our team.
                  </p>
                </div>
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              </div>
              <Button 
                variant="outline" 
                onClick={handleCancelRequest}
                disabled={cancelling || isInMimicMode}
              >
                {cancelling ? "Cancelling..." : "Cancel Request"}
              </Button>
            </div>
          )}

          {/* Approved but not synced (edge case) */}
          {isApprovedButNotSynced && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-green-500">Approved — syncing access</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your request was approved! Refresh to update your access.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={refreshing || isInMimicMode}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          )}

          {/* Can request access */}
          {canRequestAccess && !isVendor && (
            <div className="space-y-4">
              {latestRequest?.status === "denied" && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-red-500">Previous request denied</p>
                    {latestRequest.decision_note && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {latestRequest.decision_note}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      You may submit a new request with updated information.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-muted/50 rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  Dual Role access allows you to operate as both a Field Rep and a Vendor. 
                  Submit a request to access Vendor features.
                </p>
              </div>

              {/* Coming Soon state when feature is disabled */}
              {!DUAL_ROLE_REQUESTS_ENABLED ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border border-border">
                    <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Coming Soon</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Dual Role requests are temporarily disabled while we finalize this feature. Check back soon!
                      </p>
                    </div>
                  </div>
                  <Button disabled className="opacity-50 cursor-not-allowed">
                    <Lock className="h-4 w-4 mr-2" />
                    Request Dual Role Access
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => setModalOpen(true)}
                  disabled={isInMimicMode}
                >
                  Request Dual Role Access
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DualRoleRequestModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
        onSuccess={handleRequestSuccess}
      />
    </>
  );
}
