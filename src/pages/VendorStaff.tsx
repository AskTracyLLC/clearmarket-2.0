import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Users, AlertCircle, Mail, ShieldCheck, UserX, MoreHorizontal, UserCog, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface VendorStaffMember {
  id: string;
  staff_code: string | null;
  staff_user_id: string | null;
  invited_name: string;
  invited_email: string;
  role: "owner" | "admin" | "staff";
  status: "invited" | "active" | "disabled";
  invited_at: string;
  accepted_at: string | null;
  disabled_at: string | null;
}

// Helper to log staff actions to audit log
async function logStaffAction(
  vendorId: string,
  actionType: string,
  targetStaffId: string,
  details: Record<string, string> = {}
) {
  try {
    await supabase.rpc("log_vendor_staff_action", {
      p_vendor_id: vendorId,
      p_action_type: actionType,
      p_target_staff_id: targetStaffId,
      p_details: details,
    });
  } catch (err) {
    console.error("Failed to log staff action:", err);
  }
}

interface VendorProfile {
  id: string;
  vendor_verification_status: string | null;
  vendor_public_code: string | null;
}

export default function VendorStaff() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [staffMembers, setStaffMembers] = useState<VendorStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  
  // Invite form state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");

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
    try {
      // Load vendor profile
      const { data: vp, error: vpError } = await supabase
        .from("vendor_profile")
        .select("id, vendor_verification_status, vendor_public_code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vpError) throw vpError;
      
      if (!vp) {
        toast({
          title: "Access Denied",
          description: "Vendor profile not found.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      
      setVendorProfile(vp);

      // Load staff members if vendor has a profile
      if (vp.id) {
        const { data: staff, error: staffError } = await supabase
          .from("vendor_staff")
          .select("*")
          .eq("vendor_id", vp.id)
          .order("invited_at", { ascending: false });

        if (staffError) throw staffError;
        setStaffMembers((staff || []) as VendorStaffMember[]);
      }
    } catch (error: any) {
      console.error("Error loading staff data:", error);
      toast({
        title: "Error",
        description: "Failed to load staff information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteStaff = async () => {
    if (!vendorProfile || !user) return;
    
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and email are required.",
        variant: "destructive",
      });
      return;
    }

    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-vendor-staff", {
        body: {
          vendorProfileId: vendorProfile.id,
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: inviteRole,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Note: Audit logging is now done server-side in the edge function
      // This ensures the audit trail exists even if subsequent steps fail

      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail}. Staff code: ${data.staff_code}`,
      });

      // Reset form and close dialog
      setInviteName("");
      setInviteEmail("");
      setInviteRole("staff");
      setInviteDialogOpen(false);
      
      // Reload staff list
      loadData();
    } catch (error: any) {
      console.error("Error inviting staff:", error);
      toast({
        title: "Failed to Invite",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (member: VendorStaffMember, newRole: "admin" | "staff") => {
    if (!vendorProfile || !user) return;
    
    // Guard: can't change owner role
    if (member.role === "owner") {
      toast({
        title: "Not Allowed",
        description: "The owner role cannot be changed.",
        variant: "destructive",
      });
      return;
    }
    
    // Guard: no-op if same role
    if (member.role === newRole) return;

    try {
      const { error } = await supabase
        .from("vendor_staff")
        .update({ role: newRole })
        .eq("id", member.id);

      if (error) throw error;

      // Log the action
      await logStaffAction(vendorProfile.id, "vendor_staff.role_changed", member.id, {
        from_role: member.role,
        to_role: newRole,
      });

      toast({
        title: "Role Updated",
        description: `${member.invited_name}'s role changed to ${newRole}.`,
      });
      loadData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update role.",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (member: VendorStaffMember) => {
    if (!vendorProfile || !user) return;
    
    // Guard: can't disable owner
    if (member.role === "owner") {
      toast({
        title: "Not Allowed",
        description: "The owner cannot be disabled.",
        variant: "destructive",
      });
      return;
    }
    
    // Guard: can't disable yourself
    if (member.staff_user_id === user.id) {
      toast({
        title: "Not Allowed",
        description: "You cannot disable yourself.",
        variant: "destructive",
      });
      return;
    }

    const newStatus = member.status === "disabled" ? "active" : "disabled";
    const actionType = newStatus === "disabled" ? "vendor_staff.disabled" : "vendor_staff.enabled";

    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "disabled") {
        updateData.disabled_at = new Date().toISOString();
      } else {
        updateData.disabled_at = null;
      }

      const { error } = await supabase
        .from("vendor_staff")
        .update(updateData)
        .eq("id", member.id);

      if (error) throw error;

      // Log the action
      await logStaffAction(vendorProfile.id, actionType, member.id);

      toast({
        title: newStatus === "disabled" ? "Staff Disabled" : "Staff Re-enabled",
        description: `${member.invited_name} has been ${newStatus === "disabled" ? "disabled" : "re-enabled"}.`,
      });
      loadData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update status.",
        variant: "destructive",
      });
    }
  };

  const handleResendInvite = async (member: VendorStaffMember) => {
    if (!vendorProfile || !user) return;
    
    if (member.status !== "invited") {
      toast({
        title: "Cannot Resend",
        description: "Can only resend invites to pending staff.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("invite-vendor-staff", {
        body: {
          resend: true,
          staffId: member.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.email_sent) {
        toast({
          title: "Invite Resent",
          description: `A new invitation email has been sent to ${member.invited_email}.`,
        });
      } else {
        toast({
          title: "Invite Logged",
          description: data?.email_error || "Email could not be sent. Please check configuration.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error resending invite:", error);
      toast({
        title: "Failed to Resend",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper to check if current user can manage a specific staff member
  const canManageMember = (member: VendorStaffMember): boolean => {
    if (!user) return false;
    // Can't manage owner
    if (member.role === "owner") return false;
    // Can't manage yourself (for disable)
    // Role change is allowed for self
    return true;
  };
  
  const canDisableMember = (member: VendorStaffMember): boolean => {
    if (!user) return false;
    if (member.role === "owner") return false;
    if (member.staff_user_id === user.id) return false;
    return true;
  };

  const isVerified = vendorProfile?.vendor_verification_status === "verified";
  const hasCode = !!vendorProfile?.vendor_public_code;
  const canInviteStaff = isVerified && hasCode;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Users className="h-8 w-8" />
            My Staff
          </h1>
          <p className="text-muted-foreground">
            Manage your team members and their access to your vendor account
          </p>
        </div>
      </div>

      {/* Gating Banner */}
      {!canInviteStaff && (
        <Alert className="mb-6 border-secondary/50 bg-secondary/10">
          <AlertCircle className="h-4 w-4 text-secondary" />
          <AlertDescription className="text-foreground">
            <strong>Inviting staff unlocks after vendor verification.</strong>
            <br />
            <span className="text-muted-foreground">
              Complete your vendor verification on your{" "}
              <Link to="/vendor/profile" className="text-primary underline">
                Profile page
              </Link>{" "}
              to invite team members.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Vendor Code Display */}
      {vendorProfile?.vendor_public_code && (
        <Card className="p-4 mb-6 bg-muted/30 border-border">
          <div className="flex items-center gap-4">
            <ShieldCheck className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Your Vendor Code</p>
              <p className="text-xl font-bold font-mono">{vendorProfile.vendor_public_code}</p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {vendorProfile.vendor_verification_status === "verified" ? "Verified" : vendorProfile.vendor_verification_status}
            </Badge>
          </div>
        </Card>
      )}

      {/* Invite Staff Button + Dialog */}
      <div className="mb-6">
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canInviteStaff}>
              <Plus className="h-4 w-4 mr-2" />
              Invite Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Staff Member</DialogTitle>
              <DialogDescription>
                Send an invitation to add a new team member to your vendor account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name *</Label>
                <Input
                  id="invite-name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "staff")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Admins can manage staff and settings. Staff can perform standard operations.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteStaff} disabled={inviting}>
                {inviting ? "Sending..." : "Send Invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Staff Table */}
      <Card className="p-0 overflow-hidden">
        {staffMembers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Staff Members Yet</h3>
            <p className="text-muted-foreground mb-4">
              {canInviteStaff
                ? "Invite your first team member to get started."
                : "Complete vendor verification to invite staff members."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-mono font-semibold">
                    {member.staff_code || "—"}
                  </TableCell>
                  <TableCell>{member.invited_name}</TableCell>
                  <TableCell className="text-muted-foreground">{member.invited_email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === "owner" ? "default" : member.role === "admin" ? "secondary" : "outline"}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.status === "active" && (
                      <Badge variant="default" className="bg-green-600">Active</Badge>
                    )}
                    {member.status === "invited" && (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                        <Mail className="h-3 w-3 mr-1" />
                        Invited
                      </Badge>
                    )}
                    {member.status === "disabled" && (
                      <Badge variant="destructive">
                        <UserX className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(member.invited_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {canManageMember(member) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.status === "invited" && (
                            <>
                              <DropdownMenuItem onClick={() => handleResendInvite(member)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Resend Invite
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(member, member.role === "admin" ? "staff" : "admin")}
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            {member.role === "admin" ? "Demote to Staff" : "Promote to Admin"}
                          </DropdownMenuItem>
                          {canDisableMember(member) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(member)}
                                className={member.status === "disabled" ? "text-green-600" : "text-destructive"}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                {member.status === "disabled" ? "Re-enable" : "Disable"}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
