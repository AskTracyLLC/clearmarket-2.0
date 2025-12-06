import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Copy, RefreshCw } from "lucide-react";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
  created_by: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
}

const AdminInviteCodes = () => {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState({
    code: "",
    maxUses: 1,
    expiresAt: ""
  });

  // Generate random code
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode({ ...newCode, code });
  };

  // Permission-based access control
  useEffect(() => {
    if (!permsLoading) {
      if (!permissions.canViewInvitesAdmin) {
        toast({
          title: "Access denied",
          description: "You don't have permission to view this page.",
          variant: "destructive",
        });
        navigate("/dashboard");
      } else {
        setHasAccess(true);
      }
    }
  }, [permsLoading, permissions, navigate, toast]);

  // Auth check and data loading
  useEffect(() => {
    if (authLoading || permsLoading) return;

    if (!user) {
      navigate("/signin");
      return;
    }

    if (hasAccess) {
      fetchInviteCodes();
    }
  }, [user, authLoading, permsLoading, hasAccess, navigate]);

  const fetchInviteCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("beta_invite_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invite codes:", error);
      toast({
        title: "Error",
        description: "Failed to load invite codes",
        variant: "destructive",
      });
    } else {
      setInviteCodes(data || []);
    }
    setLoading(false);
  };

  const handleCreateCode = async () => {
    if (!newCode.code.trim()) {
      toast({
        title: "Error",
        description: "Please enter or generate a code",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    const { error } = await supabase
      .from("beta_invite_codes")
      .insert({
        code: newCode.code.trim().toUpperCase(),
        max_uses: newCode.maxUses,
        expires_at: newCode.expiresAt || null,
        created_by: user?.id
      });

    setCreating(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message.includes("duplicate") 
          ? "This code already exists" 
          : "Failed to create invite code",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Invite code created",
      });
      setDialogOpen(false);
      setNewCode({ code: "", maxUses: 1, expiresAt: "" });
      fetchInviteCodes();
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    if (!permissions.canEditInvitesAdmin) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to edit invite codes.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("beta_invite_codes")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update code",
        variant: "destructive",
      });
    } else {
      fetchInviteCodes();
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: `Code "${code}" copied to clipboard`,
    });
  };

  if (authLoading || permsLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Beta Invite Codes</h1>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Manage Invite Codes</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchInviteCodes}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {permissions.canEditInvitesAdmin && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Invite Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="code">Code</Label>
                        <div className="flex gap-2">
                          <Input
                            id="code"
                            value={newCode.code}
                            onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                            placeholder="Enter or generate code"
                          />
                          <Button variant="outline" onClick={generateCode} type="button">
                            Generate
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="maxUses">Max Uses</Label>
                        <Input
                          id="maxUses"
                          type="number"
                          min={1}
                          value={newCode.maxUses}
                          onChange={(e) => setNewCode({ ...newCode, maxUses: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="expiresAt">Expires At (optional)</Label>
                        <Input
                          id="expiresAt"
                          type="datetime-local"
                          value={newCode.expiresAt}
                          onChange={(e) => setNewCode({ ...newCode, expiresAt: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleCreateCode} disabled={creating} className="w-full">
                        {creating ? "Creating..." : "Create Invite Code"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {inviteCodes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No invite codes yet. Create one to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    {permissions.canEditInvitesAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inviteCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-medium">
                        {code.code}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6 w-6 p-0"
                          onClick={() => copyCode(code.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        {format(new Date(code.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {code.used_count} / {code.max_uses}
                      </TableCell>
                      <TableCell>
                        {code.expires_at 
                          ? format(new Date(code.expires_at), "MMM d, yyyy HH:mm")
                          : "Never"
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={code.is_active ? "default" : "secondary"}>
                          {code.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      {permissions.canEditInvitesAdmin && (
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleActive(code.id, code.is_active)}
                          >
                            {code.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
};

export default AdminInviteCodes;
