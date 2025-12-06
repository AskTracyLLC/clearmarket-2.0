import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedLayout } from "@/components/AuthenticatedLayout";
import { ArrowLeft, Plus, Trash2, Check, Edit2 } from "lucide-react";
import {
  vendorUpdateWorkingTerms,
  INSPECTION_TYPES,
  INSPECTION_TYPE_LABELS,
} from "@/lib/workingTerms";

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
  included: boolean;
  source: 'from_profile' | 'added_by_vendor' | 'added_by_rep';
}

const VendorWorkingTermsReview = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [repName, setRepName] = useState("");
  const [coverageRows, setCoverageRows] = useState<CoverageRow[]>([]);
  const [isEditing, setIsEditing] = useState(false);
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
      navigate("/vendor/my-reps");
      return;
    }

    // Check user is the vendor
    if (req.vendor_id !== user?.id) {
      toast({ title: "Access denied", variant: "destructive" });
      navigate("/dashboard");
      return;
    }

    setRequest(req);

    // Get rep name
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("anonymous_id")
      .eq("user_id", req.rep_id)
      .single();

    setRepName(repProfile?.anonymous_id || "Field Rep");

    // Load existing rows
    const { data: rows } = await supabase
      .from("working_terms_rows")
      .select("*")
      .eq("working_terms_request_id", requestId);

    setCoverageRows(
      (rows || []).map((r: any) => ({
        id: r.id,
        state_code: r.state_code,
        county_name: r.county_name,
        inspection_type: r.inspection_type,
        rate: r.rate,
        turnaround_days: r.turnaround_days,
        included: true,
        source: r.source,
      }))
    );

    setLoading(false);
  };

  const handleRowChange = (id: string, field: keyof CoverageRow, value: any) => {
    setCoverageRows(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleAddRow = () => {
    const defaultState = coverageRows[0]?.state_code || "";
    setCoverageRows(prev => [
      ...prev,
      {
        id: `vendor-${Date.now()}`,
        state_code: defaultState,
        county_name: null,
        inspection_type: "property",
        rate: null,
        turnaround_days: null,
        included: true,
        source: 'added_by_vendor' as const,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setCoverageRows(prev => prev.filter(r => r.id !== id));
  };

  const handleConfirm = async () => {
    if (!requestId) return;

    const includedRows = coverageRows.filter(r => r.included);
    if (includedRows.length === 0) {
      toast({ title: "Select rows", description: "Please include at least one row.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { error } = await vendorUpdateWorkingTerms(
      requestId,
      includedRows.map(r => ({
        id: r.id.startsWith('vendor-') ? undefined : r.id,
        state_code: r.state_code,
        county_name: r.county_name,
        inspection_type: r.inspection_type,
        rate: r.rate,
        turnaround_days: r.turnaround_days,
        source: r.source,
        included: true,
      })),
      true // confirm
    );

    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }

    toast({ title: "Working terms confirmed" });
    navigate("/vendor/my-reps");
  };

  const handleSendBack = async () => {
    if (!requestId) return;

    const includedRows = coverageRows.filter(r => r.included);
    if (includedRows.length === 0) {
      toast({ title: "Select rows", description: "Please include at least one row.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { error } = await vendorUpdateWorkingTerms(
      requestId,
      includedRows.map(r => ({
        id: r.id.startsWith('vendor-') ? undefined : r.id,
        state_code: r.state_code,
        county_name: r.county_name,
        inspection_type: r.inspection_type,
        rate: r.rate,
        turnaround_days: r.turnaround_days,
        source: r.source,
        included: false,
      })),
      false // don't confirm, send back
    );

    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      return;
    }

    toast({ title: "Sent back for review", description: `${repName} will review your changes.` });
    navigate("/vendor/my-reps");
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

  // Calculate summary
  const states = [...new Set(coverageRows.map(r => r.state_code))];
  const inspectionTypes = [...new Set(coverageRows.map(r => r.inspection_type))];

  return (
    <AuthenticatedLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/vendor/my-reps")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Review Working Terms</h1>
            <p className="text-muted-foreground">From {repName}</p>
          </div>
        </div>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Rows shared:</span> {coverageRows.length}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">States:</span> {states.join(", ")}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Inspection types:</span>{" "}
              {inspectionTypes.map(t => INSPECTION_TYPE_LABELS[t] || t).join(", ")}
            </p>
          </CardContent>
        </Card>

        {/* Coverage Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Coverage & Pricing</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  {isEditing ? "Done editing" : "Add or edit coverage"}
                </Button>
                {isEditing && (
                  <Button variant="outline" size="sm" onClick={handleAddRow}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add row
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium w-12">Include</th>
                    <th className="px-3 py-2 text-left font-medium">State</th>
                    <th className="px-3 py-2 text-left font-medium">County</th>
                    <th className="px-3 py-2 text-left font-medium">Inspection Type</th>
                    <th className="px-3 py-2 text-left font-medium w-24">Rate ($)</th>
                    <th className="px-3 py-2 text-left font-medium w-28">Turnaround</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                    {isEditing && <th className="px-3 py-2 w-12"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coverageRows.map(row => (
                    <tr key={row.id} className={row.source === 'added_by_vendor' ? 'bg-primary/5' : ''}>
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={row.included}
                          onCheckedChange={(checked) => handleRowChange(row.id, 'included', !!checked)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
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
                        ) : (
                          row.state_code
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <Input
                            value={row.county_name || ""}
                            onChange={(e) => handleRowChange(row.id, 'county_name', e.target.value || null)}
                            placeholder="All"
                            className="h-8 w-32"
                          />
                        ) : (
                          row.county_name || "All"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
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
                        ) : (
                          INSPECTION_TYPE_LABELS[row.inspection_type] || row.inspection_type
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={row.rate ?? ""}
                            onChange={(e) => handleRowChange(row.id, 'rate', e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="—"
                            className="h-8 w-20"
                          />
                        ) : (
                          row.rate !== null ? `$${row.rate}` : "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
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
                        ) : (
                          row.turnaround_days !== null ? `${row.turnaround_days} days` : "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.source === 'from_profile' && (
                          <Badge variant="secondary" className="text-xs">From rep profile</Badge>
                        )}
                        {row.source === 'added_by_vendor' && (
                          <Badge variant="outline" className="text-xs">Added by you</Badge>
                        )}
                        {row.source === 'added_by_rep' && (
                          <Badge variant="secondary" className="text-xs">Added by rep</Badge>
                        )}
                      </td>
                      {isEditing && (
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
          </CardContent>
        </Card>

        {/* Disclaimer & Actions */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground/80 italic">
              These working terms are shared for reference only and do not create an employment relationship, contract, or guarantee of work.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate("/vendor/my-reps")}>
                Cancel
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  onClick={handleSendBack}
                  disabled={submitting || coverageRows.filter(r => r.included).length === 0}
                >
                  Send back to rep for approval
                </Button>
              )}
              <Button
                onClick={handleConfirm}
                disabled={submitting || coverageRows.filter(r => r.included).length === 0}
              >
                <Check className="w-4 h-4 mr-1" />
                {submitting ? "Confirming..." : "Confirm working terms"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
};

export default VendorWorkingTermsReview;
