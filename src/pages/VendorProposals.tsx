/**
 * Vendor Proposals List Page
 * PRIVATE: Vendor-only, not visible to Field Reps
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useProposalDebug } from "@/hooks/useProposalDebug";
import { ProposalDebugPanel } from "@/components/ProposalDebugPanel";
import {
  fetchVendorProposals,
  deleteProposal,
  duplicateProposal,
  VendorProposal,
} from "@/lib/vendorProposals";
import { Plus, MoreHorizontal, Pencil, Copy, Trash2, FileText, Lock, FilePlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function VendorProposals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<VendorProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"proposals" | "templates">("proposals");
  
  // Duplicate dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [duplicateSourceName, setDuplicateSourceName] = useState("");
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateClientName, setDuplicateClientName] = useState("");
  const [duplicateKeepAsTemplate, setDuplicateKeepAsTemplate] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  
  const { debugState, withDebug, clear: clearDebug } = useProposalDebug();

  useEffect(() => {
    if (user?.id) {
      loadProposals();
    }
  }, [user?.id]);

  const loadProposals = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await fetchVendorProposals(user.id);
      setProposals(data);
    } catch (err) {
      console.error("Error loading proposals:", err);
      toast.error("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await withDebug("delete_proposal", { proposalId: deleteId }, () => 
        deleteProposal(deleteId)
      );
      toast.success("Proposal deleted");
      setDeleteId(null);
      loadProposals();
    } catch (err) {
      // Error already handled by withDebug
      setDeleteId(null);
    }
  };

  const openDuplicateDialog = (proposal: VendorProposal, createFromTemplate = false) => {
    setDuplicateSourceId(proposal.id);
    setDuplicateSourceName(proposal.name);
    setDuplicateName(createFromTemplate ? proposal.name.replace(" (Template)", "") : `${proposal.name} (Copy)`);
    setDuplicateClientName("");
    setDuplicateKeepAsTemplate(false);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicate = async () => {
    if (!duplicateSourceId || !duplicateName.trim()) {
      toast.error("Please enter a proposal name");
      return;
    }
    
    setDuplicating(true);
    try {
      const newProposal = await duplicateProposal(duplicateSourceId, {
        newName: duplicateName.trim(),
        clientName: duplicateClientName.trim() || undefined,
        keepAsTemplate: duplicateKeepAsTemplate,
      });
      toast.success("Proposal duplicated");
      setDuplicateDialogOpen(false);
      navigate(`/vendor/proposals/${newProposal.id}`);
    } catch (err: any) {
      console.error("[Duplicate] Failed:", err);
      toast.error(`Failed to duplicate: ${err.message}`);
    } finally {
      setDuplicating(false);
    }
  };

  const getStatusBadge = (status: string, isTemplate: boolean) => {
    if (isTemplate) {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">Template</Badge>;
    }
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const regularProposals = proposals.filter((p) => !p.is_template);
  const templates = proposals.filter((p) => p.is_template);

  const renderProposalTable = (items: VendorProposal[], isTemplateView: boolean) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 space-y-4">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <div className="text-muted-foreground">
            {isTemplateView 
              ? "No templates yet. Create a proposal and toggle 'Save as Template' to reuse it." 
              : "No proposals yet. Create your first client coverage proposal."}
          </div>
          <Button onClick={() => navigate("/vendor/proposals/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Create {isTemplateView ? "Proposal" : "Proposal"}
          </Button>
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((proposal) => (
              <TableRow key={proposal.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell 
                  className="font-medium"
                  onClick={() => navigate(`/vendor/proposals/${proposal.id}`)}
                >
                  {proposal.name}
                </TableCell>
                <TableCell onClick={() => navigate(`/vendor/proposals/${proposal.id}`)}>
                  {getStatusBadge(proposal.status, proposal.is_template)}
                </TableCell>
                <TableCell 
                  className="text-muted-foreground"
                  onClick={() => navigate(`/vendor/proposals/${proposal.id}`)}
                >
                  {proposal.client_name || "—"}
                </TableCell>
                <TableCell 
                  className="text-muted-foreground"
                  onClick={() => navigate(`/vendor/proposals/${proposal.id}`)}
                >
                  {format(new Date(proposal.updated_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/vendor/proposals/${proposal.id}`)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {isTemplateView ? (
                        <DropdownMenuItem onClick={() => openDuplicateDialog(proposal, true)}>
                          <FilePlus className="w-4 h-4 mr-2" />
                          Create Proposal from Template
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => openDuplicateDialog(proposal, false)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteId(proposal.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="container max-w-6xl py-6 space-y-6">
        <PageHeader
          title="Client Coverage Proposals"
          backTo="/dashboard"
          backLabel="Dashboard"
        />

        {/* Privacy Notice */}
        <Alert className="border-yellow-500/30 bg-yellow-500/5">
          <Lock className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-muted-foreground">
            Proposal pricing is <strong>private</strong> and only visible to you (and ClearMarket admins). 
            Field Reps cannot see your proposals or pricing.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {regularProposals.length} proposal{regularProposals.length !== 1 ? "s" : ""} 
            {templates.length > 0 && ` • ${templates.length} template${templates.length !== 1 ? "s" : ""}`}
          </div>
          <Button onClick={() => navigate("/vendor/proposals/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Proposal
          </Button>
        </div>

        {/* Proposals/Templates Tabs */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <div className="text-muted-foreground">
              No proposals yet. Create your first client coverage proposal.
            </div>
            <Button onClick={() => navigate("/vendor/proposals/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Create Proposal
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "proposals" | "templates")}>
            <TabsList>
              <TabsTrigger value="proposals">
                Proposals ({regularProposals.length})
              </TabsTrigger>
              <TabsTrigger value="templates">
                Templates ({templates.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="proposals" className="mt-4">
              {renderProposalTable(regularProposals, false)}
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              {renderProposalTable(templates, true)}
            </TabsContent>
          </Tabs>
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this proposal? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Duplicate Dialog */}
        <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicate Proposal</DialogTitle>
              <DialogDescription>
                Create a new proposal based on "{duplicateSourceName}". All coverage lines and rates will be copied.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dup-name">Proposal Name *</Label>
                <Input
                  id="dup-name"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  placeholder="e.g., Q2 2025 Proposal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dup-client">Client Name (optional)</Label>
                <Input
                  id="dup-client"
                  value={duplicateClientName}
                  onChange={(e) => setDuplicateClientName(e.target.value)}
                  placeholder="e.g., ABC Company"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dup-template"
                  checked={duplicateKeepAsTemplate}
                  onCheckedChange={(checked) => setDuplicateKeepAsTemplate(!!checked)}
                />
                <Label htmlFor="dup-template" className="cursor-pointer">Keep as template</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDuplicate} disabled={duplicating || !duplicateName.trim()}>
                {duplicating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Duplicating...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Create Duplicate
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Debug Panel */}
        <ProposalDebugPanel debugState={debugState} onClear={clearDebug} />
      </div>
    </AppLayout>
  );
}
