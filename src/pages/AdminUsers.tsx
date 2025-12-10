import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import {
  computeRepProfileCompleteness,
  computeVendorProfileCompleteness,
} from "@/lib/profileCompleteness";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Mail, UserX, UserCheck, Users, Eye, Gavel, AlertTriangle, SearchX, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { AdminMessageUserDialog } from "@/components/admin/AdminMessageUserDialog";
import { logAdminAction } from "@/lib/adminAudit";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
  is_admin: boolean;
  is_moderator: boolean;
  is_support: boolean;
  account_status: string;
  deactivated_at: string | null;
  deactivated_reason: string | null;
  community_score: number;
  last_seen_at: string | null;
  staff_anonymous_id: string | null;
}

interface RepProfile {
  user_id: string;
  anonymous_id: string | null;
}

interface VendorProfile {
  user_id: string;
  anonymous_id: string | null;
  company_name: string | null;
}

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [repProfiles, setRepProfiles] = useState<Record<string, string>>({});
  const [vendorProfiles, setVendorProfiles] = useState<Record<string, { anonymousId: string; companyName: string | null }>>({});
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [profileCompleteness, setProfileCompleteness] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; user: UserProfile | null }>({
    open: false,
    user: null,
  });
  const [deactivateReason, setDeactivateReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [profileDialog, setProfileDialog] = useState<{ open: boolean; userId: string | null }>({
    open: false,
    userId: null,
  });
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; user: UserProfile | null }>({
    open: false,
    user: null,
  });

  // Permission-based access control
  useEffect(() => {
    if (!permsLoading) {
      if (!permissions.canViewUsersAdmin) {
        toast.error("Access denied", {
          description: "You don't have permission to view this page.",
        });
        navigate("/dashboard");
      } else {
        setHasAccess(true);
      }
    }
  }, [permsLoading, permissions, navigate]);

  // Initialize search from URL param
  useEffect(() => {
    const userIdParam = searchParams.get("userId");
    if (userIdParam) {
      setSearchTerm(userIdParam);
      setDebouncedSearch(userIdParam);
    }
  }, [searchParams]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (authLoading || permsLoading) return;

    if (!user) {
      navigate("/signin");
      return;
    }

    if (hasAccess) {
      loadUsers();
    }
  }, [user, authLoading, permsLoading, hasAccess, navigate]);

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
          is_moderator,
          is_support,
          account_status,
          deactivated_at,
          deactivated_reason,
          community_score,
          last_seen_at,
          staff_anonymous_id
        `)
        .order("created_at", { ascending: false })
        .limit(500);

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

      // Load vendor profiles for anonymous IDs and company names
      const { data: vendors } = await supabase
        .from("vendor_profile")
        .select("user_id, anonymous_id, company_name");

      if (vendors) {
        const vendorMap: Record<string, { anonymousId: string; companyName: string | null }> = {};
        vendors.forEach((v: VendorProfile) => {
          vendorMap[v.user_id] = {
            anonymousId: v.anonymous_id || "",
            companyName: v.company_name,
          };
        });
        setVendorProfiles(vendorMap);
      }

      // Load report counts per user
      const { data: reports } = await supabase
        .from("user_reports")
        .select("reported_user_id");

      if (reports) {
        const counts: Record<string, number> = {};
        reports.forEach((r) => {
          counts[r.reported_user_id] = (counts[r.reported_user_id] || 0) + 1;
        });
        setReportCounts(counts);
      }

      // Compute profile completeness for each user
      const completenessMap: Record<string, number> = {};
      if (profiles) {
        await Promise.all(
          profiles.map(async (p) => {
            try {
              if (p.is_fieldrep) {
                const result = await computeRepProfileCompleteness(supabase, p.id);
                completenessMap[p.id] = result.percent;
              } else if (p.is_vendor_admin) {
                const result = await computeVendorProfileCompleteness(supabase, p.id);
                completenessMap[p.id] = result.percent;
              }
            } catch (err) {
              // Ignore errors for individual users
            }
          })
        );
      }
      setProfileCompleteness(completenessMap);
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
    if (!deactivateDialog.user || !user) return;

    setActionLoading(deactivateDialog.user.id);
    const targetUser = deactivateDialog.user;
    const prevStatus = targetUser.account_status;
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          account_status: "deactivated",
          deactivated_at: new Date().toISOString(),
          deactivated_reason: deactivateReason || null,
        })
        .eq("id", targetUser.id);

      if (error) throw error;

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? {
                ...u,
                account_status: "deactivated",
                deactivated_at: new Date().toISOString(),
                deactivated_reason: deactivateReason || null,
              }
            : u
        )
      );

      // Log admin action
      logAdminAction(user.id, {
        actionType: "user.deactivated",
        actionSummary: `Deactivated user ${targetUser.email || targetUser.full_name || getAnonymousId(targetUser)}`,
        targetUserId: targetUser.id,
        actionDetails: {
          previous_status: prevStatus,
          new_status: "deactivated",
          reason: deactivateReason || null,
        },
        sourcePage: "/admin/users",
      });

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
    if (!user) return;
    
    setActionLoading(userProfile.id);
    const prevStatus = userProfile.account_status;
    
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

      // Log admin action
      logAdminAction(user.id, {
        actionType: "user.reactivated",
        actionSummary: `Reactivated user ${userProfile.email || userProfile.full_name || getAnonymousId(userProfile)}`,
        targetUserId: userProfile.id,
        actionDetails: {
          previous_status: prevStatus,
          new_status: "active",
        },
        sourcePage: "/admin/users",
      });

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
    // Staff get their staff_anonymous_id (Admin#1, etc.)
    if (userProfile.staff_anonymous_id) return userProfile.staff_anonymous_id;
    if (repProfiles[userProfile.id]) return repProfiles[userProfile.id];
    if (vendorProfiles[userProfile.id]?.anonymousId) return vendorProfiles[userProfile.id].anonymousId;
    return "—";
  };

  const getCompanyName = (userProfile: UserProfile) => {
    return vendorProfiles[userProfile.id]?.companyName || null;
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

  const filteredUsers = useMemo(() => {
    let result = users.filter((u) => {
      // Role filter
      if (roleFilter === "fieldreps" && !u.is_fieldrep) return false;
      if (roleFilter === "vendors" && !u.is_vendor_admin) return false;
      if (roleFilter === "admins" && !u.is_admin) return false;

      // Status filter
      if (statusFilter === "active" && u.account_status !== "active") return false;
      if (statusFilter === "deactivated" && u.account_status !== "deactivated") return false;

      // Search filter
      if (!debouncedSearch) return true;
      const term = debouncedSearch.toLowerCase();
      const anonId = getAnonymousId(u).toLowerCase();
      const companyName = getCompanyName(u)?.toLowerCase() || "";
      return (
        u.email.toLowerCase().includes(term) ||
        anonId.includes(term) ||
        u.full_name?.toLowerCase().includes(term) ||
        companyName.includes(term) ||
        u.id.toLowerCase().includes(term)
      );
    });

    // Sort
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";

        switch (sortColumn) {
          case "user":
            aVal = (a.full_name || a.email).toLowerCase();
            bVal = (b.full_name || b.email).toLowerCase();
            break;
          case "anonymous_id":
            aVal = getAnonymousId(a).toLowerCase();
            bVal = getAnonymousId(b).toLowerCase();
            break;
          case "status":
            aVal = a.account_status;
            bVal = b.account_status;
            break;
          case "profile":
            aVal = profileCompleteness[a.id] ?? -1;
            bVal = profileCompleteness[b.id] ?? -1;
            break;
          case "last_active":
            aVal = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
            bVal = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
            break;
          case "community":
            aVal = a.community_score;
            bVal = b.community_score;
            break;
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, debouncedSearch, roleFilter, statusFilter, repProfiles, vendorProfiles, sortColumn, sortDirection, profileCompleteness]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const handleViewInModeration = (userId: string) => {
    navigate(`/admin/moderation?targetUserId=${userId}`);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setSearchParams({});
  };

  const hasActiveFilters = searchTerm !== "" || roleFilter !== "all" || statusFilter !== "all";

  if (authLoading || permsLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">Search, reset passwords, and manage account status.</p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-5 w-5" />
            <span className="font-medium">{users.length} users</span>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, anonymous ID, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="fieldreps">Field Reps</SelectItem>
                  <SelectItem value="vendors">Vendors</SelectItem>
                  <SelectItem value="admins">Admins</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
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
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("user")}
                    >
                      <div className="flex items-center">
                        User
                        <SortIcon column="user" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("anonymous_id")}
                    >
                      <div className="flex items-center">
                        Anonymous ID
                        <SortIcon column="anonymous_id" />
                      </div>
                    </TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon column="status" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("profile")}
                    >
                      <div className="flex items-center">
                        Profile
                        <SortIcon column="profile" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("last_active")}
                    >
                      <div className="flex items-center">
                        Last Active
                        <SortIcon column="last_active" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("community")}
                    >
                      <div className="flex items-center">
                        Community
                        <SortIcon column="community" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-48">
                        <div className="flex flex-col items-center justify-center text-center py-8">
                          {users.length === 0 ? (
                            <>
                              <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
                              <p className="font-medium text-foreground">No users found yet</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Once people sign up and complete onboarding, they'll appear here.
                              </p>
                            </>
                          ) : (
                            <>
                              <SearchX className="h-10 w-10 text-muted-foreground/50 mb-3" />
                              <p className="font-medium text-foreground">No users match your filters</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Try clearing your search or adjusting the filters above.
                              </p>
                              {hasActiveFilters && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleClearFilters}
                                  className="mt-4"
                                >
                                  Clear filters
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((userProfile) => (
                      <TableRow key={userProfile.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{userProfile.full_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {getAnonymousId(userProfile)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userProfile.is_fieldrep && (
                              <Badge variant="secondary" className="text-xs">Rep</Badge>
                            )}
                            {userProfile.is_vendor_admin && (
                              <Badge variant="secondary" className="text-xs">Vendor</Badge>
                            )}
                            {userProfile.is_admin && (
                              <Badge variant="default" className="text-xs">Admin</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(userProfile.account_status)}</TableCell>
                        <TableCell>
                          {(userProfile.is_fieldrep || userProfile.is_vendor_admin) ? (
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${profileCompleteness[userProfile.id] ?? 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {profileCompleteness[userProfile.id] ?? 0}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {userProfile.last_seen_at
                            ? format(new Date(userProfile.last_seen_at), "MMM d, yyyy")
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{userProfile.community_score}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setProfileDialog({ open: true, userId: userProfile.id })}
                              title="View Profile"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {reportCounts[userProfile.id] > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewInModeration(userProfile.id)}
                                title="View in Moderation"
                                className="gap-1"
                              >
                                <Gavel className="h-4 w-4" />
                                <Badge variant="destructive" className="text-xs">
                                  {reportCounts[userProfile.id]}
                                </Badge>
                              </Button>
                            )}
                            {permissions.canEditUsersAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setMessageDialog({ open: true, user: userProfile })}
                                  disabled={actionLoading === userProfile.id}
                                  title="Message user"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSendResetLink(userProfile)}
                                  disabled={actionLoading === userProfile.id}
                                  title="Send password reset"
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                                {userProfile.account_status === "active" ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeactivateDialog({ open: true, user: userProfile })}
                                    disabled={actionLoading === userProfile.id}
                                    title="Deactivate account"
                                    className="text-orange-600 hover:text-orange-700"
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleReactivate(userProfile)}
                                    disabled={actionLoading === userProfile.id}
                                    title="Reactivate account"
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <UserCheck className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deactivate Dialog */}
      <Dialog
        open={deactivateDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateDialog({ open: false, user: null });
            setDeactivateReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Deactivate Account
            </DialogTitle>
            <DialogDescription>
              This will prevent {deactivateDialog.user?.email} from logging in. Their data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter a reason for deactivation..."
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                className="mt-2"
              />
            </div>
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
              {actionLoading === deactivateDialog.user?.id ? "Deactivating..." : "Deactivate Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      {profileDialog.open && profileDialog.userId && (
        <PublicProfileDialog
          open={profileDialog.open}
          onOpenChange={(open) => setProfileDialog({ open, userId: open ? profileDialog.userId : null })}
          targetUserId={profileDialog.userId}
        />
      )}

      {/* Message User Dialog */}
      {messageDialog.open && messageDialog.user && user && (
        <AdminMessageUserDialog
          open={messageDialog.open}
          onOpenChange={(open) => setMessageDialog({ open, user: open ? messageDialog.user : null })}
          targetUserId={messageDialog.user.id}
          targetUserDisplay={messageDialog.user.email || getAnonymousId(messageDialog.user)}
          adminUserId={user.id}
        />
      )}
    </AuthenticatedLayout>
  );
}
