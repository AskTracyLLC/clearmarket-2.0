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
import { Switch } from "@/components/ui/switch";
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
  duplicateProposal,
  VendorProposal,
  VendorProposalLine,
  ORDER_TYPE_LABELS,
  ORDER_TYPES,
  fetchConnectedReps,
  fetchRepPricing,
  findRepCostForLine,
  syncRepCostsToProposal,
  syncAllRepCostsToProposal,
  previewAutoPrice,
  applyAutoPrice,
  RepPricingRow,
  OrderType,
  CompareMode,
  CostBasis,
  MarkupType,
  AutoPricePreviewResult,
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
  RefreshCw,
  Users,
  Calculator,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  HelpCircle,
  Link2,
} from "lucide-react";
import { ShareProposalDialog } from "@/components/ShareProposalDialog";
import { PaidFeatureBadge } from "@/components/PaidFeatureBadge";
import { vendorProposalsCopy as proposalCopy } from "@/copy/vendorProposalsCopy";
import { usePaidFeature } from "@/hooks/usePaidFeature";
import { OutOfCreditsDialog } from "@/components/OutOfCreditsDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  // Paid feature gating (Compare + CSV export)
  const comparePaid = usePaidFeature("proposal_compare", {
    cost: 1,
    actionType: "proposal_compare_refresh",
    metadata: { proposal_id: proposalId },
    isBetaFree: true,
  });
  const csvPaid = usePaidFeature("proposal_csv_export", {
    cost: 1,
    actionType: "proposal_csv_export",
    metadata: { proposal_id: proposalId },
    isBetaFree: true,
  });

  // Export state
  const [exportStyle, setExportStyle] = useState<"matrix" | "detailed">("matrix");

  // Rep Pricing Reference state
  const [connectedReps, setConnectedReps] = useState<{ id: string; name: string }[]>([]);
  const [compareMode, setCompareMode] = useState<CompareMode>("lowest");
  const [selectedRepId, setSelectedRepId] = useState<string>("");
  const [repPricing, setRepPricing] = useState<RepPricingRow[]>([]);
  const [syncingRepCosts, setSyncingRepCosts] = useState(false);
  const [showBelowCostOnly, setShowBelowCostOnly] = useState(false);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [repSearchQuery, setRepSearchQuery] = useState("");

  // Auto-Price state
  const [autoPriceCostBasis, setAutoPriceCostBasis] = useState<CostBasis>("highest");
  const [autoPriceMarkupType, setAutoPriceMarkupType] = useState<MarkupType>("dollar");
  const [autoPriceMarkupValue, setAutoPriceMarkupValue] = useState("");
  const [autoPriceScope, setAutoPriceScope] = useState<"selected" | "filtered" | "all">("all");
  const [autoPriceOverwrite, setAutoPriceOverwrite] = useState(false);
  const [autoPricePreview, setAutoPricePreview] = useState<AutoPricePreviewResult | null>(null);
  const [autoPriceLoading, setAutoPriceLoading] = useState(false);
  const [autoPriceConfirmOpen, setAutoPriceConfirmOpen] = useState(false);

  // Duplicate dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateClientName, setDuplicateClientName] = useState("");
  const [duplicateKeepAsTemplate, setDuplicateKeepAsTemplate] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Sort state
  type SortField = "state" | "county" | "order_type" | "proposed_rate" | "rep_cost" | "margin" | "approved_rate";
  const [sortField, setSortField] = useState<SortField>("state");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Open duplicate dialog with defaults
  const openDuplicateDialog = () => {
    setDuplicateName(`${name} (Copy)`);
    setDuplicateClientName("");
    setDuplicateKeepAsTemplate(false);
    setDuplicateDialogOpen(true);
  };

  // Handle duplicate submission
  const handleDuplicate = async () => {
    if (!proposal || !duplicateName.trim()) {
      toast.error("Please enter a proposal name");
      return;
    }
    
    setDuplicating(true);
    try {
      const newProposal = await duplicateProposal(proposal.id, {
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

  // Toggle template status
  const handleToggleTemplate = async (checked: boolean) => {
    if (!proposal) return;
    try {
      await updateProposal(proposal.id, { is_template: checked, status: checked ? "draft" : proposal.status });
      toast.success(checked ? "Saved as template" : "No longer a template");
      await loadProposal();
    } catch (err: any) {
      console.error("[Template] Toggle failed:", err);
      toast.error(`Failed to update: ${err.message}`);
    }
  };

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

  // Print to PDF - opens clean window for single-page output
  const handlePrintExport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Pop-up blocked. Please allow pop-ups for printing.");
      return;
    }

    const effectiveDateStr = proposal?.effective_as_of 
      ? format(new Date(proposal.effective_as_of), "MMMM d, yyyy") 
      : "";

    // Build table HTML based on export style
    let tableHtml = "";
    if (exportStyle === "matrix") {
      tableHtml = `
        <table>
          <thead>
            <tr class="header-group">
              <th colspan="2" style="text-align:center;border-right:2px solid #999;">Coverage Proposal</th>
              <th colspan="3" style="text-align:center;">Order Type Rates</th>
            </tr>
            <tr>
              <th style="width:150px;">State</th>
              <th style="border-right:1px solid #ddd;">County</th>
              <th style="text-align:right;width:100px;">Standard</th>
              <th style="text-align:right;width:100px;">Appt-based</th>
              <th style="text-align:right;width:100px;">Rush</th>
            </tr>
          </thead>
          <tbody>
            ${matrixRows.map(row => `
              <tr>
                <td>${row.stateDisplay}</td>
                <td style="border-right:1px solid #ddd;">${row.countyDisplay}</td>
                <td style="text-align:right;">${row.standard || ""}</td>
                <td style="text-align:right;">${row.appointment || ""}</td>
                <td style="text-align:right;">${row.rush || ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>County</th>
              <th>Order Type</th>
              <th style="text-align:right;">Rate</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map(line => `
              <tr>
                <td>${line.state_name} (${line.state_code})</td>
                <td>${line.is_all_counties ? "All counties" : line.county_name}</td>
                <td>${ORDER_TYPE_LABELS[line.order_type as keyof typeof ORDER_TYPE_LABELS]}</td>
                <td style="text-align:right;">${line.proposed_rate != null ? `$${line.proposed_rate.toFixed(2)}` : ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${name || "Proposal"}</title>
        <style>
          @page { margin: 12mm; size: letter; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11pt; line-height: 1.4; color: #000; margin: 0; padding: 0; }
          .header { margin-bottom: 16px; }
          .header h1 { font-size: 18pt; margin: 0 0 4px 0; }
          .header p { margin: 2px 0; color: #444; }
          .disclaimer { background: #f5f5f5; border: 1px solid #ddd; padding: 10px; margin: 12px 0; border-radius: 4px; font-size: 10pt; }
          table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f0f0f0; font-weight: 600; }
          .header-group th { background: #e0e0e0; }
          tbody tr:nth-child(even) { background: #fafafa; }
          .pdf-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9pt; color: #888; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${name || "Coverage Proposal"}</h1>
          ${clientName ? `<p><strong>Client:</strong> ${clientName}</p>` : ""}
          ${effectiveDateStr ? `<p><strong>Effective:</strong> ${effectiveDateStr}</p>` : ""}
        </div>
        ${disclaimer ? `<div class="disclaimer">${disclaimer}</div>` : ""}
        ${tableHtml}
        <div class="pdf-footer">
          Prepared in ClearMarket
        </div>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // CSV Export handler - Excel-safe with UTF-8 BOM (internal logic)
  const executeCSVExport = () => {
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

  // CSV Export with paid feature gating
  const handleExportCSV = async () => {
    if (!lines.length) {
      toast.error("No data to export");
      return;
    }
    const res = await csvPaid.consume();
    if (!res.ok) return;
    await executeCSVExport();
  };

  // Load connected reps on mount
  useEffect(() => {
    if (user?.id) {
      fetchConnectedReps(user.id)
        .then(setConnectedReps)
        .catch((err) => console.error("[RepPricing] Failed to load connected reps:", err));
    }
  }, [user?.id]);

  // Load rep pricing when rep is selected
  useEffect(() => {
    if (user?.id && selectedRepId) {
      fetchRepPricing(user.id, selectedRepId)
        .then(setRepPricing)
        .catch((err) => {
          console.error("[RepPricing] Failed to load rep pricing:", err);
          setRepPricing([]);
        });
    } else {
      setRepPricing([]);
    }
  }, [user?.id, selectedRepId]);

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

  // Rep selection handler for specific rep mode
  const handleRepSelect = (repId: string) => {
    const actualId = repId === "none" ? "" : repId;
    setSelectedRepId(actualId);
  };

  // Sync rep costs to proposal lines (internal logic)
  const executeSyncRepCosts = async () => {
    if (!proposal || !user?.id) return;
    
    // Validate specific mode has rep selected
    if (compareMode === "specific" && !selectedRepId) {
      toast.error("Please select a rep to compare against");
      return;
    }
    
    setSyncingRepCosts(true);
    setSyncConfirmOpen(false);
    
    try {
      const result = await syncAllRepCostsToProposal(
        proposal.id,
        user.id,
        compareMode,
        compareMode === "specific" ? selectedRepId : undefined
      );
      
      if (result.errors.length > 0) {
        toast.warning(`Synced ${result.repsProcessed} reps, ${result.linesUpdated} lines updated, ${result.errors.length} errors`);
      } else if (result.linesUpdated > 0) {
        toast.success(
          `Synced pricing from ${result.repsProcessed} reps. ${result.linesUpdated} lines updated.${
            result.warningsCount > 0 ? ` ${result.warningsCount} below cost.` : ""
          }`
        );
      } else if (result.repsProcessed === 0) {
        toast.info("No connected reps with active pricing found");
      } else {
        toast.info(`Processed ${result.repsProcessed} reps - no changes needed`);
      }
      loadProposal();
    } catch (err: any) {
      console.error("[RepPricing] Sync failed:", err);
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncingRepCosts(false);
    }
  };

  // Sync rep costs with paid feature gating
  const handleSyncRepCosts = async () => {
    const res = await comparePaid.consume();
    if (!res.ok) return;
    await executeSyncRepCosts();
  };

  // Compute lines with rep cost info (use baseline from DB)
  const linesWithRepCost = useMemo(() => {
    return lines.map((line) => {
      const baseline = line.internal_rep_rate_baseline;
      const margin = baseline != null ? line.proposed_rate - baseline : null;
      return { ...line, repCost: baseline, margin, repWarning: null };
    });
  }, [lines]);

  // Count lines below rep cost
  const belowCostCount = useMemo(() => {
    return linesWithRepCost.filter((l) => l.repCost != null && l.proposed_rate < l.repCost).length;
  }, [linesWithRepCost]);

  // Get target line IDs for auto-price based on scope
  const getAutoPriceTargetIds = (): string[] => {
    switch (autoPriceScope) {
      case "selected":
        return Array.from(selectedLineIds);
      case "filtered":
        return filteredLines.map((l) => l.id);
      case "all":
      default:
        return lines.map((l) => l.id);
    }
  };

  // Validate markup value input
  const handleMarkupValueChange = (value: string) => {
    // Allow empty, digits, and up to 2 decimal places
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setAutoPriceMarkupValue(value);
      setAutoPricePreview(null);
    }
  };

  // Preview auto-price changes
  const handleAutoPricePreview = async () => {
    if (!proposal) return;
    
    const markupNum = parseFloat(autoPriceMarkupValue) || 0;
    if (markupNum <= 0) {
      toast.error("Please enter a markup value greater than 0");
      return;
    }
    
    const targetIds = getAutoPriceTargetIds();
    if (targetIds.length === 0) {
      toast.error("No lines in scope to price");
      return;
    }
    
    setAutoPriceLoading(true);
    try {
      const result = await previewAutoPrice(
        proposal.id,
        targetIds,
        autoPriceCostBasis,
        autoPriceMarkupType,
        markupNum,
        autoPriceOverwrite
      );
      setAutoPricePreview(result);
      
      if (result.updateCount === 0) {
        toast.info(`No lines to update. ${result.skipReasons.noRepCost} have no rep cost, ${result.skipReasons.hasExistingRate} already have rates.`);
      }
    } catch (err: any) {
      console.error("[AutoPrice] Preview failed:", err);
      toast.error(`Preview failed: ${err.message}`);
    } finally {
      setAutoPriceLoading(false);
    }
  };

  // Apply auto-price changes
  const handleAutoPriceApply = async () => {
    if (!proposal) return;
    
    const markupNum = parseFloat(autoPriceMarkupValue) || 0;
    const targetIds = getAutoPriceTargetIds();
    
    setAutoPriceLoading(true);
    setAutoPriceConfirmOpen(false);
    
    try {
      const result = await applyAutoPrice(
        proposal.id,
        targetIds,
        autoPriceCostBasis,
        autoPriceMarkupType,
        markupNum,
        autoPriceOverwrite
      );
      
      if (result.errors.length > 0) {
        toast.warning(`Updated ${result.updatedCount} lines. ${result.errors.length} errors.`);
      } else {
        toast.success(`Updated ${result.updatedCount} lines. Skipped ${result.skippedCount} (no rep rates or existing rates).`);
      }
      
      // Reset preview state and below-cost filter, then reload data
      setAutoPricePreview(null);
      setShowBelowCostOnly(false);
      await loadProposal();
    } catch (err: any) {
      console.error("[AutoPrice] Apply failed:", err);
      toast.error(`Apply failed: ${err.message}`);
    } finally {
      setAutoPriceLoading(false);
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

  // Filtered and sorted lines - with rep cost data and optional below-cost filter
  const filteredLines = useMemo(() => {
    let result = linesWithRepCost;
    
    // Apply below-cost filter if active
    if (showBelowCostOnly) {
      result = result.filter((l) => l.repCost != null && l.proposed_rate < l.repCost);
    }
    
    // Apply state/order type/county filters
    result = result.filter((line) => {
      if (filterState !== "all" && line.state_code !== filterState) return false;
      if (filterOrderType !== "all" && line.order_type !== filterOrderType) return false;
      if (searchCounty && line.county_name) {
        if (!line.county_name.toLowerCase().includes(searchCounty.toLowerCase())) return false;
      }
      return true;
    });

    // Apply sorting
    const dir = sortDirection === "asc" ? 1 : -1;
    return result.sort((a, b) => {
      switch (sortField) {
        case "state":
          return dir * a.state_code.localeCompare(b.state_code);
        case "county": {
          const aCounty = a.is_all_counties ? "" : (a.county_name || "");
          const bCounty = b.is_all_counties ? "" : (b.county_name || "");
          return dir * aCounty.localeCompare(bCounty);
        }
        case "order_type":
          return dir * a.order_type.localeCompare(b.order_type);
        case "proposed_rate":
          return dir * ((a.proposed_rate || 0) - (b.proposed_rate || 0));
        case "rep_cost":
          return dir * ((a.repCost || 0) - (b.repCost || 0));
        case "margin":
          return dir * ((a.margin || 0) - (b.margin || 0));
        case "approved_rate":
          return dir * ((a.approved_rate || 0) - (b.approved_rate || 0));
        default:
          return 0;
      }
    });
  }, [linesWithRepCost, filterState, filterOrderType, searchCounty, showBelowCostOnly, sortField, sortDirection]);

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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <PageHeader
            title={isNew ? "New Proposal" : name || "Proposal"}
            backTo="/vendor/proposals"
            backLabel="Proposals"
          >
            {getStatusBadge()}
          </PageHeader>
          {!isNew && proposal && (
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setShareDialogOpen(true)}>
                      <Link2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">{proposalCopy.shareButton.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {proposalCopy.shareButton.body}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" onClick={openDuplicateDialog}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
            </div>
          )}
        </div>

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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
              
              {/* Template Toggle - only for saved proposals */}
              {proposal && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="template-toggle"
                      checked={proposal.is_template}
                      onCheckedChange={handleToggleTemplate}
                    />
                    <Label htmlFor="template-toggle" className="cursor-pointer">Save as Template</Label>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Templates are reusable drafts you can duplicate for clients.
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lines Section - only show after proposal is created */}
        {proposal && (
          <>
            {/* Rep Pricing Reference Card */}
            {connectedReps.length > 0 && (
            <Card className="border-secondary/30 bg-secondary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-secondary" />
                    Compare Against Field Rep Pricing
                    <PaidFeatureBadge />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Run a quick sanity check against current rep costs to catch margin loss.
                  </p>
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* Compare Mode Selector */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Compare Against</Label>
                      <Select value={compareMode} onValueChange={(v) => setCompareMode(v as CompareMode)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lowest">Lowest Rep Cost</SelectItem>
                          <SelectItem value="average">Average Rep Cost</SelectItem>
                          <SelectItem value="specific">Specific Rep</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Specific Rep Selector - only shown when mode is specific */}
                    {compareMode === "specific" && (
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground">Select Rep</Label>
                        <Select value={selectedRepId || "none"} onValueChange={handleRepSelect}>
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Choose a rep..." />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 py-1.5">
                              <Input
                                placeholder="Search reps..."
                                value={repSearchQuery}
                                onChange={(e) => setRepSearchQuery(e.target.value)}
                                className="h-8"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <SelectItem value="none">None</SelectItem>
                            {connectedReps
                              .filter((rep) =>
                                rep.name.toLowerCase().includes(repSearchQuery.toLowerCase())
                              )
                              .map((rep) => (
                                <SelectItem key={rep.id} value={rep.id}>
                                  {rep.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Sync Button */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground invisible">Action</Label>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => {
                          if (lines.length > 0) {
                            setSyncConfirmOpen(true);
                          } else {
                            toast.info("Add proposal lines first before syncing rep costs");
                          }
                        }}
                        disabled={syncingRepCosts || (compareMode === "specific" && !selectedRepId)}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${syncingRepCosts ? "animate-spin" : ""}`} />
                        Sync Rep Rates ({connectedReps.length} reps)
                      </Button>
                    </div>
                  </div>
                  
                  {/* Rep count info */}
                  <p className="text-xs text-muted-foreground">
                    {compareMode === "lowest" && `Will use the lowest rate from your ${connectedReps.length} connected reps for each line.`}
                    {compareMode === "average" && `Will calculate the average rate across your ${connectedReps.length} connected reps for each line.`}
                    {compareMode === "specific" && selectedRepId && 
                      `Will use rates from ${connectedReps.find(r => r.id === selectedRepId)?.name || "selected rep"} only.`}
                    {compareMode === "specific" && !selectedRepId && 
                      "Select a specific rep to compare against."}
                  </p>
                  
                  {/* Privacy footer for Rep Pricing panel */}
                  <p className="text-xs text-muted-foreground/70 border-t border-border/50 pt-3 mt-2">
                    <Lock className="w-3 h-3 inline mr-1" />
                    Internal only: Field Reps and clients do not see Rep Cost, Margin, or proposal pricing.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Auto-Price Card */}
            {lines.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    Auto-Price (Markup above Rep Cost)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Automatically set proposed rates based on a markup above rep cost. Requires synced rep rates.
                  </p>
                  
                  <div className="flex flex-wrap gap-4 items-end">
                    {/* Cost Basis */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Cost Basis</Label>
                      <Select value={autoPriceCostBasis} onValueChange={(v) => { setAutoPriceCostBasis(v as CostBasis); setAutoPricePreview(null); }}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="highest">Highest Rep Cost</SelectItem>
                          <SelectItem value="average">Average Rep Cost</SelectItem>
                          <SelectItem value="lowest">Lowest Rep Cost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Markup Type */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Markup Type</Label>
                      <Select value={autoPriceMarkupType} onValueChange={(v) => { setAutoPriceMarkupType(v as MarkupType); setAutoPricePreview(null); }}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dollar">+ $</SelectItem>
                          <SelectItem value="percent">+ %</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Markup Value */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Markup {autoPriceMarkupType === "dollar" ? "($)" : "(%)"}
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={autoPriceMarkupType === "dollar" ? "e.g. 25" : "e.g. 15"}
                        value={autoPriceMarkupValue}
                        onChange={(e) => handleMarkupValueChange(e.target.value)}
                        className="w-[100px]"
                      />
                    </div>
                    
                    {/* Apply Scope */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Apply To</Label>
                      <Select value={autoPriceScope} onValueChange={(v) => { setAutoPriceScope(v as "selected" | "filtered" | "all"); setAutoPricePreview(null); }}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="selected" disabled={selectedLineIds.size === 0}>
                            Selected ({selectedLineIds.size})
                          </SelectItem>
                          <SelectItem value="filtered">
                            Filtered ({filteredLines.length})
                          </SelectItem>
                          <SelectItem value="all">
                            All Lines ({lines.length})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Overwrite Toggle */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="autoprice-overwrite"
                        checked={autoPriceOverwrite}
                        onCheckedChange={(checked) => { setAutoPriceOverwrite(!!checked); setAutoPricePreview(null); }}
                      />
                      <Label htmlFor="autoprice-overwrite" className="text-sm cursor-pointer">
                        Overwrite existing rates
                      </Label>
                    </div>
                  </div>
                  
                  {/* Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAutoPricePreview}
                      disabled={autoPriceLoading || !autoPriceMarkupValue}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Changes
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        if (!autoPricePreview || autoPricePreview.updateCount === 0) {
                          toast.info("Run preview first to see what will be updated");
                          return;
                        }
                        setAutoPriceConfirmOpen(true);
                      }}
                      disabled={autoPriceLoading || !autoPricePreview || autoPricePreview.updateCount === 0}
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      Apply Markup
                    </Button>
                  </div>
                  
                  {/* Preview Results */}
                  {autoPricePreview && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg space-y-3">
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Will update: </span>
                          <span className="font-medium text-primary">{autoPricePreview.updateCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Will skip: </span>
                          <span className="font-medium">{autoPricePreview.skipCount}</span>
                          {autoPricePreview.skipReasons.noRepCost > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({autoPricePreview.skipReasons.noRepCost} no rep cost)
                            </span>
                          )}
                          {autoPricePreview.skipReasons.hasExistingRate > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({autoPricePreview.skipReasons.hasExistingRate} have rates)
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {autoPricePreview.previewLines.length > 0 && (
                        <div className="overflow-x-auto">
                          <Table className="text-sm">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="py-1">State</TableHead>
                                <TableHead className="py-1">County</TableHead>
                                <TableHead className="py-1">Type</TableHead>
                                <TableHead className="py-1 text-right">Rep Cost</TableHead>
                                <TableHead className="py-1 text-right">Old Rate</TableHead>
                                <TableHead className="py-1 text-right">New Rate</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {autoPricePreview.previewLines.map((line) => (
                                <TableRow key={line.lineId}>
                                  <TableCell className="py-1">{line.stateCode}</TableCell>
                                  <TableCell className="py-1">{line.countyName || "All"}</TableCell>
                                  <TableCell className="py-1 capitalize">{line.orderType}</TableCell>
                                  <TableCell className="py-1 text-right">${line.repCost.toFixed(2)}</TableCell>
                                  <TableCell className="py-1 text-right text-muted-foreground">
                                    {line.oldRate != null ? `$${line.oldRate.toFixed(2)}` : "—"}
                                  </TableCell>
                                  <TableCell className="py-1 text-right font-medium text-primary">
                                    ${line.newRate.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {autoPricePreview.updateCount > autoPricePreview.previewLines.length && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Showing first {autoPricePreview.previewLines.length} of {autoPricePreview.updateCount} lines
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Below Cost Warning Banner */}
            {belowCostCount > 0 && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-destructive">
                  {belowCostCount} line{belowCostCount !== 1 ? "s" : ""} below rep cost
                </AlertTitle>
                <AlertDescription className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    Some proposed rates are lower than your referenced rep pricing baseline.
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowBelowCostOnly(!showBelowCostOnly)}
                  >
                    {showBelowCostOnly ? "Show All" : "Filter to Warnings"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

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
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort("state")}
                      >
                        <div className="flex items-center gap-1">
                          State
                          {sortField === "state" ? (
                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort("county")}
                      >
                        <div className="flex items-center gap-1">
                          County
                          {sortField === "county" ? (
                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort("order_type")}
                      >
                        <div className="flex items-center gap-1">
                          Order Type
                          {sortField === "order_type" ? (
                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50 text-right"
                        onClick={() => handleSort("proposed_rate")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Proposed Rate
                          {sortField === "proposed_rate" ? (
                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      </TableHead>
                      {lines.some(l => l.internal_rep_rate_baseline !== null) && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TableHead 
                                  className="cursor-pointer select-none hover:bg-muted/50 text-right"
                                  onClick={() => handleSort("rep_cost")}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    Rep Cost (Baseline)
                                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    {sortField === "rep_cost" ? (
                                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                    ) : <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                                  </div>
                                </TableHead>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium mb-1">Internal cost reference</p>
                                <p className="text-xs text-muted-foreground">Rep Cost is for your internal planning only. It's never shown to Field Reps or clients.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TableHead 
                                  className="cursor-pointer select-none hover:bg-muted/50 text-right"
                                  onClick={() => handleSort("margin")}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    Margin
                                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    {sortField === "margin" ? (
                                      sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                    ) : <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                                  </div>
                                </TableHead>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium mb-1">Estimated margin</p>
                                <p className="text-xs text-muted-foreground">Margin = Proposed Rate − Current Rep Cost. This is an internal estimate, not shown to clients.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50 text-right"
                        onClick={() => handleSort("approved_rate")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Approved Limit
                          {sortField === "approved_rate" ? (
                            sortDirection === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      </TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLines.map((line) => {
                      const isAboveApproved = line.approved_rate !== null && line.proposed_rate > line.approved_rate;
                      const isBelowRepCost = line.repCost != null && line.proposed_rate < line.repCost;
                      return (
                        <TableRow 
                          key={line.id}
                          className={isBelowRepCost ? "bg-destructive/10" : ""}
                        >
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
                                type="text"
                                inputMode="decimal"
                                value={line.proposed_rate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                                    handleRateChange(line.id, val);
                                  }
                                }}
                                className="w-24 text-right"
                              />
                              {isBelowRepCost && (
                                <span title="Below rep cost">
                                  <AlertTriangle className="w-4 h-4 text-destructive" />
                                </span>
                              )}
                              {isAboveApproved && (
                                <span title="Above approved limit">
                                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {lines.some(l => l.internal_rep_rate_baseline !== null) && (
                            <>
                              <TableCell className="text-right">
                                {line.repCost != null ? (
                                  <span className="text-muted-foreground">${line.repCost.toFixed(2)}</span>
                                ) : line.repWarning ? (
                                  <span className="text-xs text-muted-foreground italic" title={line.repWarning}>—</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {line.margin != null ? (
                                  <span className={line.margin < 0 ? "text-destructive font-medium" : "text-green-500"}>
                                    {line.margin >= 0 ? "+" : ""}${line.margin.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </>
                          )}
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
                  type="text"
                  inputMode="decimal"
                  value={batchRate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
                      setBatchRate(val);
                    }
                  }}
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
                This is a preview of your proposal. Internal Rep Cost and Margin are not included in exports.
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
            {/* Export helper text */}
            <p className="text-xs text-muted-foreground mt-2">
              PDF export is branded for client sharing. Internal Rep Cost and Margin are not included.
            </p>
            <DialogFooter className="print:hidden gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Close
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={handleExportCSV} className="gap-2">
                      <FileDown className="w-4 h-4" />
                      Export CSV
                      <PaidFeatureBadge className="ml-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-medium">Export to CSV</p>
                    <p className="text-xs text-muted-foreground">Downloads a spreadsheet file for offline use.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handlePrintExport}>
                      <Download className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-medium">Print or Save as PDF</p>
                    <p className="text-xs text-muted-foreground">Exports a clean, client-ready PDF with ClearMarket branding.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sync Rep Costs Confirmation Dialog */}
        <Dialog open={syncConfirmOpen} onOpenChange={setSyncConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sync Rep Costs?</DialogTitle>
              <DialogDescription>
                {compareMode === "lowest" && 
                  `This will calculate the LOWEST cost from your ${connectedReps.length} connected reps for each proposal line.`}
                {compareMode === "average" && 
                  `This will calculate the AVERAGE cost across your ${connectedReps.length} connected reps for each proposal line.`}
                {compareMode === "specific" && 
                  `This will use costs from ${connectedReps.find(r => r.id === selectedRepId)?.name || "the selected rep"} only.`}
                <br />
                Lines with "manual override" notes will be skipped.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSyncConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSyncRepCosts} disabled={syncingRepCosts}>
                {syncingRepCosts ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Rep Rates
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Auto-Price Confirmation Dialog */}
        <Dialog open={autoPriceConfirmOpen} onOpenChange={setAutoPriceConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply Auto-Pricing?</DialogTitle>
              <DialogDescription>
                This will update {autoPricePreview?.updateCount || 0} proposal lines with calculated rates 
                based on {autoPriceCostBasis} rep cost + {autoPriceMarkupType === "dollar" ? `$${autoPriceMarkupValue}` : `${autoPriceMarkupValue}%`} markup.
                <br /><br />
                {autoPricePreview?.skipCount || 0} lines will be skipped (no rep cost or already have rates).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAutoPriceConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAutoPriceApply} disabled={autoPriceLoading}>
                {autoPriceLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    Apply to {autoPricePreview?.updateCount || 0} Lines
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Duplicate Proposal Dialog */}
        <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicate Proposal</DialogTitle>
              <DialogDescription>
                Create a new proposal based on this one. All coverage lines and rates will be copied.
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
        <ProposalDebugPanel 
          proposalId={proposalId} 
          debugState={debugState} 
          onClear={clearDebug} 
        />

        {/* Share Proposal Dialog */}
        {proposal && (
          <ShareProposalDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            proposalId={proposal.id}
            proposalName={name}
            proposalStatus={proposal.status}
          />
        )}

        {/* Out of Credits Dialogs */}
        <OutOfCreditsDialog
          open={comparePaid.outOfCreditsOpen}
          onOpenChange={comparePaid.setOutOfCreditsOpen}
        />
        <OutOfCreditsDialog
          open={csvPaid.outOfCreditsOpen}
          onOpenChange={csvPaid.setOutOfCreditsOpen}
        />
      </div>
    </AppLayout>
  );
}
