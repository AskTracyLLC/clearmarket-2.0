import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Coins, CheckCircle, XCircle, Loader2, CreditCard, Sparkles, ExternalLink } from "lucide-react";
import { getVendorCredits, getVendorTransactions } from "@/lib/credits";
import { CREDIT_PACKS, CreditPack } from "@/lib/creditPacks";
import { format } from "date-fns";
import { toast } from "sonner";
import AdminViewBanner from "@/components/AdminViewBanner";

interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  action: string;
  metadata: any;
  related_entity_type: string | null;
  related_entity_id: string | null;
}

const VendorCredits = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);

  // Handle success/cancel status from Stripe redirect
  const status = searchParams.get("status");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate]);

  // Clear status param after showing message
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        setSearchParams({});
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [status, setSearchParams]);

  const loadData = async () => {
    if (!user) return;

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profileData?.is_vendor_admin && !profileData?.is_admin) {
      navigate("/dashboard");
      return;
    }

    setProfile(profileData);

    // Load credit balance
    const credits = await getVendorCredits(user.id);
    setBalance(credits ?? 0);

    // Load transaction history
    const txData = await getVendorTransactions(user.id);
    setTransactions(txData);

    setLoading(false);
  };

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
        return "Unlock Contact";
      case "boost_post":
        return "Boost Post";
      case "hide_feedback":
        return "Hide Feedback";
      default:
        return action;
    }
  };

  const getDetailsText = (tx: Transaction) => {
    if (!tx.metadata) return "";

    if (tx.action === "post_seeking_coverage") {
      const { state_code, post_title } = tx.metadata;
      return `${state_code ? state_code + " – " : ""}${post_title || "Seeking Coverage post"}`;
    }

    if (tx.action === "credit_purchase") {
      const { credit_pack_id } = tx.metadata;
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                ClearMarket
              </Link>
            </div>
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Admin View Banner */}
        {profile?.is_admin && <AdminViewBanner />}
        
        {/* Status Alerts */}
        {status === "success" && (
          <Alert className="mb-6 border-green-600/50 bg-green-600/10">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">
              Payment successful! Your credits will be available shortly. If they don't appear within a few minutes, please refresh the page or contact support.
            </AlertDescription>
          </Alert>
        )}

        {status === "cancelled" && (
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
              Credits are used for premium ClearMarket actions like posting Seeking Coverage, unlocking contacts, and other tools.
            </p>
            
            {/* Powered by Credits explainer */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                Powered by Credits
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Seeking Coverage post</strong> – 1 credit per post</li>
                <li>• <strong>Unlock rep contact</strong> – 1 credit per rep</li>
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

                {/* Transactions */}
                {transactions.map((tx, idx) => {
                  // Calculate running balance by summing up to this point
                  const runningBalance = balance + transactions
                    .slice(0, idx + 1)
                    .reduce((sum, t) => sum - t.amount, 0);

                  // Determine if this transaction has a clickable related entity
                  const hasRelatedEntity = tx.related_entity_type === "seeking_coverage_post" && tx.related_entity_id;

                  return (
                    <div
                      key={tx.id}
                      className="grid grid-cols-12 gap-4 px-3 py-3 text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="col-span-3 text-muted-foreground">
                        {format(new Date(tx.created_at), "MM/dd/yyyy")}
                      </div>
                      <div className="col-span-4">
                        {hasRelatedEntity ? (
                          <Link
                            to={`/vendor/seeking-coverage?highlightPostId=${tx.related_entity_id}`}
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {getActionLabel(tx.action)}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <div className="font-medium text-foreground">{getActionLabel(tx.action)}</div>
                        )}
                        {getDetailsText(tx) && (
                          <div className="text-xs text-muted-foreground mt-0.5">{getDetailsText(tx)}</div>
                        )}
                      </div>
                      <div className={`col-span-3 text-right font-semibold ${tx.amount > 0 ? "text-green-600" : "text-orange-600"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground">
                        {runningBalance}
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
    </div>
  );
};

export default VendorCredits;
