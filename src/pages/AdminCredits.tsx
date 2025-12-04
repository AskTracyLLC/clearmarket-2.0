import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Search, 
  Coins, 
  User, 
  Loader2, 
  AlertCircle,
  Plus,
  Minus,
  RefreshCw
} from "lucide-react";

interface UserSearchResult {
  id: string;
  email: string;
  full_name: string | null;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
  is_admin: boolean;
  is_moderator: boolean;
  is_support: boolean;
  credits: number;
  rep_anonymous_id?: string | null;
  vendor_anonymous_id?: string | null;
  staff_anonymous_id?: string | null;
}

interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  action: string;
  metadata: any;
}

const AdminCredits = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permLoading } = useStaffPermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Check for userId query param on mount
  useEffect(() => {
    const userIdParam = searchParams.get("userId");
    if (userIdParam && !selectedUser) {
      loadUserById(userIdParam);
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

  const loadUserById = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id, email, full_name, is_fieldrep, is_vendor_admin, is_admin, is_moderator, is_support, staff_anonymous_id,
        rep_profile(anonymous_id),
        vendor_profile(anonymous_id)
      `)
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("Error loading user:", error);
      return;
    }

    // Get wallet balance
    const { data: walletData } = await supabase
      .from("user_wallet")
      .select("credits")
      .eq("user_id", userId)
      .maybeSingle();

    const userResult: UserSearchResult = {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      is_fieldrep: data.is_fieldrep,
      is_vendor_admin: data.is_vendor_admin,
      is_admin: data.is_admin,
      is_moderator: data.is_moderator,
      is_support: data.is_support,
      credits: walletData?.credits ?? 0,
      rep_anonymous_id: (data.rep_profile as any)?.anonymous_id,
      vendor_anonymous_id: (data.vendor_profile as any)?.anonymous_id,
      staff_anonymous_id: data.staff_anonymous_id,
    };

    setSelectedUser(userResult);
    loadTransactions(userId);
  };

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const searchTerm = `%${query.trim()}%`;

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id, email, full_name, is_fieldrep, is_vendor_admin, is_admin, is_moderator, is_support, staff_anonymous_id,
          rep_profile(anonymous_id),
          vendor_profile(anonymous_id)
        `)
        .or(`email.ilike.${searchTerm},full_name.ilike.${searchTerm}`)
        .limit(20);

      if (error) {
        console.error("Search error:", error);
        setSearchResults([]);
        return;
      }

      // Get wallet balances for all results
      const userIds = (data || []).map((u) => u.id);
      const { data: wallets } = await supabase
        .from("user_wallet")
        .select("user_id, credits")
        .in("user_id", userIds);

      const walletMap = new Map((wallets || []).map((w) => [w.user_id, w.credits]));

      const results: UserSearchResult[] = (data || []).map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        is_fieldrep: u.is_fieldrep,
        is_vendor_admin: u.is_vendor_admin,
        is_admin: u.is_admin,
        is_moderator: u.is_moderator,
        is_support: u.is_support,
        credits: walletMap.get(u.id) ?? 0,
        rep_anonymous_id: (u.rep_profile as any)?.anonymous_id,
        vendor_anonymous_id: (u.vendor_profile as any)?.anonymous_id,
        staff_anonymous_id: u.staff_anonymous_id,
      }));

      // Also search by anonymous ID if query matches pattern
      if (query.toLowerCase().includes("fieldrep#") || query.toLowerCase().includes("vendor#") || query.toLowerCase().includes("admin#")) {
        const { data: repData } = await supabase
          .from("rep_profile")
          .select("user_id, anonymous_id")
          .ilike("anonymous_id", searchTerm);

        const { data: vendorData } = await supabase
          .from("vendor_profile")
          .select("user_id, anonymous_id")
          .ilike("anonymous_id", searchTerm);

        // Also search staff_anonymous_id for Admin# pattern
        const { data: staffData } = await supabase
          .from("profiles")
          .select("id")
          .ilike("staff_anonymous_id", searchTerm);

        const additionalUserIds = [
          ...(repData || []).map((r) => r.user_id),
          ...(vendorData || []).map((v) => v.user_id),
          ...(staffData || []).map((s) => s.id),
        ].filter((id) => !userIds.includes(id));

        if (additionalUserIds.length > 0) {
          const { data: additionalUsers } = await supabase
            .from("profiles")
            .select(`
              id, email, full_name, is_fieldrep, is_vendor_admin, is_admin, is_moderator, is_support, staff_anonymous_id,
              rep_profile(anonymous_id),
              vendor_profile(anonymous_id)
            `)
            .in("id", additionalUserIds);

          const { data: additionalWallets } = await supabase
            .from("user_wallet")
            .select("user_id, credits")
            .in("user_id", additionalUserIds);

          const addWalletMap = new Map((additionalWallets || []).map((w) => [w.user_id, w.credits]));

          (additionalUsers || []).forEach((u) => {
            results.push({
              id: u.id,
              email: u.email,
              full_name: u.full_name,
              is_fieldrep: u.is_fieldrep,
              is_vendor_admin: u.is_vendor_admin,
              is_admin: u.is_admin,
              is_moderator: u.is_moderator,
              is_support: u.is_support,
              credits: addWalletMap.get(u.id) ?? 0,
              rep_anonymous_id: (u.rep_profile as any)?.anonymous_id,
              vendor_anonymous_id: (u.vendor_profile as any)?.anonymous_id,
              staff_anonymous_id: u.staff_anonymous_id,
            });
          });
        }
      }

      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const loadTransactions = async (userId: string) => {
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from("vendor_credit_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error loading transactions:", error);
        return;
      }

      setTransactions(data || []);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const selectUser = (u: UserSearchResult) => {
    setSelectedUser(u);
    setAdjustAmount("");
    setAdjustNote("");
    loadTransactions(u.id);
  };

  const refreshSelectedUser = async () => {
    if (!selectedUser) return;
    
    const { data: walletData } = await supabase
      .from("user_wallet")
      .select("credits")
      .eq("user_id", selectedUser.id)
      .maybeSingle();

    setSelectedUser({
      ...selectedUser,
      credits: walletData?.credits ?? 0,
    });
    loadTransactions(selectedUser.id);
  };

  const handleAdjust = async () => {
    if (!selectedUser) return;

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
      const { data, error } = await supabase.functions.invoke("admin-adjust-credits", {
        body: {
          target_user_id: selectedUser.id,
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

      toast.success(`Credits updated successfully. New balance: ${data.new_balance}`);
      
      // Update local state
      setSelectedUser({
        ...selectedUser,
        credits: data.new_balance,
      });
      setAdjustAmount("");
      setAdjustNote("");
      loadTransactions(selectedUser.id);
    } finally {
      setAdjusting(false);
    }
  };

  const getRoleBadges = (u: UserSearchResult) => {
    const badges = [];
    if (u.is_fieldrep) badges.push(<Badge key="rep" variant="secondary" className="text-xs">Rep</Badge>);
    if (u.is_vendor_admin) badges.push(<Badge key="vendor" variant="secondary" className="text-xs">Vendor</Badge>);
    if (u.is_admin) badges.push(<Badge key="admin" variant="default" className="text-xs">Admin</Badge>);
    if (u.is_moderator) badges.push(<Badge key="mod" variant="outline" className="text-xs">Mod</Badge>);
    if (u.is_support) badges.push(<Badge key="support" variant="outline" className="text-xs">Support</Badge>);
    return badges;
  };

  const getAnonymousId = (u: UserSearchResult) => {
    // Staff get their staff_anonymous_id first (Admin#1, etc.)
    return u.staff_anonymous_id || u.rep_anonymous_id || u.vendor_anonymous_id || null;
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "post_seeking_coverage":
        return "Seeking Coverage Post";
      case "credit_purchase":
        return "Credits Purchased";
      case "purchase":
        return "Credits Added";
      case "unlock_contact":
        return "Unlock Contact";
      case "admin_adjustment":
        return "Admin Adjustment";
      default:
        return action;
    }
  };

  const previewNewBalance = () => {
    if (!selectedUser) return null;
    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount === 0) return null;
    const newBalance = Math.max(0, selectedUser.credits + amount);
    return newBalance;
  };

  const isAdjustDisabled = () => {
    if (!selectedUser) return true;
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                ClearMarket
              </Link>
              <Badge variant="outline" className="text-xs">Admin</Badge>
            </div>
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Credit Management</h1>
          <p className="text-muted-foreground">
            Search for users and manually adjust their credit balance. All changes are logged.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Search Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Find User
                </CardTitle>
                <CardDescription>
                  Search by email, full name, or anonymous ID (e.g., FieldRep#123)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Input
                    placeholder="Search users..."
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
                    {searchResults.map((u) => (
                      <div
                        key={u.id}
                        className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                          selectedUser?.id === u.id ? "bg-muted" : ""
                        }`}
                        onClick={() => selectUser(u)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">
                              {u.email}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {u.full_name || "No name"} {getAnonymousId(u) && `· ${getAnonymousId(u)}`}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {getRoleBadges(u)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground flex items-center gap-1">
                              <Coins className="h-3 w-3 text-secondary" />
                              {u.credits}
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
                    No users found matching "{searchQuery}"
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: User Credits Panel */}
          <div className="space-y-4">
            {!selectedUser ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Search and select a user to manage their credits
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* User Info Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-secondary" />
                          Credits for {getAnonymousId(selectedUser) || "User"}
                        </CardTitle>
                        <CardDescription>
                          {selectedUser.email} · {selectedUser.full_name || "No name"}
                        </CardDescription>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {getRoleBadges(selectedUser)}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={refreshSelectedUser}
                        title="Refresh"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-5xl font-bold text-foreground mb-2">
                      {selectedUser.credits}
                    </div>
                    <p className="text-sm text-muted-foreground">Current Balance</p>
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
                        placeholder="Why are you adjusting this user's credits?"
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
                            Balance will change from <strong>{selectedUser.credits}</strong> to{" "}
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
                          <div className="col-span-5">Action</div>
                          <div className="col-span-2 text-right">Amount</div>
                          <div className="col-span-2 text-right">Note</div>
                        </div>
                        {transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="grid grid-cols-12 gap-2 px-2 py-2 text-sm border-b border-border last:border-0 hover:bg-muted/30"
                          >
                            <div className="col-span-3 text-muted-foreground text-xs">
                              {format(new Date(tx.created_at), "MM/dd/yy HH:mm")}
                            </div>
                            <div className="col-span-5 text-foreground text-xs">
                              {getActionLabel(tx.action)}
                            </div>
                            <div className={`col-span-2 text-right font-semibold text-xs ${
                              tx.amount > 0 ? "text-green-600" : "text-orange-600"
                            }`}>
                              {tx.amount > 0 ? "+" : ""}{tx.amount}
                            </div>
                            <div className="col-span-2 text-right text-xs text-muted-foreground truncate" title={tx.metadata?.note || ""}>
                              {tx.metadata?.note ? "📝" : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCredits;
