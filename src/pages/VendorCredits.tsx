import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Coins, CheckCircle, XCircle, Loader2, CreditCard, Sparkles, ExternalLink, RefreshCw } from "lucide-react";
import { CREDIT_PACKS, CreditPack } from "@/lib/creditPacks";
import { format } from "date-fns";
import { toast } from "sonner";
import AdminViewBanner from "@/components/AdminViewBanner";
import { 
  resolveCurrentVendorId, 
  getVendorWalletBalance, 
  getVendorWalletTransactions,
  VendorWalletTransaction 
} from "@/lib/vendorWallet";

const VendorCredits = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<VendorWalletTransaction[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Stable derived value for success status
  const isSuccess = useMemo(() => {
    return new URLSearchParams(location.search).get("status") === "success";
  }, [location.search]);

  const isCancelled = useMemo(() => {
    return new URLSearchParams(location.search).get("status") === "cancelled";
  }, [location.search]);

  // Refs to track polling state without causing re-renders
  const initialBalanceRef = useRef<number | null>(null);
  const initialTxCountRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const vendorIdRef = useRef<string | null>(null);

  // Stable fetch functions using vendorIdRef
  const fetchBalance = useCallback(async () => {
    if (!vendorIdRef.current) return null;
    return await getVendorWalletBalance(vendorIdRef.current);
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!vendorIdRef.current) return [];
    return await getVendorWalletTransactions(vendorIdRef.current, 100);
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Credits page accessible to vendor owner AND vendor staff
    const isVendorOwner = profileData?.is_vendor_admin;
    const isAdmin = profileData?.is_admin;

    // Check if user is a vendor staff member
    const { data: staffRecord } = await supabase
      .from("vendor_staff")
      .select("vendor_id")
      .eq("staff_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const isVendorStaff = !!staffRecord;

    // Allow access if admin, vendor owner, or vendor staff
    if (!isAdmin && !isVendorOwner && !isVendorStaff) {
      navigate("/dashboard");
      return;
    }

    if (mountedRef.current) {
      setProfile(profileData);
    }

    // Resolve vendor_id for shared wallet
    const resolvedVendorId = await resolveCurrentVendorId(user.id);
    if (!resolvedVendorId) {
      toast.error("Could not determine vendor account.");
      navigate("/dashboard");
      return;
    }

    if (mountedRef.current) {
      setVendorId(resolvedVendorId);
      vendorIdRef.current = resolvedVendorId;
    }

    // Load credit balance from vendor_wallet
    const credits = await getVendorWalletBalance(resolvedVendorId);
    if (mountedRef.current) {
      setBalance(credits ?? 0);
    }

    // Load transaction history from vendor_wallet_transactions
    const txData = await getVendorWalletTransactions(resolvedVendorId, 100);
    if (mountedRef.current) {
      setTransactions(txData);
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

  // Auto-poll after successful purchase (webhook may take a moment)
  useEffect(() => {
    if (!isSuccess || !user) return;

    // Capture initial state when polling starts
    initialBalanceRef.current = balance;
    initialTxCountRef.current = transactions.length;
    setIsPolling(true);

    let pollCount = 0;
    const maxPolls = 12; // 60 seconds total (5s interval)

    const pollInterval = setInterval(async () => {
      pollCount++;
      
      const newBalance = await fetchBalance();
      const newTx = await fetchTransactions();
      
      if (!mountedRef.current) {
        clearInterval(pollInterval);
        return;
      }

      // Check if balance or transaction count changed from initial
      const balanceChanged = newBalance !== null && newBalance !== initialBalanceRef.current;
      const txCountChanged = newTx.length !== initialTxCountRef.current;

      if (balanceChanged || txCountChanged) {
        setBalance(newBalance ?? 0);
        setTransactions(newTx);
        clearInterval(pollInterval);
        setIsPolling(false);
        return;
      }

      if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
        setIsPolling(false);
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isSuccess, user, fetchBalance, fetchTransactions]); // Note: balance/transactions NOT in deps

  // Clear status param after showing message
  useEffect(() => {
    if (isSuccess || isCancelled) {
      const timer = setTimeout(() => {
        navigate(location.pathname, { replace: true });
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isCancelled, navigate, location.pathname]);


  const handleBuyCredits = async (pack: CreditPack) => {
    if (!user) {
      toast.error("Please sign in to purchase credits");
      return;
    }

    setPurchaseLoading(pack.id);

    try {
      const { data, error } = await supabase.functions.invoke("create-credit-checkout", {
        body: { packId: pack.id },
      });

      if (error) {
        console.error("Checkout error:", error);
        toast.error(error.message || "Failed to create checkout session");
        return;
      }

      if (data?.checkoutUrl) {
        // Open Stripe Checkout in new tab (can't run in iframe)
        window.open(data.checkoutUrl, '_blank');
      } else {
        toast.error("No checkout URL received");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setPurchaseLoading(null);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "post_seeking_coverage":
        return "Posted Seeking Coverage";
      case "credit_purchase":
        return "Credits Purchased";
      case "purchase":
        return "Credits Added";
      case "unlock_contact":
        return "Contact Access (Legacy)"; // Historical transaction label
      case "boost_post":
        return "Boost Post";
      case "hide_feedback":
        return "Hide Feedback";
      default:
        return action;
    }
  };

  const getDetailsText = (tx: VendorWalletTransaction) => {
    if (!tx.metadata) return "";

    const meta = tx.metadata as Record<string, any>;

    if (tx.txn_type === "post_seeking_coverage") {
      const { state_code, post_title } = meta;
      return `${state_code ? state_code + " – " : ""}${post_title || "Seeking Coverage post"}`;
    }

    if (tx.txn_type === "credit_purchase") {
      const { credit_pack_id } = meta;
      const pack = CREDIT_PACKS.find((p) => p.id === credit_pack_id);
      return pack ? pack.label : "Credit pack purchase";
    }

    return "";
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Admin View Banner */}
        {profile?.is_admin && <AdminViewBanner />}
        
        {/* Status Alerts */}
        {isSuccess && (
          <Alert className="mb-6 border-green-600/50 bg-green-600/10">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600 flex items-center justify-between gap-4">
              <span>
                Payment successful! {isPolling ? "Checking for your credits..." : "Your credits will be available shortly."}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadData}
                disabled={isPolling}
                className="shrink-0 text-green-600 hover:text-green-700 hover:bg-green-600/10"
              >
                {isPolling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1">Refresh</span>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isCancelled && (
          <Alert className="mb-6 border-muted-foreground/50 bg-muted/50">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <AlertDescription className="text-muted-foreground">
              Payment canceled. No credits were charged. You can try again anytime.
            </AlertDescription>
          </Alert>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Credits</h1>
          <p className="text-muted-foreground">
            Manage your ClearMarket credits balance and purchase more to unlock premium features.
          </p>
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
            <div className="text-5xl font-bold text-foreground mb-4">{balance}</div>
            <p className="text-sm text-muted-foreground mb-4">
              Credits are used for premium ClearMarket actions like posting Seeking Coverage and other tools.
            </p>
            
            {/* Powered by Credits explainer */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                Powered by Credits
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Seeking Coverage post</strong> – 1 credit per post</li>
                <li>• <strong>Boost post visibility</strong> – Coming soon</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                All payments are securely processed via Stripe. Credits are non-refundable and do not expire.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Buy Credits Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-secondary" />
              Buy Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Choose a credit pack to get started. Payments are securely handled by Stripe.
            </p>
            
            <div className="grid gap-4 md:grid-cols-3">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="text-lg font-semibold text-foreground mb-1">{pack.label}</div>
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {pack.credits} <span className="text-sm font-normal text-muted-foreground">credits</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{pack.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-foreground">${pack.priceUsd.toFixed(2)}</span>
                    <Button
                      onClick={() => handleBuyCredits(pack)}
                      disabled={purchaseLoading !== null}
                      size="sm"
                    >
                      {purchaseLoading === pack.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Buy"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
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
                No transactions yet. Credits will be deducted when you use premium features.
              </p>
            ) : (
              <div className="space-y-1">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                  <div className="col-span-3">Date</div>
                  <div className="col-span-4">Action</div>
                  <div className="col-span-3 text-right">Amount</div>
                  <div className="col-span-2 text-right">Balance</div>
                </div>

                {/* Transactions - sorted DESC (newest first) */}
                {/* Balance column shows balance AFTER that transaction */}
                {/* For row 0 (newest): balance = currentBalance */}
                {/* For row 1: balance = currentBalance - tx[0].amount */}
                {/* etc. */}
                {transactions.map((tx, idx) => {
                  // Calculate balance after this transaction
                  // Sum all transactions NEWER than this one (indices 0 to idx-1)
                  const creditsAfterNewerTx = transactions
                    .slice(0, idx)
                    .reduce((sum, t) => sum + t.delta, 0);
                  const balanceAfterThisTx = balance - creditsAfterNewerTx;

                  // Determine if this transaction has a clickable related entity
                  const meta = tx.metadata as Record<string, any> | null;
                  const relatedPostId = meta?.post_id || meta?.related_entity_id;
                  const hasRelatedEntity = tx.txn_type === "post_seeking_coverage" && relatedPostId;

                  return (
                    <div
                      key={tx.id}
                      className="grid grid-cols-12 gap-4 px-3 py-3 text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="col-span-3 text-muted-foreground">
                        {format(new Date(tx.created_at), "MM/dd/yyyy h:mm a")}
                      </div>
                      <div className="col-span-4">
                        {hasRelatedEntity ? (
                          <Link
                            to={`/vendor/seeking-coverage?highlightPostId=${relatedPostId}`}
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {getActionLabel(tx.txn_type)}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <div className="font-medium text-foreground">{getActionLabel(tx.txn_type)}</div>
                        )}
                        {getDetailsText(tx) && (
                          <div className="text-xs text-muted-foreground mt-0.5">{getDetailsText(tx)}</div>
                        )}
                      </div>
                      <div className={`col-span-3 text-right font-semibold ${tx.delta > 0 ? "text-green-600" : "text-orange-600"}`}>
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

        {/* Future Actions TODOs */}
        <div className="mt-6 p-4 bg-muted/30 rounded-md border border-border">
          <p className="text-sm font-medium text-foreground mb-2">Coming Soon:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Boost Seeking Coverage posts</strong> – Get more visibility from reps</li>
            <li>• <strong>Hide/unhide feedback</strong> – Manage reputation display</li>
          </ul>
        </div>
      </div>
  );
};

export default VendorCredits;
