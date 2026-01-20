import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users, Eye, ExternalLink, Crown, UserPlus, ShieldCheck, MessageSquare, Gavel, Mail, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";
import { logAdminAction } from "@/lib/adminAudit";

interface StaffUser {
  id: string;
  full_name: string | null;
  is_admin: boolean;
  is_moderator: boolean;
  is_support: boolean;
  is_super_admin: boolean;
  account_status: string;
  last_seen_at: string | null;
  staff_role: string | null;
  staff_invited_at: string | null;
  staff_invite_sent_at: string | null;
  staff_invite_note: string | null;
  staff_anonymous_id: string | null;
}

export default function AdminStaff() {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions, isSuperAdmin } = useStaffPermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [profileDialog, setProfileDialog] = useState<{ open: boolean; userId: string | null }>({
    open: false,
    userId: null,
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newStaff, setNewStaff] = useState({
    email: "",
    full_name: "",
    role: "admin" as "admin" | "moderator" | "support",
    note: "",
  });
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  // Permission-based access control
  useEffect(() => {
    if (!permsLoading) {
      if (!permissions.canViewStaffAdmin) {
        toast.error("Access denied", {
          description: "You don't have permission to view this page.",
        });
        navigate("/dashboard");
      } else {
        setHasAccess(true);
      }
    }
  }, [permsLoading, permissions, navigate]);

  useEffect(() => {
    if (authLoading || permsLoading) return;
    if (!user) {
      navigate("/signin");
      return;
    }
    if (hasAccess) {
      loadStaffUsers();
    }
  }, [user, authLoading, permsLoading, hasAccess, navigate]);

  const loadStaffUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, is_admin, is_moderator, is_support, is_super_admin, account_status, last_seen_at, staff_role, staff_invited_at, staff_invite_sent_at, staff_invite_note, staff_anonymous_id")
        .or("is_admin.eq.true,is_moderator.eq.true,is_support.eq.true")
        .order("is_super_admin", { ascending: false })
        .order("is_admin", { ascending: false })
        .order("full_name", { ascending: true });

      if (error) throw error;
      setStaffUsers((data as StaffUser[]) || []);
    } catch (error) {
      console.error("Error loading staff:", error);
      toast.error("Failed to load staff users");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (staffId: string, role: "is_admin" | "is_moderator" | "is_support", currentValue: boolean) => {
    if (!permissions.canEditStaffAdmin) {
      toast.error("Permission denied", {
        description: "You don't have permission to change staff roles.",
      });
      return;
    }
    
    setUpdatingRole(`${staffId}-${role}`);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [role]: !currentValue })
        .eq("id", staffId);

      if (error) throw error;

      // Get staff info for logging
      const staffUser = staffUsers.find(s => s.id === staffId);

      setStaffUsers(prev =>
        prev.map(u =>
          u.id === staffId ? { ...u, [role]: !currentValue } : u
        )
      );

      // Log admin action
      if (user && staffUser) {
        const roleName = role.replace("is_", "");
        logAdminAction(user.id, {
          actionType: "staff.role_changed",
          actionSummary: `${!currentValue ? "Added" : "Removed"} ${roleName} role for ${staffUser.full_name || staffUser.staff_anonymous_id || "staff"}`,
          targetUserId: staffId,
          actionDetails: {
            role: roleName,
            previous_value: currentValue,
            new_value: !currentValue,
          },
          sourcePage: "/admin/staff",
        });
      }

      toast.success("Role updated");
    } catch (error: any) {
      toast.error("Failed to update role", { description: error.message });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleCreateStaff = async () => {
    if (!permissions.canEditStaffAdmin) {
      toast.error("Permission denied", {
        description: "You don't have permission to create staff accounts.",
      });
      return;
    }

    if (!newStaff.email || !newStaff.full_name) {
      toast.error("Email and full name are required");
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await supabase.functions.invoke("create-staff-user", {
        body: {
          email: newStaff.email,
          full_name: newStaff.full_name,
          role: newStaff.role,
          note: newStaff.note || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create staff");
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || "Failed to create staff");
      }

      // Log admin action
      if (user) {
        logAdminAction(user.id, {
          actionType: "staff.invited",
          actionSummary: `Invited ${newStaff.email} as ${newStaff.role}`,
          targetUserId: data.user_id,
          actionDetails: {
            role: newStaff.role,
            note: newStaff.note || null,
          },
          sourcePage: "/admin/staff",
        });
      }

      toast.success(`Staff invite sent to ${newStaff.email}`);
      setCreateDialogOpen(false);
      setNewStaff({ email: "", full_name: "", role: "admin", note: "" });
      loadStaffUsers();
    } catch (error: any) {
      toast.error("Failed to create staff", { description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const handleResendInvite = async (staff: StaffUser) => {
    if (!permissions.canEditStaffAdmin) {
      toast.error("Permission denied", {
        description: "You don't have permission to resend invites.",
      });
      return;
    }

    setResendingInvite(staff.id);
    try {
      // Note: Staff invite email is stored securely - fetch from profiles_private if needed
      const displayName = staff.full_name || staff.staff_anonymous_id || "staff";
      
      toast.error("Cannot resend invite", {
        description: "Email addresses are no longer directly accessible. Please use the backend to resend invites.",
      });

      // Resend invite functionality disabled - email no longer accessible
      return;
    } catch (error: any) {
      toast.error("Failed to resend invite", { description: error.message });
    } finally {
      setResendingInvite(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
    }
    return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">{status}</Badge>;
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "admin":
        return <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" />Admin</Badge>;
      case "moderator":
        return <Badge variant="secondary" className="gap-1"><Gavel className="h-3 w-3" />Moderator</Badge>;
      case "support":
        return <Badge variant="secondary" className="gap-1"><MessageSquare className="h-3 w-3" />Support</Badge>;
      default:
        return null;
    }
  };

  if (authLoading || permsLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  return (
    <>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Staff & Roles</h1>
            <p className="text-muted-foreground">Manage admin, moderator, and support staff</p>
          </div>
          {permissions.canEditStaffAdmin && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite New Staff
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite New Staff</DialogTitle>
                  <DialogDescription>
                    A welcome email will be sent with a link to set their password and log in.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="staff@example.com"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      placeholder="Jane Doe"
                      value={newStaff.full_name}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Staff Role *</Label>
                    <RadioGroup
                      value={newStaff.role}
                      onValueChange={(value) => setNewStaff(prev => ({ ...prev, role: value as "admin" | "moderator" | "support" }))}
                      className="space-y-2"
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value="admin" id="role-admin" className="mt-1" />
                        <div>
                          <Label htmlFor="role-admin" className="font-medium cursor-pointer">Admin</Label>
                          <p className="text-xs text-muted-foreground">Full access to all admin features</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value="moderator" id="role-moderator" className="mt-1" />
                        <div>
                          <Label htmlFor="role-moderator" className="font-medium cursor-pointer">Moderator</Label>
                          <p className="text-xs text-muted-foreground">Access to moderation and trust & safety</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value="support" id="role-support" className="mt-1" />
                        <div>
                          <Label htmlFor="role-support" className="font-medium cursor-pointer">Support</Label>
                          <p className="text-xs text-muted-foreground">Access to support tickets and help center</p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note">Internal Note (optional)</Label>
                    <Textarea
                      id="note"
                      placeholder="What will they be responsible for?"
                      value={newStaff.note}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, note: e.target.value }))}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">Only visible to other admins</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateStaff} disabled={creating}>
                    <Mail className="h-4 w-4 mr-2" />
                    {creating ? "Sending invite..." : "Send Invite"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Staff Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Members
            </CardTitle>
            <CardDescription>
              {staffUsers.length} staff member{staffUsers.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staffUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="font-medium">No staff members yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Once you invite admins, moderators, or support users, they'll show up here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Last Invite Sent</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffUsers.map((staff) => (
                      <TableRow key={staff.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {staff.full_name || "—"}
                            {staff.is_super_admin && (
                              <span title="Super Admin">
                                <Crown className="h-4 w-4 text-yellow-500" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{staff.staff_anonymous_id || staff.full_name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {permissions.canEditStaffAdmin && !staff.is_super_admin ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <Switch
                                    checked={staff.is_admin}
                                    onCheckedChange={() => handleToggleRole(staff.id, "is_admin", staff.is_admin)}
                                    disabled={updatingRole === `${staff.id}-is_admin`}
                                    className="scale-75"
                                  />
                                  <span className="text-xs">Admin</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Switch
                                    checked={staff.is_moderator}
                                    onCheckedChange={() => handleToggleRole(staff.id, "is_moderator", staff.is_moderator)}
                                    disabled={updatingRole === `${staff.id}-is_moderator`}
                                    className="scale-75"
                                  />
                                  <span className="text-xs">Mod</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Switch
                                    checked={staff.is_support}
                                    onCheckedChange={() => handleToggleRole(staff.id, "is_support", staff.is_support)}
                                    disabled={updatingRole === `${staff.id}-is_support`}
                                    className="scale-75"
                                  />
                                  <span className="text-xs">Support</span>
                                </div>
                              </>
                            ) : (
                              <>
                                {staff.staff_role ? (
                                  getRoleBadge(staff.staff_role)
                                ) : (
                                  <>
                                    {staff.is_admin && (
                                      <Badge variant="secondary" className="gap-1">
                                        <ShieldCheck className="h-3 w-3" />
                                        Admin
                                      </Badge>
                                    )}
                                    {staff.is_moderator && (
                                      <Badge variant="secondary" className="gap-1">
                                        <Gavel className="h-3 w-3" />
                                        Moderator
                                      </Badge>
                                    )}
                                    {staff.is_support && (
                                      <Badge variant="secondary" className="gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Support
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(staff.account_status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {staff.staff_invited_at
                            ? format(new Date(staff.staff_invited_at), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {staff.staff_invite_sent_at
                            ? format(new Date(staff.staff_invite_sent_at), "MMM d, yyyy h:mm a")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {staff.staff_invite_note ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                                    <Info className="h-3.5 w-3.5" />
                                    <span className="text-xs max-w-[100px] truncate">
                                      {staff.staff_invite_note}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>{staff.staff_invite_note}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {permissions.canEditStaffAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResendInvite(staff)}
                                disabled={resendingInvite === staff.id}
                                title="Resend Invite Email"
                              >
                                {resendingInvite === staff.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setProfileDialog({ open: true, userId: staff.id })}
                              title="View Profile"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/admin/users?userId=${staff.id}`)}
                              title="View in Users Admin"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Profile Dialog */}
      <PublicProfileDialog
        open={profileDialog.open}
        onOpenChange={(open) => !open && setProfileDialog({ open: false, userId: null })}
        targetUserId={profileDialog.userId || ""}
      />
    </>
  );
}
