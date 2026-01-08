/**
 * Vendor Proposal Builder (Create/Edit)
 * PRIVATE: Vendor-only, not visible to Field Reps
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProposalDebug } from "@/hooks/useProposalDebug";
import { ProposalDebugPanel } from "@/components/ProposalDebugPanel";
import {
  fetchProposalById,
  fetchProposalLines,
  createProposal,
  updateProposal,
  updateProposalLine,
  deleteProposalLines,
  autoFillFromCoverage,
  batchUpdateProposedRate,
  VendorProposal,
  VendorProposalLine,
  ORDER_TYPE_LABELS,
  ORDER_TYPES,
} from "@/lib/vendorProposals";
import { VendorCoverageDialog } from "@/components/VendorCoverageDialog";
import { US_STATES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Save,
  Download,
  Copy,
  Trash2,
  Lock,
  AlertTriangle,
  MoreHorizontal,
  FileDown,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function VendorProposalBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { proposalId } = useParams<{ proposalId: string }>();
  const isNew = proposalId === "new";

  // Proposal header state
  const [proposal, setProposal] = useState<VendorProposal | null>(null);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Proposal lines state
  const [lines, setLines] = useState<VendorProposalLine[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

  // Filters
  const [filterState, setFilterState] = useState<string>("all");
  const [filterOrderType, setFilterOrderType] = useState<string>("all");
  const [searchCounty, setSearchCounty] = useState("");

  // Dialogs
  const [coverageDialogOpen, setCoverageDialogOpen] = useState(false);
  const [batchRateDialogOpen, setBatchRateDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Activation fields
  const [effectiveDate, setEffectiveDate] = useState("");
  const [clientRepName, setClientRepName] = useState("");
  const [clientRepEmail, setClientRepEmail] = useState("");

  // Batch rate
  const [batchRate, setBatchRate] = useState("");

  // Debug
  const { debugState, withDebug, clear: clearDebug } = useProposalDebug(proposalId);

  // Export state
  const [exportStyle, setExportStyle] = useState<"matrix" | "detailed">("matrix");

  // Matrix rows for export (blank = missing, not "—")
  const matrixRows = useMemo(() => {
    type MatrixRow = {
      stateCode: string;
      stateDisplay: string;
      countyDisplay: string;
      isAllCounties: boolean;
      standard: string;
      appointment: string;
      rush: string;
    };

    const grouped = new Map<string, MatrixRow>();

    for (const line of lines) {
      const countyDisplay = line.is_all_counties ? "All counties" : (line.county_name || "Unknown");
      const key = `${line.state_code}|${countyDisplay}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          stateCode: line.state_code,
          stateDisplay: `${line.state_name} (${line.state_code})`,
          countyDisplay,
          isAllCounties: line.is_all_counties,
          standard: "",
          appointment: "",
          rush: "",
        });
      }

      const row = grouped.get(key)!;
      // Only show rate if it exists; blank otherwise
      const rateStr = line.proposed_rate != null ? `$${line.proposed_rate.toFixed(2)}` : "";

      if (line.order_type === "standard") row.standard = rateStr;
      else if (line.order_type === "appointment") row.appointment = rateStr;
      else if (line.order_type === "rush") row.rush = rateStr;
    }

    // Sort: state asc, then "All counties" first, then county asc
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.stateCode !== b.stateCode) return a.stateCode.localeCompare(b.stateCode);
      if (a.isAllCounties && !b.isAllCounties) return -1;
      if (!a.isAllCounties && b.isAllCounties) return 1;
      return a.countyDisplay.localeCompare(b.countyDisplay);
    });
  }, [lines]);

  // CSV Export handler - Excel-safe with UTF-8 BOM
  const handleExportCSV = () => {
    if (!lines.length) {
      toast.error("No data to export");
      return;
    }

    // Helper: escape CSV field (quote if contains comma/quote/newline, double quotes)
    const escapeCSV = (value: string | null | undefined): string => {
      if (value == null) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csvContent: string;
    let filename: string;

    if (exportStyle === "matrix") {
      // Matrix format: state, county, standard_rate, appt_rate, rush_rate
      const headers = ["State", "County", "Standard Rate", "Appt-based Rate", "Rush Rate"];
      const rows = matrixRows.map((row) => [
        escapeCSV(row.stateDisplay),
        escapeCSV(row.countyDisplay),
        escapeCSV(row.standard),
        escapeCSV(row.appointment),
        escapeCSV(row.rush),
      ].join(","));
      csvContent = [headers.join(","), ...rows].join("\n");
      filename = `${name || "proposal"}_matrix.csv`;
    } else {
      // Detailed format: state, county, order_type, rate
      const headers = ["State", "County", "Order Type", "Rate"];
      const rows = lines.map((line) => [
        escapeCSV(`${line.state_name} (${line.state_code})`),
        escapeCSV(line.is_all_counties ? "All counties" : line.county_name),
        escapeCSV(ORDER_TYPE_LABELS[line.order_type as keyof typeof ORDER_TYPE_LABELS]),
        escapeCSV(line.proposed_rate != null ? `$${line.proposed_rate.toFixed(2)}` : ""),
      ].join(","));
      csvContent = [headers.join(","), ...rows].join("\n");
      filename = `${name || "proposal"}_detailed.csv`;
    }

    // Prepend UTF-8 BOM for Excel compatibility
    const bom = "\ufeff";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  useEffect(() => {
    if (!isNew && proposalId && user?.id) {
      loadProposal();
    }
  }, [proposalId, user?.id, isNew]);

  const loadProposal = async () => {
    if (!proposalId) return;
    setLoading(true);
    try {
      const [proposalData, linesData] = await Promise.all([
        fetchProposalById(proposalId),
        fetchProposalLines(proposalId),
      ]);
      if (proposalData) {
        setProposal(proposalData);
        setName(proposalData.name);
        setClientName(proposalData.client_name || "");
        setDisclaimer(proposalData.disclaimer || "");
        setEffectiveDate(proposalData.effective_as_of || "");
        setClientRepName(proposalData.client_rep_name || "");
        setClientRepEmail(proposalData.client_rep_email || "");
      }
      setLines(linesData);
    } catch (err) {
      console.error("Error loading proposal:", err);
      toast.error("Failed to load proposal");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!name.trim()) {
      toast.error("Please enter a proposal name");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const payload = { vendor_user_id: user.id, name: name.trim() };
        const newProposal = await withDebug("create_proposal", payload, () =>
          createProposal(user.id, name.trim())
        );
        await withDebug("update_proposal_header", { proposalId: newProposal.id, clientName, disclaimer }, () =>
          updateProposal(newProposal.id, {
            client_name: clientName.trim() || null,
            disclaimer: disclaimer.trim() || null,
          })
        );
        toast.success("Proposal created");
        navigate(`/vendor/proposals/${newProposal.id}`, { replace: true });
      } else if (proposal) {
        const payload = { proposalId: proposal.id, name, clientName, disclaimer };
        await withDebug("update_proposal_header", payload, () =>
          updateProposal(proposal.id, {
            name: name.trim(),
            client_name: clientName.trim() || null,
            disclaimer: disclaimer.trim() || null,
          })
        );
        toast.success("Proposal saved");
        loadProposal();
      }
    } catch (err) {
      // Error already handled by withDebug
    } finally {
      setSaving(false);
    }
  };

  const [autoFillDebug, setAutoFillDebug] = useState<{
    step: string;
    userId: string;
    proposalId: string;
    error: string;
    details?: string;
  } | null>(null);

  const handleAutoFill = async () => {
    if (!proposal || !user?.id) return;
    setAutoFillDebug(null);
    
    try {
      const result = await withDebug("auto_fill_from_coverage", { proposalId: proposal.id, vendorUserId: user.id }, () =>
        autoFillFromCoverage(proposal.id, user.id)
      );
      
      const { insertedCount, debugInfo } = result;
      
      if (debugInfo) {
        console.error("[AutoFill] Debug info:", debugInfo);
        setAutoFillDebug(debugInfo);
        toast.error(`Auto-fill failed: ${debugInfo.error}`);
      } else if (insertedCount === 0) {
        toast.warning("No coverage areas found. Add coverage first in Vendor → My Coverage.");
      } else {
        toast.success(`Added ${insertedCount} line${insertedCount !== 1 ? "s" : ""} from your coverage areas`);
      }
      
      loadProposal();
    } catch (err: any) {
      console.error("[AutoFill] Unexpected error:", err);
      setAutoFillDebug({
        step: "unknown",
        userId: user.id,
        proposalId: proposal.id,
        error: err?.message || String(err),
        details: JSON.stringify(err, null, 2),
      });
      toast.error(`Auto-fill failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleCopyDebug = () => {
    if (!autoFillDebug) return;
    const text = `Auto-fill Debug Info
Step: ${autoFillDebug.step}
User ID: ${autoFillDebug.userId}
Proposal ID: ${autoFillDebug.proposalId}
Error: ${autoFillDebug.error}
Details: ${autoFillDebug.details || "N/A"}`;
    navigator.clipboard.writeText(text);
    toast.success("Debug info copied to clipboard");
  };

  const handleCoverageSave = async (data: {
    state_code: string;
    state_name: string;
    coverage_mode: "entire_state" | "entire_state_except" | "selected_counties";
    included_county_ids?: string[] | null;
  }) => {
    if (!proposal) return;

    const payload = { proposalId: proposal.id, ...data };
    
    try {
      await withDebug("add_coverage_lines", payload, async () => {
        // For proposal mode, we create lines based on selection
        if (data.coverage_mode === "entire_state" || data.coverage_mode === "entire_state_except") {
          // Create all-counties rows for each order type
          for (const orderType of ORDER_TYPES) {
            const regionKey = '__ALL__';
            const { error } = await supabase.from("vendor_client_proposal_lines").upsert(
              {
                proposal_id: proposal.id,
                state_code: data.state_code,
                state_name: data.state_name,
                county_id: null,
                county_name: null,
                is_all_counties: true,
                region_key: regionKey,
                order_type: orderType,
                proposed_rate: 0,
              } as any,
              { onConflict: "proposal_id,state_code,order_type,region_key" }
            );
            if (error && !error.message.includes("duplicate")) {
              throw error;
            }
          }
        } else if (data.coverage_mode === "selected_counties" && data.included_county_ids?.length) {
          // Fetch county names
          const { data: counties } = await supabase
            .from("us_counties")
            .select("id, county_name")
            .in("id", data.included_county_ids);

          const countyMap = new Map((counties || []).map((c) => [c.id, c.county_name]));

          // Create county-specific rows
          for (const countyId of data.included_county_ids) {
            const countyName = countyMap.get(countyId);
            if (!countyName) continue;

            for (const orderType of ORDER_TYPES) {
              const regionKey = countyId;
              const { error } = await supabase.from("vendor_client_proposal_lines").upsert(
                {
                  proposal_id: proposal.id,
                  state_code: data.state_code,
                  state_name: data.state_name,
                  county_id: countyId,
                  county_name: countyName,
                  is_all_counties: false,
                  region_key: regionKey,
                  order_type: orderType,
                  proposed_rate: 0,
                } as any,
                { onConflict: "proposal_id,state_code,order_type,region_key" }
              );
              if (error && !error.message.includes("duplicate")) {
                throw error;
              }
            }
          }
        }
      });

      toast.success("Coverage added to proposal");
      loadProposal();
    } catch (err) {
      // Error already handled by withDebug
    }
  };

  const handleRateChange = async (lineId: string, rate: string) => {
    const numRate = parseFloat(rate) || 0;
    try {
      await withDebug("update_line_rate", { lineId, proposed_rate: numRate }, () =>
        updateProposalLine(lineId, { proposed_rate: numRate })
      );
      setLines((prev) =>
        prev.map((l) => (l.id === lineId ? { ...l, proposed_rate: numRate } : l))
      );
    } catch (err) {
      // Error already handled by withDebug
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLineIds.size === 0) return;
    const lineIds = Array.from(selectedLineIds);
    try {
      await withDebug("delete_lines", { lineIds }, () =>
        deleteProposalLines(lineIds)
      );
      toast.success(`Deleted ${selectedLineIds.size} line${selectedLineIds.size !== 1 ? "s" : ""}`);
      setSelectedLineIds(new Set());
      loadProposal();
    } catch (err) {
      // Error already handled by withDebug
    }
  };

  const handleBatchRate = async () => {
    if (selectedLineIds.size === 0 || !batchRate) return;
    const rate = parseFloat(batchRate);
    if (isNaN(rate)) {
      toast.error("Please enter a valid rate");
      return;
    }
    const lineIds = Array.from(selectedLineIds);
    try {
      await withDebug("batch_update_rates", { lineIds, proposed_rate: rate }, () =>
        batchUpdateProposedRate(lineIds, rate)
      );
      toast.success("Rates updated");
      setBatchRateDialogOpen(false);
      setBatchRate("");
      setSelectedLineIds(new Set());
      loadProposal();
    } catch (err) {
      // Error already handled by withDebug
    }
  };

  const handleActivate = async () => {
    if (!proposal) return;
    if (!effectiveDate || !clientRepName.trim() || !clientRepEmail.trim()) {
      toast.error("Please fill in all activation fields");
      return;
    }

    const payload = {
      proposalId: proposal.id,
      status: "active",
      effective_as_of: effectiveDate,
      client_rep_name: clientRepName.trim(),
      client_rep_email: clientRepEmail.trim(),
    };

    try {
      await withDebug("activate_proposal", payload, () =>
        updateProposal(proposal.id, {
          status: "active",
          effective_as_of: effectiveDate,
          client_rep_name: clientRepName.trim(),
          client_rep_email: clientRepEmail.trim(),
        })
      );
      toast.success("Proposal activated");
      setActivateDialogOpen(false);
      loadProposal();
    } catch (err) {
      // Error already handled by withDebug
    }
  };

  // Filtered lines
  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (filterState !== "all" && line.state_code !== filterState) return false;
      if (filterOrderType !== "all" && line.order_type !== filterOrderType) return false;
      if (searchCounty && line.county_name) {
        if (!line.county_name.toLowerCase().includes(searchCounty.toLowerCase())) return false;
      }
      return true;
    });
  }, [lines, filterState, filterOrderType, searchCounty]);

  // Unique states for filter
  const uniqueStates = useMemo(() => {
    const states = new Set(lines.map((l) => l.state_code));
    return Array.from(states).sort();
  }, [lines]);

  const toggleSelectAll = () => {
    if (selectedLineIds.size === filteredLines.length) {
      setSelectedLineIds(new Set());
    } else {
      setSelectedLineIds(new Set(filteredLines.map((l) => l.id)));
    }
  };

  const toggleLineSelection = (lineId: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const getStatusBadge = () => {
    if (!proposal) return null;
    if (proposal.is_template) {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">Template</Badge>;
    }
    switch (proposal.status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-6xl py-6">
          <div className="text-center py-12 text-muted-foreground">Loading proposal...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-6xl py-6 space-y-6">
        <PageHeader
          title={isNew ? "New Proposal" : name || "Proposal"}
          backTo="/vendor/proposals"
          backLabel="Proposals"
        >
          {getStatusBadge()}
        </PageHeader>

        {/* Privacy Notice */}
        <Alert className="border-yellow-500/30 bg-yellow-500/5">
          <Lock className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-muted-foreground">
            This proposal and its pricing are <strong>private</strong>. Field Reps cannot see this data.
          </AlertDescription>
        </Alert>

        {/* Header Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Proposal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Proposal Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q1 2025 Coverage Rates"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client Name (optional)</Label>
                <Input
                  id="client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g., Cyprexx"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disclaimer">Disclaimer / Notes (optional)</Label>
              <Textarea
                id="disclaimer"
                value={disclaimer}
                onChange={(e) => setDisclaimer(e.target.value)}
                placeholder="Any terms, conditions, or notes to include in the proposal..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lines Section - only show after proposal is created */}
        {proposal && (
          <>
            {/* Actions Bar */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setCoverageDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Coverage
                </Button>
                <Button variant="outline" onClick={handleAutoFill}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Auto-Fill from My Coverage
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedLineIds.size > 0 && (
                  <>
                    <Button variant="outline" onClick={() => setBatchRateDialogOpen(true)}>
                      Set Rate ({selectedLineIds.size})
                    </Button>
                    <Button variant="outline" onClick={handleDeleteSelected}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete ({selectedLineIds.size})
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setExportDialogOpen(true)} disabled={lines.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                {proposal.status === "draft" && (
                  <Button onClick={() => setActivateDialogOpen(true)}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Activate
                  </Button>
                )}
              </div>
            </div>

            {/* Auto-fill Debug Alert */}
            {autoFillDebug && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Auto-fill Failed: {autoFillDebug.step}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <div className="text-sm space-y-1">
                    <p><strong>User ID:</strong> {autoFillDebug.userId}</p>
                    <p><strong>Proposal ID:</strong> {autoFillDebug.proposalId}</p>
                    <p><strong>Error:</strong> {autoFillDebug.error}</p>
                    {autoFillDebug.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show details</summary>
                        <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">{autoFillDebug.details}</pre>
                      </details>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={handleCopyDebug}>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Debug
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAutoFillDebug(null)}>
                      Dismiss
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={filterState} onValueChange={setFilterState}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {uniqueStates.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterOrderType} onValueChange={setFilterOrderType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Order Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Order Types</SelectItem>
                  {ORDER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ORDER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search county..."
                value={searchCounty}
                onChange={(e) => setSearchCounty(e.target.value)}
                className="w-[200px]"
              />
              <div className="text-sm text-muted-foreground">
                {filteredLines.length} of {lines.length} lines
              </div>
            </div>

            {/* Lines Table */}
            {lines.length === 0 ? (
              <div className="text-center py-12 border rounded-lg">
                <div className="text-muted-foreground mb-4">
                  No coverage lines yet. Add coverage to build your proposal.
                </div>
                <Button variant="outline" onClick={() => setCoverageDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Coverage
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedLineIds.size === filteredLines.length && filteredLines.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead>Order Type</TableHead>
                      <TableHead className="text-right">Proposed Rate</TableHead>
                      <TableHead className="text-right">Approved Limit</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLines.map((line) => {
                      const isAboveApproved = line.approved_rate !== null && line.proposed_rate > line.approved_rate;
                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLineIds.has(line.id)}
                              onCheckedChange={() => toggleLineSelection(line.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{line.state_code}</TableCell>
                          <TableCell>
                            {line.is_all_counties ? (
                              <span className="text-muted-foreground italic">All counties</span>
                            ) : (
                              line.county_name
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{ORDER_TYPE_LABELS[line.order_type as keyof typeof ORDER_TYPE_LABELS]}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.proposed_rate}
                                onChange={(e) => handleRateChange(line.id, e.target.value)}
                                className="w-24 text-right"
                              />
                              {isAboveApproved && (
                                <span title="Above approved limit">
                                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {line.approved_rate !== null ? `$${line.approved_rate.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedLineIds(new Set([line.id]));
                                    handleDeleteSelected();
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {/* Coverage Dialog (proposal mode) */}
        <VendorCoverageDialog
          open={coverageDialogOpen}
          onOpenChange={setCoverageDialogOpen}
          onSave={handleCoverageSave}
          mode="proposal"
        />

        {/* Batch Rate Dialog */}
        <Dialog open={batchRateDialogOpen} onOpenChange={setBatchRateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Proposed Rate</DialogTitle>
              <DialogDescription>
                Set the same proposed rate for {selectedLineIds.size} selected line{selectedLineIds.size !== 1 ? "s" : ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="batch-rate">Proposed Rate ($)</Label>
                <Input
                  id="batch-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={batchRate}
                  onChange={(e) => setBatchRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBatchRateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBatchRate}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activate Dialog */}
        <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Activate Proposal</DialogTitle>
              <DialogDescription>
                Enter the activation details to mark this proposal as active.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="effective-date">Effective "As Of" Date *</Label>
                <Input
                  id="effective-date"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rep-name">Client Representative Name *</Label>
                <Input
                  id="rep-name"
                  value={clientRepName}
                  onChange={(e) => setClientRepName(e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rep-email">Client Representative Email *</Label>
                <Input
                  id="rep-email"
                  type="email"
                  value={clientRepEmail}
                  onChange={(e) => setClientRepEmail(e.target.value)}
                  placeholder="e.g., john@client.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleActivate}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Activate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Proposal Export Preview</DialogTitle>
              <DialogDescription>
                This is a preview of your proposal. You can print or save this page.
              </DialogDescription>
            </DialogHeader>

            {/* Export Style Toggle */}
            <div className="flex items-center gap-4 print:hidden">
              <span className="text-sm text-muted-foreground">Export Style:</span>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setExportStyle("matrix")}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    exportStyle === "matrix"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  Client Table (Matrix)
                </button>
                <button
                  onClick={() => setExportStyle("detailed")}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    exportStyle === "detailed"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  Detailed (List)
                </button>
              </div>
            </div>

            <div className="proposal-export-content py-4 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold">{name}</h2>
                {clientName && <p className="text-muted-foreground">Client: {clientName}</p>}
                {proposal?.effective_as_of && (
                  <p className="text-muted-foreground">
                    Effective: {format(new Date(proposal.effective_as_of), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
              {disclaimer && (
                <div className="disclaimer-box p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{disclaimer}</p>
                </div>
              )}

              {exportStyle === "matrix" ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2">
                      <TableHead colSpan={2} className="text-center border-r font-bold">
                        Coverage Proposal
                      </TableHead>
                      <TableHead colSpan={3} className="text-center font-bold">
                        Order Type Rates
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="w-32">State</TableHead>
                      <TableHead className="border-r">County</TableHead>
                      <TableHead className="text-right w-24">Standard</TableHead>
                      <TableHead className="text-right w-24">Appt-based</TableHead>
                      <TableHead className="text-right w-24">Rush</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.stateDisplay}</TableCell>
                        <TableCell className="border-r">{row.countyDisplay}</TableCell>
                        <TableCell className="text-right">{row.standard || "—"}</TableCell>
                        <TableCell className="text-right">{row.appointment || "—"}</TableCell>
                        <TableCell className="text-right">{row.rush || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead>Order Type</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.state_name} ({line.state_code})</TableCell>
                        <TableCell>{line.is_all_counties ? "All counties" : line.county_name}</TableCell>
                        <TableCell>{ORDER_TYPE_LABELS[line.order_type as keyof typeof ORDER_TYPE_LABELS]}</TableCell>
                        <TableCell className="text-right">
                          {line.proposed_rate != null ? `$${line.proposed_rate.toFixed(2)}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter className="print:hidden gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Close
              </Button>
              <Button variant="outline" onClick={handleExportCSV}>
                <FileDown className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => window.print()}>
                <Download className="w-4 h-4 mr-2" />
                Print / Save PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Debug Panel */}
        <ProposalDebugPanel 
          proposalId={proposalId} 
          debugState={debugState} 
          onClear={clearDebug} 
        />
      </div>
    </AppLayout>
  );
}
