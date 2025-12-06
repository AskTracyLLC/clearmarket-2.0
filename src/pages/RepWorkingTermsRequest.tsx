import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { ArrowLeft, Plus, Trash2, AlertCircle } from "lucide-react";
import {
  fetchRepCoverageRows,
  declineWorkingTermsRequest,
  submitWorkingTermsRows,
  repConfirmWorkingTerms,
  inactivateWorkingTermsRow,
  proposeWorkingTermsChange,
  acceptWorkingTermsChange,
  declineWorkingTermsChange,
  fetchPendingChangeRequest,
  INSPECTION_TYPES,
  INSPECTION_TYPE_LABELS,
  WorkingTermsRow,
  WorkingTermsChangeRequest,
} from "@/lib/workingTerms";
import ActiveWorkingTermsTable from "@/components/ActiveWorkingTermsTable";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

interface CoverageRow {
  id: string;
  state_code: string;
  county_name: string | null;
  inspection_type: string;
  rate: number | null;
  turnaround_days: number | null;
  selected: boolean;
  source: 'from_profile' | 'added_by_vendor' | 'added_by_rep';
  effective_from?: string;
  status?: string;
  inactivated_at?: string | null;
  inactivated_reason?: string | null;
}

const RepWorkingTermsRequest = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [vendorName, setVendorName] = useState("");
  const [existingRows, setExistingRows] = useState<any[]>([]);

  // Filter state
  const [stateFilter, setStateFilter] = useState<string>("");
  const [inspectionTypeFilter, setInspectionTypeFilter] = useState<string[]>([]);

  // Coverage rows
  const [coverageRows, setCoverageRows] = useState<CoverageRow[]>([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  // Active terms view
  const [activeTermsRows, setActiveTermsRows] = useState<WorkingTermsRow[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<string, WorkingTermsChangeRequest>>(new Map());

  // Save options
  const [saveOption, setSaveOption] = useState<"vendor_only" | "update_profile">("vendor_only");

  // Decline dialog
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (user && requestId) {
      loadRequest();
    }
  }, [user, authLoading, requestId]);

  const loadRequest = async () => {
    if (!requestId) return;

    const { data: req, error } = await supabase
      .from("working_terms_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (error || !req) {
      toast({ title: "Error", description: "Request not found.", variant: "destructive" });
      navigate("/rep/my-vendors");
      return;
    }

    // Check user is the rep
    if (req.rep_id !== user?.id) {
      toast({ title: "Access denied", variant: "destructive" });
      navigate("/dashboard");
      return;
    }

    // Check if request is in a valid state for this page
    if (!["pending_rep", "pending_vendor", "pending_rep_confirm", "active"].includes(req.status)) {
      toast({ title: "Request unavailable", description: "This request has been declined or is no longer accessible.", variant: "destructive" });
      navigate("/rep/my-vendors");
      return;
    }

    setRequest(req);

    // Get vendor name
    const { data: vendorProfile } = await supabase
      .from("vendor_profile")
      .select("company_name")
      .eq("user_id", req.vendor_id)
      .single();

    setVendorName(vendorProfile?.company_name || "Vendor");

    // If pending_rep_confirm or active, load existing rows
    if (req.status === "pending_rep_confirm" || req.status === "active" || req.status === "pending_vendor") {
      const { data: rows } = await supabase
        .from("working_terms_rows")
        .select("*")
        .eq("working_terms_request_id", requestId);

      setExistingRows(rows || []);
      
      // For active status, set as WorkingTermsRow[] for the new table view
      if (req.status === "active") {
        setActiveTermsRows((rows || []) as WorkingTermsRow[]);
        
        // Load pending change requests for each row
        const changesMap = new Map<string, WorkingTermsChangeRequest>();
        for (const row of rows || []) {
          const change = await fetchPendingChangeRequest(row.id);
          if (change) {
            changesMap.set(row.id, change);
          }
        }
        setPendingChanges(changesMap);
      } else {
        setCoverageRows(
          (rows || []).map((r: any) => ({
            id: r.id,
            state_code: r.state_code,
            county_name: r.county_name,
            inspection_type: r.inspection_type,
            rate: r.rate,
            turnaround_days: r.turnaround_days,
            selected: r.included ?? true,
            source: r.source,
            effective_from: r.effective_from,
            status: r.status,
            inactivated_at: r.inactivated_at,
            inactivated_reason: r.inactivated_reason,
          }))
        );
      }
    }

    setLoading(false);
  };

  // Handlers for active terms management
  const handleInactivateRow = async (rowId: string, reason: string) => {
    const { error } = await inactivateWorkingTermsRow(rowId, reason, user!.id, "rep");
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Area inactivated", description: "The vendor has been notified." });
    loadRequest();
  };

  const handleProposeChange = async (rowId: string, data: {
    newRate: number | null;
    newTurnaround: number | null;
    effectiveFrom: string;
    reason: string;
  }) => {
    const { error } = await proposeWorkingTermsChange(rowId, user!.id, "rep", data);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Change proposed", description: "The vendor will review your proposal." });
    loadRequest();
  };

  const handleAcceptChange = async (changeRequestId: string) => {
    const { error } = await acceptWorkingTermsChange(changeRequestId, user!.id);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Terms updated", description: "The new terms are now active." });
    loadRequest();
  };

  const handleDeclineChange = async (changeRequestId: string, reason: string) => {
    const { error } = await declineWorkingTermsChange(changeRequestId, user!.id, reason);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Change declined", description: "The requester has been notified." });
    loadRequest();
  };

  const handleLoadCoverage = async () => {
    if (!stateFilter) {
      toast({ title: "Select a state", description: "Please select a state to load coverage data.", variant: "destructive" });
      return;
    }

    setLoadingCoverage(true);

    const rows = await fetchRepCoverageRows(
      user!.id,
      stateFilter,
      undefined,
      inspectionTypeFilter.length > 0 ? inspectionTypeFilter : undefined
    );

    setCoverageRows(
      rows.map((r, i) => ({
        id: `temp-${i}`,
        ...r,
        // Ensure inspection_type has a valid value
        inspection_type: r.inspection_type || "property",
        selected: true, // Auto-select loaded rows
        source: 'from_profile' as const,
      }))
    );

    setLoadingCoverage(false);
  };

  const handleAddRow = () => {
    setCoverageRows(prev => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        state_code: stateFilter || "",
        county_name: null,
        inspection_type: "property",
        rate: null,
        turnaround_days: null,
        selected: true,
        source: 'added_by_rep' as const,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setCoverageRows(prev => prev.filter(r => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof CoverageRow, value: any) => {
    setCoverageRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleDecline = async () => {
    if (!requestId) return;
    setDeclining(true);

    const { error } = await declineWorkingTermsRequest(requestId, declineReason.trim() || null);

    setDeclining(false);
    setShowDeclineDialog(false);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }

    toast({ title: "Request declined" });
    navigate("/rep/my-vendors");
  };

  const handleSubmit = async () => {
    if (!requestId) return;

    const selectedRows = coverageRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      toast({ title: "Select rows", description: "Please select at least one row to send.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { error } = await submitWorkingTermsRows(
      requestId,
      selectedRows,
      saveOption === "update_profile"
    );

    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }

    toast({ title: "Working terms sent", description: `Coverage & pricing sent to ${vendorName}.` });
    navigate("/rep/my-vendors");
  };

  const handleConfirm = async () => {
    if (!requestId) return;

    const selectedRows = coverageRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      toast({ title: "Select rows", description: "Please select at least one row to confirm.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { error } = await repConfirmWorkingTerms(
      requestId,
      selectedRows.map(r => r.id)
    );

    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }

    toast({ title: "Working terms confirmed" });
    navigate("/rep/my-vendors");
  };

  if (authLoading || loading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthenticatedLayout>
    );
  }

  const isPendingRep = request?.status === "pending_rep";
  const isPendingRepConfirm = request?.status === "pending_rep_confirm";
  const isPendingVendor = request?.status === "pending_vendor";
  const isActive = request?.status === "active";
  const isReadOnly = isPendingVendor || isActive;

  const getPageTitle = () => {
    if (isActive) return "Working Terms";
    if (isPendingRepConfirm) return "Review Working Terms";
    if (isPendingVendor) return "Working Terms (Sent)";
    return "Respond to Coverage Request";
  };

  return (
    <AuthenticatedLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rep/my-vendors")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
              {isActive && (
                <Badge variant="default" className="bg-green-600">Active</Badge>
              )}
              {isPendingVendor && (
                <Badge variant="outline">Waiting for vendor</Badge>
              )}
              {isPendingRepConfirm && (
                <Badge variant="default">Action required</Badge>
              )}
            </div>
            <p className="text-muted-foreground">With {vendorName}</p>
          </div>
        </div>

        {/* Active Terms View (for active status) */}
        {isActive && activeTermsRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Coverage & Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActiveWorkingTermsTable
                rows={activeTermsRows}
                pendingChanges={pendingChanges}
                role="rep"
                otherPartyName={vendorName}
                onInactivate={handleInactivateRow}
                onProposeChange={handleProposeChange}
                onAcceptChange={handleAcceptChange}
                onDeclineChange={handleDeclineChange}
              />
              <p className="text-xs text-muted-foreground/80 italic">
                Informational only — not a contract, guarantee of work, or employment agreement.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Vendor Request Summary (for non-active states) */}
        {!isActive && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {request?.message_from_vendor && (
                <p className="text-sm italic text-foreground">"{request.message_from_vendor}"</p>
              )}
              <p className="text-sm">
                <span className="text-muted-foreground">Requested states:</span>{" "}
                {request?.requested_states?.join(", ")}
              </p>
              {request?.requested_counties?.length > 0 && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Requested counties:</span>{" "}
                  {request.requested_counties.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Decline Option (for pending_rep) */}
        {isPendingRep && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Not interested in sharing coverage with this vendor?
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowDeclineDialog(true)}>
                  Decline request
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter Bar (for pending_rep only) */}
        {isPendingRep && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Load Your Coverage Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>State (required)</Label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Inspection types (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {INSPECTION_TYPES.map(t => (
                      <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={inspectionTypeFilter.includes(t.value)}
                          onCheckedChange={(checked) => {
                            setInspectionTypeFilter(prev =>
                              checked
                                ? [...prev, t.value]
                                : prev.filter(v => v !== t.value)
                            );
                          }}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-end">
                  <Button onClick={handleLoadCoverage} disabled={!stateFilter || loadingCoverage}>
                    {loadingCoverage ? "Loading..." : "Load coverage"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coverage Table */}
        {coverageRows.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Coverage & Pricing</CardTitle>
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={handleAddRow}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add row
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {!isReadOnly && <th className="px-3 py-2 text-left font-medium w-12">Select</th>}
                      <th className="px-3 py-2 text-left font-medium">State</th>
                      <th className="px-3 py-2 text-left font-medium">County</th>
                      <th className="px-3 py-2 text-left font-medium">Inspection Type</th>
                      <th className="px-3 py-2 text-left font-medium w-24">Rate ($)</th>
                      <th className="px-3 py-2 text-left font-medium w-28">Turnaround</th>
                      {(isPendingRepConfirm || isReadOnly) && <th className="px-3 py-2 text-left font-medium">Source</th>}
                      {!isReadOnly && <th className="px-3 py-2 w-12"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {coverageRows.map(row => (
                      <tr key={row.id} className={row.source === 'added_by_vendor' ? 'bg-amber-500/5' : ''}>
                        {!isReadOnly && (
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={row.selected}
                              onCheckedChange={(checked) => handleRowChange(row.id, 'selected', !!checked)}
                            />
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {isReadOnly ? (
                            <span className="text-sm">{row.state_code}</span>
                          ) : (
                            <Select
                              value={row.state_code}
                              onValueChange={(v) => handleRowChange(row.id, 'state_code', v)}
                            >
                              <SelectTrigger className="h-8 w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {US_STATES.map(s => (
                                  <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isReadOnly ? (
                            <span className="text-sm">{row.county_name || "All"}</span>
                          ) : (
                            <Input
                              value={row.county_name || ""}
                              onChange={(e) => handleRowChange(row.id, 'county_name', e.target.value || null)}
                              placeholder="All"
                              className="h-8 w-32"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isReadOnly ? (
                            <span className="text-sm">{INSPECTION_TYPE_LABELS[row.inspection_type] || row.inspection_type}</span>
                          ) : (
                            <Select
                              value={row.inspection_type}
                              onValueChange={(v) => handleRowChange(row.id, 'inspection_type', v)}
                            >
                              <SelectTrigger className="h-8 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INSPECTION_TYPES.map(t => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isReadOnly ? (
                            <span className="text-sm">{row.rate != null ? `$${row.rate}` : "—"}</span>
                          ) : (
                            <Input
                              type="number"
                              value={row.rate ?? ""}
                              onChange={(e) => handleRowChange(row.id, 'rate', e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="—"
                              className="h-8 w-20"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isReadOnly ? (
                            <span className="text-sm">{row.turnaround_days != null ? `${row.turnaround_days} days` : "—"}</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={row.turnaround_days ?? ""}
                                onChange={(e) => handleRowChange(row.id, 'turnaround_days', e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="—"
                                className="h-8 w-16"
                              />
                              <span className="text-xs text-muted-foreground">days</span>
                            </div>
                          )}
                        </td>
                        {(isPendingRepConfirm || isReadOnly) && (
                          <td className="px-3 py-2">
                            {row.source === 'added_by_vendor' && (
                              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                                Added by vendor
                              </Badge>
                            )}
                            {row.source === 'from_profile' && (
                              <Badge variant="secondary" className="text-xs">From profile</Badge>
                            )}
                            {row.source === 'added_by_rep' && (
                              <Badge variant="secondary" className="text-xs">Added by you</Badge>
                            )}
                          </td>
                        )}
                        {!isReadOnly && (
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveRow(row.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {coverageRows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No coverage found for this filter. Adjust the state/county/inspection type or add rows manually.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Save Options (for pending_rep only) */}
        {isPendingRep && coverageRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How should these edits be saved?</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={saveOption} onValueChange={(v) => setSaveOption(v as any)}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="vendor_only" id="vendor_only" />
                  <label htmlFor="vendor_only" className="cursor-pointer">
                    <p className="font-medium text-sm">Only for this vendor (vendor-specific working terms)</p>
                    <p className="text-xs text-muted-foreground">
                      These values only apply to this vendor's working terms.
                    </p>
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="update_profile" id="update_profile" />
                  <label htmlFor="update_profile" className="cursor-pointer">
                    <p className="font-medium text-sm">Update my profile coverage & pricing (permanent)</p>
                    <p className="text-xs text-muted-foreground">
                      Permanent updates change your main coverage profile.
                    </p>
                  </label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Disclaimer & Actions */}
        {coverageRows.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground/80 italic">
                These working terms are shared for reference only and do not create an employment relationship, contract, or guarantee of work.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate("/rep/my-vendors")}>
                  {isReadOnly ? "Back to My Vendors" : "Cancel"}
                </Button>
                {isPendingRep && (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || coverageRows.filter(r => r.selected).length === 0}
                  >
                    {submitting ? "Sending..." : "Send working terms to vendor"}
                  </Button>
                )}
                {isPendingRepConfirm && (
                  <Button
                    onClick={handleConfirm}
                    disabled={submitting || coverageRows.filter(r => r.selected).length === 0}
                  >
                    {submitting ? "Confirming..." : "Confirm working terms"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decline Dialog */}
        <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Decline this request?</AlertDialogTitle>
              <AlertDialogDescription>
                Let {vendorName} know you're not sharing coverage at this time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="decline-reason">Reason (optional)</Label>
              <Textarea
                id="decline-reason"
                placeholder="e.g. 'I don't cover that area currently.'"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={2}
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={declining}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDecline} disabled={declining}>
                {declining ? "Declining..." : "Decline request"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AuthenticatedLayout>
  );
};

export default RepWorkingTermsRequest;
