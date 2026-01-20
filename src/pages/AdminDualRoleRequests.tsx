import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Users, 
  Eye, 
  Check, 
  X, 
  Clock, 
  SearchX, 
  Shield, 
  ExternalLink, 
  ArrowLeft,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { AdminDualRoleRequestDrawer } from "@/components/admin/AdminDualRoleRequestDrawer";
import type { Database } from "@/integrations/supabase/types";

type DualRoleRequest = Database["public"]["Tables"]["dual_role_access_requests"]["Row"];

type DualRoleRequestWithProfile = DualRoleRequest & {
  profiles?: {
    full_name: string | null;
  } | null;
};

export default function AdminDualRoleRequests() {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [requests, setRequests] = useState<DualRoleRequestWithProfile[]>([]);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<DualRoleRequestWithProfile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Permission check
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

  // Load data
  useEffect(() => {
    if (authLoading || permsLoading) return;
    if (!user) {
      navigate("/signin");
      return;
    }
    if (hasAccess) {
      loadRequests();
    }
  }, [user, authLoading, permsLoading, hasAccess, navigate, statusFilter]);

  async function loadRequests() {
    setLoading(true);
    try {
      let query = supabase
        .from("dual_role_access_requests")
        .select(`
          *,
          profiles!dual_role_access_requests_user_id_fkey (
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter === "pending") {
        query = query.eq("status", "pending");
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading requests:", error);
        toast.error("Failed to load requests");
      } else {
        setRequests(data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleViewRequest(request: DualRoleRequestWithProfile) {
    setSelectedRequest(request);
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setSelectedRequest(null);
  }

  function handleRequestUpdated() {
    loadRequests();
    handleDrawerClose();
  }

  function copyUserId(userId: string) {
    navigator.clipboard.writeText(userId);
    toast.success("User ID copied to clipboard");
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="success"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case "denied":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Denied</Badge>;
      case "cancelled":
        return <Badge variant="outline"><X className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getGlStatusBadge(glStatus: string | null, glExpiresOn: string | null) {
    if (!glStatus || glStatus === "none") return null;
    
    const isExpired = glExpiresOn && new Date(glExpiresOn) < new Date();
    
    switch (glStatus) {
      case "submitted":
        return <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" />Submitted</Badge>;
      case "verified":
        if (isExpired) {
          return <Badge variant="warning" className="gap-1"><Shield className="h-3 w-3" />Expired</Badge>;
        }
        return <Badge variant="success" className="gap-1"><Shield className="h-3 w-3" />Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><Shield className="h-3 w-3" />Rejected</Badge>;
      default:
        return null;
    }
  }

  function hasBbbUrl(message: string | null): boolean {
    if (!message) return false;
    return /BBB:\s*https?:\/\/\S+/i.test(message);
  }

  const filteredRequests = requests.filter(request => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      request.business_name?.toLowerCase().includes(searchLower) ||
      request.office_email?.toLowerCase().includes(searchLower) ||
      request.office_phone?.toLowerCase().includes(searchLower) ||
      request.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      request.profiles?.email?.toLowerCase().includes(searchLower)
    );
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (authLoading || permsLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-7xl mx-auto p-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!hasAccess) return null;

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/admin/users")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Button>
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Dual Role Requests</h1>
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} pending</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            Review Field Rep requests for Dual Role (Vendor) access
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.filter(r => r.status === "pending").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success-text">{requests.filter(r => r.status === "approved").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{requests.filter(r => r.status === "denied").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{requests.filter(r => r.status === "cancelled").length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All
            </Button>
          </div>

          <Input
            placeholder="Search by business name, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Table */}
        {filteredRequests.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <SearchX className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium text-foreground text-lg">
                {requests.length === 0 ? "No dual role requests yet" : "No results match your filters"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {requests.length === 0 
                  ? "When Field Reps request Dual Role access, they'll appear here."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Office Email</TableHead>
                  <TableHead>Office Phone</TableHead>
                  <TableHead>City/State</TableHead>
                  <TableHead>GL Status</TableHead>
                  <TableHead>BBB</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(request.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{request.business_name}</span>
                        {request.profiles?.full_name && (
                          <span className="text-xs text-muted-foreground">
                            {request.profiles.full_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.office_email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.office_phone}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.business_city && request.business_state
                        ? `${request.business_city}, ${request.business_state}`
                        : request.business_city || request.business_state || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getGlStatusBadge(request.gl_status, request.gl_expires_on)}
                        {request.gl_expires_on && (
                          <span className="text-xs text-muted-foreground">
                            Exp: {format(new Date(request.gl_expires_on), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasBbbUrl(request.message) && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" />
                          BBB
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyUserId(request.user_id)}
                          title="Copy User ID"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewRequest(request)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <AdminDualRoleRequestDrawer
        request={selectedRequest}
        open={drawerOpen}
        onClose={handleDrawerClose}
        onUpdated={handleRequestUpdated}
      />
    </AuthenticatedLayout>
  );
}
