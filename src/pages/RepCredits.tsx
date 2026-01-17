import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Zap, Loader2, Sparkles, Clock, Rocket, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useRepCredits } from "@/hooks/useRepCredits";
import { useRepBoostStatus } from "@/hooks/useRepBoostStatus";

interface Transaction {
  id: string;
  created_at: string;
  txn_type: string;
  delta: number;
  metadata: unknown;
}

const RepCredits = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [boostPurchasing, setBoostPurchasing] = useState(false);
  const mountedRef = useRef(true);

  const { balance, loading: creditsLoading, refresh: refreshCredits } = useRepCredits();
  const { status: boostStatus, loading: boostLoading, purchaseBoost, refresh: refreshBoost } = useRepBoostStatus();

  const loadData = useCallback(async () => {
    if (!user) return;

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Only reps can access this page
    if (!profileData?.is_fieldrep && !profileData?.is_admin) {
      navigate("/dashboard");
      return;
    }

    if (mountedRef.current) {
      setProfile(profileData);
    }

    // Load transaction history
    const { data: txData } = await supabase
      .from("user_wallet_transactions")
      .select("id, created_at, txn_type, delta, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (mountedRef.current) {
      setTransactions(txData || []);
      setLoading(false);
    }
  }, [user, navigate]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate, loadData]);

  const handleBoostPurchase = async () => {
    setBoostPurchasing(true);
    try {
      const result = await purchaseBoost();
      if (result.ok) {
        toast.success("Boost activated!", {
          description: `Your visibility boost is active until ${format(new Date(result.ends_at), "MMM d, h:mm a")}`,
        });
        refreshCredits();
        refreshBoost();
        loadData(); // Refresh transactions
      } else {
        toast.error("Boost failed", {
          description: result.error === "INSUFFICIENT_CREDITS" 
            ? "You don't have enough credits. Complete onboarding to earn more." 
            : result.error,
        });
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setBoostPurchasing(false);
    }
  };

  const getActionLabel = (txnType: string) => {
    switch (txnType) {
      case "reward_onboarding":
        return "Onboarding Reward";
      case "reward_profile_pricing":
        return "Profile & Pricing Milestone";
      case "spend_boost_visibility":
        return "Visibility Boost";
      case "admin_adjustment":
        return "Admin Adjustment";
      default:
        return txnType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const getDetailsText = (tx: Transaction) => {
    if (!tx.metadata || typeof tx.metadata !== "object") return "";
    const meta = tx.metadata as Record<string, unknown>;

    if (tx.txn_type === "spend_boost_visibility" && meta.ends_at) {
      return `Boost until ${format(new Date(meta.ends_at as string), "MMM d, h:mm a")}`;
    }

    if (meta.description && typeof meta.description === "string") {
      return meta.description;
    }

    return "";
  };

  const handleRefresh = () => {
    refreshCredits();
    refreshBoost();
    loadData();
  };

  if (authLoading || loading || creditsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Credits</h1>
          <p className="text-muted-foreground">
            View your credit balance and transaction history.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Balance Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-secondary" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-bold text-foreground mb-4">{balance ?? 0}</div>
          <p className="text-sm text-muted-foreground mb-4">
            Credits are earned through onboarding milestones and can be spent on visibility boosts.
          </p>
          
          {/* Powered by Credits explainer */}
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary" />
              How to Earn & Spend Credits
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Complete profile & pricing</strong> – Earn 2 credits</li>
              <li>• <strong>Finish onboarding</strong> – Earn up to 5 total credits</li>
              <li>• <strong>Visibility Boost</strong> – Spend 2 credits for 48 hours of boosted visibility</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              Credits are non-refundable. Boosts are non-refundable and do not guarantee work.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Boost Visibility Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-secondary" />
            Boost Visibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Boost your visibility in vendor search results for 48 hours. Boosted reps appear higher in search results when vendors are looking for coverage.
          </p>

          {boostLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : boostStatus.isBoosted && boostStatus.activeEndsAt ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                <Badge variant="secondary" className="gap-1">
                  <Rocket className="h-3 w-3" />
                  Active Boost
                </Badge>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Boost active until {format(new Date(boostStatus.activeEndsAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ({formatDistanceToNow(new Date(boostStatus.activeEndsAt), { addSuffix: true })})
                  </p>
                </div>
              </div>
              <Button
                onClick={handleBoostPurchase}
                disabled={boostPurchasing || (balance ?? 0) < 2}
                className="gap-2"
              >
                {boostPurchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Extend Boost (+48 hours for 2 credits)
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">No active boost</p>
                  <p className="text-xs text-muted-foreground">
                    Purchase a boost to appear higher in vendor search results.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleBoostPurchase}
                disabled={boostPurchasing || (balance ?? 0) < 2}
                className="gap-2"
              >
                {boostPurchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Boost Visibility (48 hours for 2 credits)
                  </>
                )}
              </Button>
              {(balance ?? 0) < 2 && (
                <p className="text-sm text-muted-foreground">
                  You need at least 2 credits to purchase a boost.{" "}
                  <Link to="/dashboard" className="text-primary hover:underline">
                    Complete onboarding
                  </Link>{" "}
                  to earn more credits.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Boost increases your visibility but does not guarantee work. 
              If multiple reps boost in the same area, boosted reps are sorted by expiration time (latest first).{" "}
              <Link to="/help/boost-visibility-field-reps" className="text-primary hover:underline">
                Learn more
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No transactions yet. Complete onboarding milestones to earn credits.
            </p>
          ) : (
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                <div className="col-span-3">Date</div>
                <div className="col-span-5">Action</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-2 text-right">Balance</div>
              </div>

              {/* Transactions */}
              {transactions.map((tx, idx) => {
                // Calculate balance after this transaction
                const creditsAfterNewerTx = transactions
                  .slice(0, idx)
                  .reduce((sum, t) => sum + t.delta, 0);
                const balanceAfterThisTx = (balance ?? 0) - creditsAfterNewerTx;

                return (
                  <div
                    key={tx.id}
                    className="grid grid-cols-12 gap-4 px-3 py-3 text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="col-span-3 text-muted-foreground">
                      {format(new Date(tx.created_at), "MM/dd/yyyy h:mm a")}
                    </div>
                    <div className="col-span-5">
                      <div className="font-medium text-foreground">{getActionLabel(tx.txn_type)}</div>
                      {getDetailsText(tx) && (
                        <div className="text-xs text-muted-foreground mt-0.5">{getDetailsText(tx)}</div>
                      )}
                    </div>
                    <div className={`col-span-2 text-right font-semibold ${tx.delta > 0 ? "text-green-600" : "text-orange-600"}`}>
                      {tx.delta > 0 ? "+" : ""}{tx.delta}
                    </div>
                    <div className="col-span-2 text-right text-muted-foreground">
                      {balanceAfterThisTx}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RepCredits;
