import { useState, useEffect } from "react";
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
import { Loader2, Download, FileText, AlertCircle } from "lucide-react";
import {
  fetchConnectionAgreementAreas,
  AgreementAreaWithType,
  exportAgreementAreasToCSV,
  downloadCSV,
} from "@/lib/agreementAreas";

interface AgreementDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  connectionLabel: string; // e.g., "FieldRep#3" or "Vendor#1"
}

export function AgreementDetailsDialog({
  open,
  onOpenChange,
  connectionId,
  connectionLabel,
}: AgreementDetailsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<AgreementAreaWithType[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && connectionId) {
      loadAgreementAreas();
    }
  }, [open, connectionId]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agreement Details — {connectionLabel}
          </DialogTitle>
          <DialogDescription>
            Coverage areas and pricing agreed for this connection.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          ) : areas.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No agreement areas on file for this connection.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Agreement areas are created when working terms are finalized.
              </p>
            </div>
          ) : (
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
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground italic text-center">
            Informational only — not a contract, guarantee of work, or employment
            agreement.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
