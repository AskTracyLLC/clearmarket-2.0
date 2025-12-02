import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Coins } from "lucide-react";
import { getVendorCredits, getVendorTransactions } from "@/lib/credits";
import { format } from "date-fns";

interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  action: string;
  metadata: any;
}

const VendorCredits = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    if (!user) return;

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profileData?.is_vendor_admin) {
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

  const getActionLabel = (action: string) => {
    switch (action) {
      case "post_seeking_coverage":
        return "Posted Seeking Coverage";
      case "purchase":
        return "Credits Added";
      case "unlock_contact":
        return "Unlock Contact"; // TODO: future
      case "boost_post":
        return "Boost Post"; // TODO: future
      case "hide_feedback":
        return "Hide Feedback"; // TODO: future
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
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Credits</h1>
          <p className="text-muted-foreground">
            Manage your ClearMarket credits balance and view transaction history.
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
            <div className="bg-muted/50 rounded-lg p-4 mb-6 border border-border">
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Coins className="h-4 w-4 text-secondary" />
                Powered by Credits
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Seeking Coverage post</strong> – 1 credit per post</li>
                <li>• <strong>Unlock rep contact</strong> – 1 credit per rep</li>
                <li>• <strong>Boost post visibility</strong> – Coming soon</li>
              </ul>
            </div>
            
            {/* TODO: Wire up Stripe or payment flow */}
            <Button disabled variant="secondary">
              Buy Credits (Coming Soon)
            </Button>
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

                  return (
                    <div
                      key={tx.id}
                      className="grid grid-cols-12 gap-4 px-3 py-3 text-sm border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <div className="col-span-3 text-muted-foreground">
                        {format(new Date(tx.created_at), "MM/dd/yyyy")}
                      </div>
                      <div className="col-span-4">
                        <div className="font-medium text-foreground">{getActionLabel(tx.action)}</div>
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
            <li>• <strong>Unlock rep contact details</strong> – Reveal phone/email for direct outreach</li>
            <li>• <strong>Boost Seeking Coverage posts</strong> – Get more visibility from reps</li>
            <li>• <strong>Hide/unhide feedback</strong> – Manage reputation display (if paid later)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VendorCredits;
