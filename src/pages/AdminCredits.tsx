import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Search, 
  Coins, 
  Building2, 
  Loader2, 
  AlertCircle,
  Plus,
  Minus,
  RefreshCw,
  ExternalLink
} from "lucide-react";

/**
 * Credit System Rule:
 * - Vendor credits live in vendor_wallet (keyed by vendor_profile.id)
 * - Rep credits (if enabled) live in user_wallet (keyed by profiles.id)
 * - Never mix spend/adjust flows across them
 * 
 * This page manages VENDOR credits only via vendor_wallet + vendor_wallet_transactions.
 */

interface VendorSearchResult {
  vendor_id: string; // vendor_profile.id
  owner_user_id: string; // vendor_profile.user_id (profiles.id of owner)
  company_name: string | null;
  owner_full_name: string | null;
  anonymous_id: string | null;
  vendor_public_code: string | null;
  credits_balance: number;
}

interface VendorWalletTransaction {
  id: string;
  vendor_id: string;
  actor_user_id: string;
  txn_type: string;
  delta: number;
  metadata: Record<string, any> | null;
  created_at: string;
}

const AdminCredits = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VendorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedVendor, setSelectedVendor] = useState<VendorSearchResult | null>(null);
  const [transactions, setTransactions] = useState<VendorWalletTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Check for vendorId query param on mount
  useEffect(() => {
    const vendorIdParam = searchParams.get("vendorId");
    if (vendorIdParam && !selectedVendor) {
      loadVendorById(vendorIdParam);
    }
  }, [searchParams]);

  // Permission check
  useEffect(() => {
    if (!authLoading && !permLoading) {
      if (!user) {
        navigate("/signin");
        return;
      }
      if (!permissions.canManageCredits) {
        toast.error("You don't have access to Credit Management.");
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, permissions, permLoading, navigate]);

  const loadVendorById = async (vendorId: string) => {
    // Fetch vendor_profile with owner profile info
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendor_profile")
      .select(`
        id,
        user_id,
        company_name,
        anonymous_id,
        vendor_public_code,
        profiles!vendor_profile_user_id_fkey(email, full_name)
      `)
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendorData) {
      console.error("Error loading vendor:", vendorError);
      toast.error("Vendor not found");
      return;
    }

    // Get vendor wallet balance
    const { data: walletData } = await supabase
      .from("vendor_wallet")
      .select("credits_balance")
      .eq("vendor_id", vendorId)
      .maybeSingle();

    const ownerProfile = vendorData.profiles as { full_name: string | null } | null;

    const vendorResult: VendorSearchResult = {
      vendor_id: vendorData.id,
      owner_user_id: vendorData.user_id,
      company_name: vendorData.company_name,
      owner_full_name: ownerProfile?.full_name || null,
      anonymous_id: vendorData.anonymous_id,
      vendor_public_code: vendorData.vendor_public_code,
      credits_balance: walletData?.credits_balance ?? 0,
    };

    setSelectedVendor(vendorResult);
    loadTransactions(vendorId);
  };

  const searchVendors = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const searchTerm = `%${query.trim()}%`;

      // Search vendor_profile by company_name, anonymous_id, or vendor_public_code
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendor_profile")
        .select(`
          id,
          user_id,
          company_name,
          anonymous_id,
          vendor_public_code,
          profiles!vendor_profile_user_id_fkey(full_name)
        `)
        .or(`company_name.ilike.${searchTerm},anonymous_id.ilike.${searchTerm},vendor_public_code.ilike.${searchTerm}`)
        .limit(20);

      if (vendorError) {
        console.error("Vendor search error:", vendorError);
        setSearchResults([]);
        return;
      }

      // Email search removed for privacy - only search by company name, anonymous_id, vendor_public_code
      const allVendors = vendorData || [];
      const vendorIds = allVendors.map((v) => v.id);

      // Get wallet balances for all vendors
      const { data: wallets } = await supabase
        .from("vendor_wallet")
        .select("vendor_id, credits_balance")
        .in("vendor_id", vendorIds);

      const walletMap = new Map((wallets || []).map((w) => [w.vendor_id, w.credits_balance]));

      const results: VendorSearchResult[] = allVendors.map((v) => {
        const ownerProfile = v.profiles as { full_name: string | null } | null;
        return {
          vendor_id: v.id,
          owner_user_id: v.user_id,
          company_name: v.company_name,
          owner_full_name: ownerProfile?.full_name || null,
          anonymous_id: v.anonymous_id,
          vendor_public_code: v.vendor_public_code,
          credits_balance: walletMap.get(v.id) ?? 0,
        };
      });

      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchVendors(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchVendors]);

  const loadTransactions = async (vendorId: string) => {
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from("vendor_wallet_transactions")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Error loading transactions:", error);
        return;
      }

      setTransactions((data || []) as VendorWalletTransaction[]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const selectVendor = (v: VendorSearchResult) => {
    setSelectedVendor(v);
    setAdjustAmount("");
    setAdjustNote("");
    loadTransactions(v.vendor_id);
  };

  const [refreshing, setRefreshing] = useState(false);

  const refreshSelectedVendor = async () => {
    if (!selectedVendor) return;
    
    setRefreshing(true);
    try {
      const { data: walletData, error } = await supabase
        .from("vendor_wallet")
        .select("credits_balance")
        .eq("vendor_id", selectedVendor.vendor_id)
        .maybeSingle();

      if (error) {
        console.error("Error refreshing vendor wallet:", error);
        toast.error("Failed to refresh balance");
        return;
      }

      setSelectedVendor({
        ...selectedVendor,
        credits_balance: walletData?.credits_balance ?? 0,
      });
      loadTransactions(selectedVendor.vendor_id);
      toast.success("Balance refreshed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleAdjust = async () => {
    if (!selectedVendor) return;

    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount === 0) {
      toast.error("Amount must be a non-zero integer");
      return;
    }

    if (!adjustNote.trim()) {
      toast.error("Note is required for admin adjustments");
      return;
    }

    setAdjusting(true);
    try {
      // Call edge function with vendor_id (not user_id)
      const { data, error } = await supabase.functions.invoke("admin-adjust-credits", {
        body: {
          vendor_id: selectedVendor.vendor_id,
          amount,
          note: adjustNote.trim(),
        },
      });

      if (error) {
        console.error("Adjust credits error:", error);
        toast.error(error.message || "Failed to adjust credits");
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Failed to adjust credits");
        return;
      }

      toast.success(`Vendor credits updated. New balance: ${data.new_balance}`);
      
      // Update local state
      setSelectedVendor({
        ...selectedVendor,
        credits_balance: data.new_balance,
      });
      setAdjustAmount("");
      setAdjustNote("");
      loadTransactions(selectedVendor.vendor_id);
    } finally {
      setAdjusting(false);
    }
  };

  const getTxnTypeLabel = (txnType: string) => {
    switch (txnType) {
      case "post_seeking_coverage":
      case "seeking_coverage_post":
        return "Seeking Coverage Post";
      case "credit_purchase":
        return "Credits Purchased";
      case "purchase":
        return "Credits Added";
      case "admin_adjustment":
        return "Admin Adjustment";
      case "migration_from_user_wallet":
        return "Migrated from Legacy";
      case "spend_unlock":
        return "Contact Unlock";
      default:
        return txnType;
    }
  };

  const previewNewBalance = () => {
    if (!selectedVendor) return null;
    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount === 0) return null;
    const newBalance = Math.max(0, selectedVendor.credits_balance + amount);
    return newBalance;
  };

  const isAdjustDisabled = () => {
    if (!selectedVendor) return true;
    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount === 0) return true;
    if (!adjustNote.trim()) return true;
    if (adjusting) return true;
    return false;
  };

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Vendor Credit Management</h1>
        <p className="text-muted-foreground">
          Search for vendors and manually adjust their shared credit balance. All changes are logged.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Vendor credits use <code className="bg-muted px-1 rounded">vendor_wallet</code> — changes apply to the entire vendor team.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Search Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Find Vendor
              </CardTitle>
              <CardDescription>
                Search by company name, Vendor Code, Vendor #, or owner email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input
                  placeholder="Company, Vendor Code, Vendor #, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
                {searching && (
                  <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 border border-border rounded-md divide-y divide-border max-h-80 overflow-y-auto">
                  {searchResults.map((v) => (
                    <div
                      key={v.vendor_id}
                      className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                        selectedVendor?.vendor_id === v.vendor_id ? "bg-muted" : ""
                      }`}
                      onClick={() => selectVendor(v)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {v.company_name || "Unnamed Vendor"}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                            {v.vendor_public_code && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                Code: {v.vendor_public_code}
                              </Badge>
                            )}
                            {v.anonymous_id && <span>{v.anonymous_id}</span>}
                          </div>
                          {v.owner_full_name && (
                            <div className="text-xs text-muted-foreground">
                              Owner: {v.owner_full_name}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground flex items-center gap-1">
                            <Coins className="h-3 w-3 text-secondary" />
                            {v.credits_balance}
                          </div>
                          <Button size="sm" variant="outline" className="mt-1 text-xs h-7">
                            Manage
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.trim() && !searching && searchResults.length === 0 && (
                <div className="mt-4 text-center py-6 text-muted-foreground text-sm">
                  No vendors found matching "{searchQuery}"
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Vendor Credits Panel */}
        <div className="space-y-4">
          {!selectedVendor ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Search and select a vendor to manage their credits
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Vendor Info Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-secondary" />
                        {selectedVendor.company_name || "Unnamed Vendor"}
                      </CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        {selectedVendor.vendor_public_code && (
                          <Badge variant="outline" className="text-xs">
                            Code: {selectedVendor.vendor_public_code}
                          </Badge>
                        )}
                        {selectedVendor.anonymous_id && (
                          <Badge variant="secondary" className="text-xs">
                            {selectedVendor.anonymous_id}
                          </Badge>
                        )}
                      </CardDescription>
                      {selectedVendor.owner_full_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Owner: {selectedVendor.owner_full_name}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={refreshSelectedVendor}
                      disabled={refreshing}
                      title="Refresh"
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-5xl font-bold text-foreground mb-2">
                    {selectedVendor.credits_balance}
                  </div>
                  <p className="text-sm text-muted-foreground">Shared Vendor Balance</p>
                </CardContent>
              </Card>

              {/* Manual Adjustment Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Manual Adjustment</CardTitle>
                  <CardDescription>
                    Add or remove credits. Positive values add, negative values remove.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        type="button"
                        onClick={() => {
                          const current = parseInt(adjustAmount, 10) || 0;
                          setAdjustAmount(String(current - 1));
                        }}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="e.g., 10 or -5"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        className="text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        type="button"
                        onClick={() => {
                          const current = parseInt(adjustAmount, 10) || 0;
                          setAdjustAmount(String(current + 1));
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Reason / Note (required)</Label>
                    <Textarea
                      id="note"
                      placeholder="Why are you adjusting this vendor's credits?"
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {previewNewBalance() !== null && (
                    <div className="bg-muted/50 rounded-md p-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        <span>
                          Balance will change from <strong>{selectedVendor.credits_balance}</strong> to{" "}
                          <strong>{previewNewBalance()}</strong> credits
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleAdjust}
                    disabled={isAdjustDisabled()}
                    className="w-full"
                  >
                    {adjusting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      "Apply Adjustment"
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Transactions</CardTitle>
                  <CardDescription>
                    From <code className="bg-muted px-1 rounded text-xs">vendor_wallet_transactions</code>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTransactions ? (
                    <div className="py-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No transactions yet.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-12 gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b border-border">
                        <div className="col-span-3">Date</div>
                        <div className="col-span-5">Type</div>
                        <div className="col-span-2 text-right">Delta</div>
                        <div className="col-span-2 text-right">Note</div>
                      </div>
                      {transactions.map((tx) => {
                        const postTitle = tx.metadata?.post_title || tx.metadata?.state_code || null;
                        const hasPostLink = tx.metadata?.post_id || tx.metadata?.related_entity_id;
                        
                        return (
                          <div
                            key={tx.id}
                            className="grid grid-cols-12 gap-2 px-2 py-2 text-sm border-b border-border last:border-0 hover:bg-muted/30"
                          >
                            <div className="col-span-3 text-muted-foreground text-xs">
                              {format(new Date(tx.created_at), "MM/dd/yy HH:mm")}
                            </div>
                            <div className="col-span-5 text-xs">
                              {hasPostLink ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/vendor/seeking-coverage?vendorId=${selectedVendor.owner_user_id}&highlightPostId=${tx.metadata?.post_id || tx.metadata?.related_entity_id}`)}
                                  className="text-primary hover:underline flex items-center gap-1 text-left"
                                >
                                  {getTxnTypeLabel(tx.txn_type)}
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              ) : (
                                <span className="text-foreground">{getTxnTypeLabel(tx.txn_type)}</span>
                              )}
                              {postTitle && (
                                <div className="text-muted-foreground text-[10px] mt-0.5 truncate" title={postTitle}>
                                  {postTitle}
                                </div>
                              )}
                            </div>
                            <div className={`col-span-2 text-right font-semibold text-xs ${
                              tx.delta > 0 ? "text-green-600" : "text-orange-600"
                            }`}>
                              {tx.delta > 0 ? "+" : ""}{tx.delta}
                            </div>
                            <div className="col-span-2 text-right text-xs text-muted-foreground truncate" title={tx.metadata?.note || ""}>
                              {tx.metadata?.note ? "📝" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCredits;
