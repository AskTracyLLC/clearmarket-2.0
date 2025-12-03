import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Search, Mail, UserX, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
  is_admin: boolean;
  account_status: string;
  deactivated_at: string | null;
  deactivated_reason: string | null;
  community_score: number;
  last_seen_at: string | null;
}

interface RepProfile {
  user_id: string;
  anonymous_id: string | null;
}

interface VendorProfile {
  user_id: string;
  anonymous_id: string | null;
}

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [repProfiles, setRepProfiles] = useState<Record<string, string>>({});
  const [vendorProfiles, setVendorProfiles] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; user: UserProfile | null }>({
    open: false,
    user: null,
  });
  const [deactivateReason, setDeactivateReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/signin");
      return;
    }

    checkAdminStatus();
  }, [user, authLoading, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_vendor_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin && !profile?.is_vendor_admin) {
      toast.error("Unauthorized", {
        description: "You don't have permission to access this page.",
      });
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    loadUsers();
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Load profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          full_name,
          is_fieldrep,
          is_vendor_admin,
          is_admin,
          account_status,
          deactivated_at,
          deactivated_reason,
          community_score,
          last_seen_at
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setUsers(profiles || []);

      // Load rep profiles for anonymous IDs
      const { data: reps } = await supabase
        .from("rep_profile")
        .select("user_id, anonymous_id");

      if (reps) {
        const repMap: Record<string, string> = {};
        reps.forEach((r: RepProfile) => {
          if (r.anonymous_id) repMap[r.user_id] = r.anonymous_id;
        });
        setRepProfiles(repMap);
      }

      // Load vendor profiles for anonymous IDs
      const { data: vendors } = await supabase
        .from("vendor_profile")
        .select("user_id, anonymous_id");

      if (vendors) {
        const vendorMap: Record<string, string> = {};
        vendors.forEach((v: VendorProfile) => {
          if (v.anonymous_id) vendorMap[v.user_id] = v.anonymous_id;
        });
        setVendorProfiles(vendorMap);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async (userProfile: UserProfile) => {
    setActionLoading(userProfile.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userProfile.email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;

      toast.success("Reset link sent", {
        description: "If this user has an active account, a reset link has been sent.",
      });
    } catch (error: any) {
      toast.error("Failed to send reset link", {
        description: error.message,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateDialog.user) return;

    setActionLoading(deactivateDialog.user.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          account_status: "deactivated",
          deactivated_at: new Date().toISOString(),
          deactivated_reason: deactivateReason || null,
        })
        .eq("id", deactivateDialog.user.id);

      if (error) throw error;

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === deactivateDialog.user!.id
            ? {
                ...u,
                account_status: "deactivated",
                deactivated_at: new Date().toISOString(),
                deactivated_reason: deactivateReason || null,
              }
            : u
        )
      );

      toast.success("Account deactivated", {
        description: "The user account has been deactivated.",
      });
    } catch (error: any) {
      toast.error("Failed to deactivate account", {
        description: error.message,
      });
    } finally {
      setActionLoading(null);
      setDeactivateDialog({ open: false, user: null });
      setDeactivateReason("");
    }
  };

  const handleReactivate = async (userProfile: UserProfile) => {
    setActionLoading(userProfile.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          account_status: "active",
          deactivated_at: null,
          deactivated_reason: null,
        })
        .eq("id", userProfile.id);

      if (error) throw error;

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userProfile.id
            ? {
                ...u,
                account_status: "active",
                deactivated_at: null,
                deactivated_reason: null,
              }
            : u
        )
      );

      toast.success("Account reactivated", {
        description: "The user account has been reactivated.",
      });
    } catch (error: any) {
      toast.error("Failed to reactivate account", {
        description: error.message,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getAnonymousId = (userProfile: UserProfile) => {
    if (repProfiles[userProfile.id]) return repProfiles[userProfile.id];
    if (vendorProfiles[userProfile.id]) return vendorProfiles[userProfile.id];
    return "—";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case "deactivated":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">Deactivated</Badge>;
      case "suspended":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const anonId = getAnonymousId(u).toLowerCase();
    return (
      u.email.toLowerCase().includes(term) ||
      anonId.includes(term) ||
      u.full_name?.toLowerCase().includes(term)
    );
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">Search, reset passwords, and manage account status.</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-5 w-5" />
            <span className="font-medium">{users.length} users</span>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or anonymous ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Anonymous ID</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Community</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{u.full_name || "—"}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{getAnonymousId(u)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.is_fieldrep && <Badge variant="secondary">Field Rep</Badge>}
                          {u.is_vendor_admin && <Badge variant="secondary">Vendor</Badge>}
                          {u.is_admin && <Badge variant="default">Admin</Badge>}
                          {!u.is_fieldrep && !u.is_vendor_admin && !u.is_admin && (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(u.account_status)}</TableCell>
                      <TableCell>
                        {u.last_seen_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(u.last_seen_at), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{u.community_score}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendResetLink(u)}
                            disabled={actionLoading === u.id}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Reset
                          </Button>
                          {u.account_status === "active" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300"
                              onClick={() => setDeactivateDialog({ open: true, user: u })}
                              disabled={actionLoading === u.id}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                              onClick={() => handleReactivate(u)}
                              disabled={actionLoading === u.id}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateDialog.open} onOpenChange={(open) => setDeactivateDialog({ open, user: open ? deactivateDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate account?</DialogTitle>
            <DialogDescription>
              This will prevent <strong>{deactivateDialog.user?.email}</strong> from accessing ClearMarket. 
              They will be signed out on next refresh, and their profile will not appear in searches. 
              You can reactivate later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Why is this account being deactivated?"
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialog({ open: false, user: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={actionLoading === deactivateDialog.user?.id}
            >
              {actionLoading === deactivateDialog.user?.id ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
