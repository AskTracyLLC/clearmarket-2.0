import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, FileText, AlertCircle, ClipboardList } from "lucide-react";
import {
  fetchConnectionAgreementAreas,
  AgreementAreaWithType,
  exportAgreementAreasToCSV,
  downloadCSV,
} from "@/lib/agreementAreas";
import { supabase } from "@/integrations/supabase/client";
import { WorkingTermsRow, INSPECTION_TYPE_LABELS } from "@/lib/workingTerms";

interface AgreementDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  connectionLabel: string;
  vendorId?: string;
  repId?: string;
}

export function AgreementDetailsDialog({
  open,
  onOpenChange,
  connectionId,
  connectionLabel,
  vendorId,
  repId,
}: AgreementDetailsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<AgreementAreaWithType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"agreement" | "working-terms">("agreement");
  
  // Working terms state
  const [workingTermsRows, setWorkingTermsRows] = useState<WorkingTermsRow[]>([]);
  const [workingTermsLoading, setWorkingTermsLoading] = useState(false);

  useEffect(() => {
    if (open && connectionId) {
      loadAgreementAreas();
    }
    if (open && vendorId && repId) {
      loadWorkingTerms();
    }
  }, [open, connectionId, vendorId, repId]);

  const loadAgreementAreas = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConnectionAgreementAreas(connectionId);
      setAreas(data);
    } catch (err) {
      console.error("Error loading agreement areas:", err);
      setError("Failed to load agreement details");
    } finally {
      setLoading(false);
    }
  };

  const loadWorkingTerms = async () => {
    if (!vendorId || !repId) return;
    setWorkingTermsLoading(true);
    try {
      const { data: request } = await supabase
        .from("working_terms_requests")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("rep_id", repId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!request) {
        setWorkingTermsRows([]);
        setWorkingTermsLoading(false);
        return;
      }

      const { data: rowsData } = await supabase
        .from("working_terms_rows")
        .select("*")
        .eq("working_terms_request_id", request.id)
        .eq("status", "active")
        .order("state_code")
        .order("county_name")
        .order("inspection_type");

      setWorkingTermsRows((rowsData || []) as WorkingTermsRow[]);
    } catch (err) {
      console.error("Error loading working terms:", err);
    } finally {
      setWorkingTermsLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = exportAgreementAreasToCSV(areas, connectionLabel);
    const filename = `agreement-${connectionLabel.replace(/[^a-zA-Z0-9]/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "inactive":
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatRate = (rate: number | null) => {
    if (rate === null || rate === undefined) return "—";
    return `$${rate.toFixed(2)}`;
  };

  const getInspectionTypeLabel = (type: string | null) => {
    if (!type) return "—";
    return INSPECTION_TYPE_LABELS[type] || type;
  };

  // Group working terms by state
  const groupedWorkingTerms = useMemo(() => {
    const groups: Record<string, WorkingTermsRow[]> = {};
    workingTermsRows.forEach((row) => {
      if (!groups[row.state_code]) {
        groups[row.state_code] = [];
      }
      groups[row.state_code].push(row);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stateCode, rows]) => ({ stateCode, rows }));
  }, [workingTermsRows]);

  const hasWorkingTerms = vendorId && repId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agreement — {connectionLabel}
          </DialogTitle>
          <DialogDescription>
            Coverage areas, pricing, and working terms for this connection.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {hasWorkingTerms ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2 shrink-0">
                <TabsTrigger value="agreement" className="gap-1">
                  <FileText className="h-4 w-4" />
                  Coverage Areas
                </TabsTrigger>
                <TabsTrigger value="working-terms" className="gap-1">
                  <ClipboardList className="h-4 w-4" />
                  Working Terms
                </TabsTrigger>
              </TabsList>

              <TabsContent value="agreement" className="flex-1 overflow-y-auto mt-4">
                {renderAgreementContent()}
              </TabsContent>

              <TabsContent value="working-terms" className="flex-1 overflow-y-auto mt-4">
                {renderWorkingTermsContent()}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {renderAgreementContent()}
            </div>
          )}
        </div>

        <div className="pt-4 border-t shrink-0">
          <p className="text-xs text-muted-foreground italic text-center">
            Informational only — not a contract, guarantee of work, or employment
            agreement.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  function renderAgreementContent() {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      );
    }
    
    if (areas.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            No agreement areas on file for this connection.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Agreement areas are created when working terms are finalized.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>County / Zip</TableHead>
                <TableHead>Inspection Type</TableHead>
                <TableHead className="text-right">Base Rate</TableHead>
                <TableHead className="text-right">Rush Rate</TableHead>
                <TableHead>Effective Start</TableHead>
                <TableHead>Effective End</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((area) => (
                <TableRow key={area.id}>
                  <TableCell className="font-medium">
                    {area.state_code}
                  </TableCell>
                  <TableCell>
                    {area.county_name || area.zip_code || "Entire state"}
                  </TableCell>
                  <TableCell>
                    {area.inspection_type_label ||
                      area.inspection_category ||
                      "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRate(area.base_rate)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRate(area.rush_rate)}
                  </TableCell>
                  <TableCell>{formatDate(area.effective_start)}</TableCell>
                  <TableCell>{formatDate(area.effective_end)}</TableCell>
                  <TableCell>{getStatusBadge(area.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  function renderWorkingTermsContent() {
    if (workingTermsLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (workingTermsRows.length === 0) {
      return (
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            No working terms on file for this connection.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Working terms define rates and conditions for coverage areas.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Working terms define agreed-upon rates and conditions. These are for reference only.
        </p>
        
        {groupedWorkingTerms.map((group) => (
          <div key={group.stateCode} className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 border-b">
              <span className="font-medium">{group.stateCode}</span>
              <Badge variant="secondary" className="ml-2">
                {group.rows.length} term{group.rows.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>County</TableHead>
                  <TableHead>Inspection Type</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Turnaround</TableHead>
                  <TableHead>Effective From</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">
                      {row.county_name || "Statewide"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getInspectionTypeLabel(row.inspection_type)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {formatRate(row.rate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.turnaround_days ? `${row.turnaround_days}d` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.effective_from
                        ? new Date(row.effective_from).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    );
  }
}
