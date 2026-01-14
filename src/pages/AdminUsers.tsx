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
import { Search, Mail, UserX, UserCheck, Users, Eye, Gavel, AlertTriangle, SearchX, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { AdminMessageUserDialog } from "@/components/admin/AdminMessageUserDialog";
import { logAdminAction } from "@/lib/adminAudit";
import { ColumnChooser } from "@/components/ColumnChooser";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/useColumnVisibility";

// Column definitions for Admin User Management table
const ADMIN_USERS_COLUMNS: ColumnDefinition[] = [
  { id: "user", label: "User", description: "User name and email", required: true },
  { id: "anonId", label: "Anon ID", description: "Anonymous identifier (e.g., FieldRep#1)" },
  { id: "roles", label: "Roles", description: "User role badges (Rep, Vendor, Admin)" },
  { id: "profile", label: "Profile", description: "Profile completion percentage" },
  { id: "lastActive", label: "Last active", description: "When the user was last seen" },
  { id: "community", label: "Community", description: "Community score based on activity" },
  { id: "connections", label: "Connections", description: "Number of active vendor-rep connections" },
  { id: "trust", label: "Trust", description: "Average review rating" },
  { id: "actions", label: "Actions", description: "Available actions", required: true },
];

const ADMIN_USERS_DEFAULT_COLUMNS = ["user", "anonId", "roles", "profile", "lastActive", "community", "connections", "trust", "actions"];

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
  is_vendor_staff: boolean;
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
  const [vendorStaffCodes, setVendorStaffCodes] = useState<Record<string, string>>({});
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [profileCompleteness, setProfileCompleteness] = useState<Record<string, number>>({});
  const [trustScores, setTrustScores] = useState<Record<string, { score: number; count: number }>>({});
  const [connectionCounts, setConnectionCounts] = useState<Record<string, number>>({});
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
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserProfile | null }>({
    open: false,
    user: null,
  });
  const [deleteReason, setDeleteReason] = useState("");

  // Column visibility
  const {
    visibleColumns,
    isColumnVisible,
    savePreferences,
    resetToDefaults,
    isSaving: colSaving,
  } = useColumnVisibility({
    tableKey: "admin_user_management",
    columns: ADMIN_USERS_COLUMNS,
    defaultVisibleColumns: ADMIN_USERS_DEFAULT_COLUMNS,
  });
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
          is_vendor_staff,
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

      // Load vendor staff codes for staff member anon IDs
      const { data: vendorStaff } = await supabase
        .from("vendor_staff")
        .select("staff_user_id, staff_code")
        .not("staff_user_id", "is", null);

      if (vendorStaff) {
        const staffCodeMap: Record<string, string> = {};
        vendorStaff.forEach((vs: { staff_user_id: string | null; staff_code: string | null }) => {
          if (vs.staff_user_id && vs.staff_code) {
            staffCodeMap[vs.staff_user_id] = vs.staff_code;
          }
        });
        setVendorStaffCodes(staffCodeMap);
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

      // Load trust scores from reviews
      const { data: reviews } = await supabase
        .from("reviews")
        .select("reviewee_id, rating_on_time, rating_quality, rating_communication")
        .eq("status", "published");

      if (reviews) {
        const trustMap: Record<string, { totalScore: number; count: number }> = {};
        reviews.forEach((r) => {
          if (!trustMap[r.reviewee_id]) {
            trustMap[r.reviewee_id] = { totalScore: 0, count: 0 };
          }
          const ratings = [r.rating_on_time, r.rating_quality, r.rating_communication].filter(
            (rating): rating is number => rating !== null
          );
          if (ratings.length > 0) {
            const avg = ratings.reduce((sum, val) => sum + val, 0) / ratings.length;
            trustMap[r.reviewee_id].totalScore += avg;
            trustMap[r.reviewee_id].count += 1;
          }
        });
        
        const finalTrustScores: Record<string, { score: number; count: number }> = {};
        Object.entries(trustMap).forEach(([userId, data]) => {
          if (data.count > 0) {
            finalTrustScores[userId] = {
              score: data.totalScore / data.count,
              count: data.count,
            };
          }
        });
        setTrustScores(finalTrustScores);
      }

      // Load connection counts from rep_interest (status = 'connected')
      const { data: connections } = await supabase
        .from("rep_interest")
        .select("rep_id, post_id, status, seeking_coverage_posts!inner(vendor_id)")
        .eq("status", "connected");

      if (connections) {
        const connectionMap: Record<string, number> = {};
        connections.forEach((c: any) => {
          // Count for the rep
          const repUserId = c.rep_id;
          connectionMap[repUserId] = (connectionMap[repUserId] || 0) + 1;
          
          // Count for the vendor
          const vendorUserId = c.seeking_coverage_posts?.vendor_id;
          if (vendorUserId) {
            connectionMap[vendorUserId] = (connectionMap[vendorUserId] || 0) + 1;
          }
        });
        setConnectionCounts(connectionMap);
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

  const handleDeleteUser = async () => {
    if (!deleteDialog.user || !user) return;

    setActionLoading(deleteDialog.user.id);
    const targetUser = deleteDialog.user;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("No session found");
      }

      const response = await supabase.functions.invoke("admin-delete-user", {
        body: {
          target_user_id: targetUser.id,
          reason: deleteReason || null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to delete user");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Remove user from local state
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));

      toast.success("User deleted", {
        description: `${targetUser.email || getAnonymousId(targetUser)} has been permanently deleted.`,
      });
    } catch (error: any) {
      console.error("Delete user error:", error);
      toast.error("Failed to delete user", {
        description: error.message,
      });
    } finally {
      setActionLoading(null);
      setDeleteDialog({ open: false, user: null });
      setDeleteReason("");
    }
  };

  const getAnonymousId = (userProfile: UserProfile) => {
    // Staff get their staff_anonymous_id (MBFS_JP, Admin#1, etc.)
    if (userProfile.staff_anonymous_id) return userProfile.staff_anonymous_id;
    // Vendor staff fallback to staff_code from vendor_staff table
    if (vendorStaffCodes[userProfile.id]) return vendorStaffCodes[userProfile.id];
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
      if (roleFilter === "vendor_staff" && !u.is_vendor_staff) return false;
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
          case "connections":
            aVal = connectionCounts[a.id] ?? 0;
            bVal = connectionCounts[b.id] ?? 0;
            break;
          case "trust_score":
            aVal = trustScores[a.id]?.score ?? 0;
            bVal = trustScores[b.id]?.score ?? 0;
            break;
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, debouncedSearch, roleFilter, statusFilter, repProfiles, vendorProfiles, vendorStaffCodes, sortColumn, sortDirection, profileCompleteness, connectionCounts, trustScores]);

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
    <>
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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="fieldreps">Field Reps</SelectItem>
                  <SelectItem value="vendors">Vendors</SelectItem>
                  <SelectItem value="vendor_staff">Vendor Staff</SelectItem>
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <ColumnChooser
              columns={ADMIN_USERS_COLUMNS}
              visibleColumns={visibleColumns}
              onSave={savePreferences}
              onReset={resetToDefaults}
              isSaving={colSaving}
            />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isColumnVisible("user") && (
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("user")}
                      >
                        <div className="flex items-center">
                          User
                          <SortIcon column="user" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible("anonId") && (
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("anonymous_id")}
                      >
                        <div className="flex items-center">
                          Anon ID
                          <SortIcon column="anonymous_id" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible("roles") && (
                      <TableHead>Roles</TableHead>
                    )}
                    {isColumnVisible("profile") && (
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("profile")}
                      >
                        <div className="flex items-center">
                          Profile
                          <SortIcon column="profile" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible("lastActive") && (
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("last_active")}
                      >
                        <div className="flex items-center">
                          Last active
                          <SortIcon column="last_active" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible("community") && (
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("community")}
                      >
                        <div className="flex items-center">
                          Community
                          <SortIcon column="community" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible("connections") && (
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("connections")}
                      >
                        <div className="flex items-center justify-center">
                          Connections
                          <SortIcon column="connections" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible("trust") && (
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("trust_score")}
                      >
                        <div className="flex items-center justify-center">
                          Trust
                          <SortIcon column="trust_score" />
                        </div>
                      </TableHead>
                    )}
                    {isColumnVisible("actions") && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length} className="h-48">
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
                        {isColumnVisible("user") && (
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <span
                                className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                                  userProfile.account_status === "active"
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                }`}
                                title={userProfile.account_status === "active" ? "Active" : userProfile.account_status}
                              />
                              <div>
                                <button
                                  onClick={() => setProfileDialog({ open: true, userId: userProfile.id })}
                                  className="font-medium text-left hover:underline hover:text-primary transition-colors"
                                >
                                  {userProfile.full_name || "—"}
                                </button>
                                <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                              </div>
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible("anonId") && (
                          <TableCell className="font-mono text-sm">
                            {getAnonymousId(userProfile)}
                          </TableCell>
                        )}
                        {isColumnVisible("roles") && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {userProfile.is_fieldrep && (
                                <Badge variant="secondary" className="text-xs">Rep</Badge>
                              )}
                              {userProfile.is_vendor_admin && (
                                <Badge variant="secondary" className="text-xs">Vendor</Badge>
                              )}
                              {userProfile.is_vendor_staff && (
                                <Badge variant="secondary" className="text-xs">Vendor Staff</Badge>
                              )}
                              {userProfile.is_admin && (
                                <Badge variant="default" className="text-xs">Admin</Badge>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {isColumnVisible("profile") && (
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
                        )}
                        {isColumnVisible("lastActive") && (
                          <TableCell className="text-sm text-muted-foreground">
                            {userProfile.last_seen_at
                              ? format(new Date(userProfile.last_seen_at), "MMM d, yyyy")
                              : "Never"}
                          </TableCell>
                        )}
                        {isColumnVisible("community") && (
                          <TableCell className="text-center">
                            <span className="font-medium">{userProfile.community_score}</span>
                          </TableCell>
                        )}
                        {isColumnVisible("connections") && (
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-medium cursor-help">
                                    {connectionCounts[userProfile.id] ?? 0}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Active connections with other ClearMarket users</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        )}
                        {isColumnVisible("trust") && (
                          <TableCell className="text-center">
                            {trustScores[userProfile.id] ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-medium">
                                  {trustScores[userProfile.id].score.toFixed(1)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({trustScores[userProfile.id].count})
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        )}
                        {isColumnVisible("actions") && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      // Navigate to the user's dashboard as mimic mode
                                      const targetPath = userProfile.is_fieldrep ? "/dashboard" : userProfile.is_vendor_admin ? "/dashboard" : "/dashboard";
                                      navigate(`${targetPath}?mimic=${userProfile.id}`);
                                    }}
                                    title="View as this user"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Mimic user</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
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
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={actionLoading === userProfile.id}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setMessageDialog({ open: true, user: userProfile })}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Message user
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSendResetLink(userProfile)}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send password reset
                                  </DropdownMenuItem>
                                  {userProfile.account_status === "active" ? (
                                    <DropdownMenuItem
                                      onClick={() => setDeactivateDialog({ open: true, user: userProfile })}
                                    >
                                      <UserX className="h-4 w-4 mr-2" />
                                      Deactivate account
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleReactivate(userProfile)}
                                    >
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Reactivate account
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => setDeleteDialog({ open: true, user: userProfile })}
                                    disabled={userProfile.is_admin}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete user
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            </div>
                          </TableCell>
                        )}
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

      {/* Delete User Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({ open: false, user: null });
            setDeleteReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete User Permanently
            </DialogTitle>
            <DialogDescription>
              This will permanently delete {deleteDialog.user?.email || "this user"} and all their data. 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-sm text-red-600 font-medium">Warning: This is a permanent action</p>
              <p className="text-sm text-muted-foreground mt-1">
                All profile data, messages, reviews, and other associated records will be deleted.
              </p>
            </div>
            <div>
              <Label htmlFor="delete-reason">Reason (optional)</Label>
              <Textarea
                id="delete-reason"
                placeholder="Enter a reason for deletion..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={actionLoading === deleteDialog.user?.id}
            >
              {actionLoading === deleteDialog.user?.id ? "Deleting..." : "Delete User Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
