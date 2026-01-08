import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Eye, Check, X, Clock, AlertTriangle, SearchX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getBackgroundCheckSignedUrl } from "@/lib/storage";
import { createNotification } from "@/lib/notifications";
import {
  fetchAllBackgroundChecks,
  approveBackgroundCheck,
  rejectBackgroundCheck,
  BackgroundCheckWithRep,
  BackgroundCheckStatus,
} from "@/lib/backgroundChecks";

export default function AdminBackgroundChecks() {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [checks, setChecks] = useState<BackgroundCheckWithRep[]>([]);
  const [statusFilter, setStatusFilter] = useState<BackgroundCheckStatus | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<BackgroundCheckWithRep | null>(null);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  // Permission check
  useEffect(() => {
    if (!permsLoading) {
      if (!permissions.canViewModeration) {
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
      loadChecks();
    }
  }, [user, authLoading, permsLoading, hasAccess, navigate, statusFilter]);

  const loadChecks = async () => {
    setLoading(true);
    const filter = statusFilter === "all" ? undefined : statusFilter;
    const data = await fetchAllBackgroundChecks(filter);
    setChecks(data);
    setLoading(false);
  };

  const handleViewScreenshot = async (check: BackgroundCheckWithRep) => {
    setLoadingScreenshot(true);
    setViewingScreenshot(check.id);
    
    const signedUrl = await getBackgroundCheckSignedUrl(check.screenshot_url);
    setScreenshotUrl(signedUrl);
    setLoadingScreenshot(false);
  };

  const handleApproveClick = (check: BackgroundCheckWithRep) => {
    setSelectedCheck(check);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (check: BackgroundCheckWithRep) => {
    setSelectedCheck(check);
    setRejectNotes("");
    setRejectDialogOpen(true);
  };

  const confirmApprove = async () => {
    if (!selectedCheck || !user) return;

    const result = await approveBackgroundCheck(selectedCheck.id, user.id);
    if (result.success) {
      toast.success("Background check approved");
      
      // Send notification to rep
      await createNotification(
        supabase,
        selectedCheck.field_rep_id,
        "background_check_approved",
        "Your background check has been verified",
        "We've reviewed your background check and marked it as verified. Vendors can now see that you have a verified background check on file."
      );

      loadChecks();
    } else {
      toast.error("Failed to approve", { description: result.error });
    }
    
    setApproveDialogOpen(false);
    setSelectedCheck(null);
  };

  const confirmReject = async () => {
    if (!selectedCheck || !user || !rejectNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    const result = await rejectBackgroundCheck(selectedCheck.id, user.id, rejectNotes);
    if (result.success) {
      toast.success("Background check rejected");
      
      // Send notification to rep
      await createNotification(
        supabase,
        selectedCheck.field_rep_id,
        "background_check_rejected",
        "Background check could not be verified",
        `We couldn't verify your background check. Reason: ${rejectNotes}`
      );

      loadChecks();
    } else {
      toast.error("Failed to reject", { description: result.error });
    }
    
    setRejectDialogOpen(false);
    setSelectedCheck(null);
    setRejectNotes("");
  };

  const getStatusBadge = (status: BackgroundCheckStatus) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="success"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "expired":
        return <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
    }
  };

  const filteredChecks = checks.filter(check => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      check.profiles?.email?.toLowerCase().includes(searchLower) ||
      check.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      check.rep_profile?.anonymous_id?.toLowerCase().includes(searchLower) ||
      check.check_id?.toLowerCase().includes(searchLower) ||
      check.provider?.toLowerCase().includes(searchLower)
    );
  });

  const pendingCount = checks.filter(c => c.status === "pending").length;

  if (authLoading || permsLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
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
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Background Check Reviews</h1>
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} pending</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            Review and verify field rep background check submissions
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{checks.filter(c => c.status === "pending").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success-text">{checks.filter(c => c.status === "approved").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{checks.filter(c => c.status === "rejected").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning-text">{checks.filter(c => c.status === "expired").length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BackgroundCheckStatus | "all")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search by email, name, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Table */}
        {filteredChecks.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <SearchX className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium text-foreground text-lg">
                {checks.length === 0 ? "No background checks submitted yet" : "No results match your filters"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {checks.length === 0 
                  ? "When field reps submit background checks for verification, they'll appear here."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Check ID</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecks.map((check) => (
                  <TableRow key={check.id}>
                    <TableCell className="font-medium">
                      {check.rep_profile?.anonymous_id || check.profiles?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {check.profiles?.email || "—"}
                    </TableCell>
                    <TableCell>
                      {check.provider === "aspen_grove" ? "AspenGrove" : check.provider}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {check.check_id}
                    </TableCell>
                    <TableCell>
                      {check.expiration_date 
                        ? format(new Date(check.expiration_date), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(check.status as BackgroundCheckStatus)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(check.submitted_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {check.reviewed_at 
                        ? format(new Date(check.reviewed_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewScreenshot(check)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {check.status === "pending" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApproveClick(check)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRejectClick(check)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Screenshot Dialog */}
      <Dialog open={!!viewingScreenshot} onOpenChange={() => { setViewingScreenshot(null); setScreenshotUrl(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Background Check Screenshot</DialogTitle>
            <DialogDescription>
              Review the screenshot to verify the background check details.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {loadingScreenshot ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Loading screenshot...
              </div>
            ) : screenshotUrl ? (
              <img 
                src={screenshotUrl} 
                alt="Background check screenshot" 
                className="w-full rounded-lg border border-border"
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Failed to load screenshot
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve background check?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark this Field Rep as having a verified background check
              {selectedCheck?.expiration_date && (
                <> until {format(new Date(selectedCheck.expiration_date), "MMMM d, yyyy")}</>
              )}.
              The rep will be notified and vendors will be able to see their verified status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject background check?</DialogTitle>
            <DialogDescription>
              Explain what's missing or unclear so the rep can upload a better screenshot.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Textarea
              placeholder="e.g., Screenshot is blurry and ID number is not visible..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmReject}
              disabled={!rejectNotes.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
