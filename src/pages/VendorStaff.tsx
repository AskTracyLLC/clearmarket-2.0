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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Users, AlertCircle, Mail, ShieldCheck, UserX } from "lucide-react";
import { format } from "date-fns";

interface VendorStaffMember {
  id: string;
  staff_code: string | null;
  invited_name: string;
  invited_email: string;
  role: "owner" | "admin" | "staff";
  status: "invited" | "active" | "disabled";
  invited_at: string;
  accepted_at: string | null;
  disabled_at: string | null;
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
