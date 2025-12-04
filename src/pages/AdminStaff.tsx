import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ArrowLeft, Users, Eye, ExternalLink, Crown, UserPlus, ShieldCheck, MessageSquare, Gavel } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PublicProfileDialog } from "@/components/PublicProfileDialog";

interface StaffUser {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_moderator: boolean;
  is_support: boolean;
  is_super_admin: boolean;
  account_status: string;
  last_seen_at: string | null;
}

export default function AdminStaff() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
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
    is_admin: true,
    is_moderator: false,
    is_support: false,
  });
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/signin");
      return;
    }
    checkAccess();
  }, [user, authLoading, navigate]);

  const checkAccess = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      toast.error("Unauthorized");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    setIsSuperAdmin(profile.is_super_admin || false);
    loadStaffUsers();
  };

  const loadStaffUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, is_admin, is_moderator, is_support, is_super_admin, account_status, last_seen_at")
        .or("is_admin.eq.true,is_moderator.eq.true,is_support.eq.true")
        .order("is_super_admin", { ascending: false })
        .order("is_admin", { ascending: false })
        .order("full_name", { ascending: true });

      if (error) throw error;
      setStaffUsers(data || []);
    } catch (error) {
      console.error("Error loading staff:", error);
      toast.error("Failed to load staff users");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (staffId: string, role: "is_admin" | "is_moderator" | "is_support", currentValue: boolean) => {
    if (!isSuperAdmin) return;
    
    setUpdatingRole(`${staffId}-${role}`);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [role]: !currentValue })
        .eq("id", staffId);

      if (error) throw error;

      setStaffUsers(prev =>
        prev.map(u =>
          u.id === staffId ? { ...u, [role]: !currentValue } : u
        )
      );
      toast.success("Role updated");
    } catch (error: any) {
      toast.error("Failed to update role", { description: error.message });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleCreateStaff = async () => {
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
          roles: {
            is_admin: newStaff.is_admin,
            is_moderator: newStaff.is_moderator,
            is_support: newStaff.is_support,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create staff");
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || "Failed to create staff");
      }

      toast.success(`Staff invite sent to ${newStaff.email}`);
      setCreateDialogOpen(false);
      setNewStaff({ email: "", full_name: "", is_admin: true, is_moderator: false, is_support: false });
      loadStaffUsers();
    } catch (error: any) {
      toast.error("Failed to create staff", { description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
    }
    return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">{status}</Badge>;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Staff & Roles</h1>
            <p className="text-muted-foreground">Manage admin, moderator, and support staff</p>
          </div>
          {isSuperAdmin && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Staff Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Staff Account</DialogTitle>
                  <DialogDescription>
                    An invitation email will be sent with a link to set their password and log in.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="staff@example.com"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      placeholder="Jane Doe"
                      value={newStaff.full_name}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Roles</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="role-admin"
                          checked={newStaff.is_admin}
                          onCheckedChange={(checked) => setNewStaff(prev => ({ ...prev, is_admin: !!checked }))}
                        />
                        <Label htmlFor="role-admin" className="text-sm font-normal cursor-pointer">
                          Admin – Full access to admin pages
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="role-moderator"
                          checked={newStaff.is_moderator}
                          onCheckedChange={(checked) => setNewStaff(prev => ({ ...prev, is_moderator: !!checked }))}
                        />
                        <Label htmlFor="role-moderator" className="text-sm font-normal cursor-pointer">
                          Moderator – Access to moderation pages
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="role-support"
                          checked={newStaff.is_support}
                          onCheckedChange={(checked) => setNewStaff(prev => ({ ...prev, is_support: !!checked }))}
                        />
                        <Label htmlFor="role-support" className="text-sm font-normal cursor-pointer">
                          Support – Access to support tickets
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateStaff} disabled={creating}>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
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
                      <TableCell className="text-muted-foreground">{staff.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isSuperAdmin && !staff.is_super_admin ? (
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
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(staff.account_status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {staff.last_seen_at
                          ? format(new Date(staff.last_seen_at), "MMM d, yyyy")
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Profile Dialog */}
      {profileDialog.open && profileDialog.userId && (
        <PublicProfileDialog
          open={profileDialog.open}
          onOpenChange={(open) => setProfileDialog({ open, userId: open ? profileDialog.userId : null })}
          targetUserId={profileDialog.userId}
        />
      )}
    </div>
  );
}
