import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INSPECTION_TYPE_LABELS, type WorkingTermsRow } from "@/lib/workingTerms";

interface ActiveWorkingTermsDisplayProps {
  rows: WorkingTermsRow[];
  onRequestChanges?: () => void;
  canRequestChanges?: boolean;
}

const ActiveWorkingTermsDisplay: React.FC<ActiveWorkingTermsDisplayProps> = ({
  rows,
  onRequestChanges,
  canRequestChanges = false,
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Working terms (for reference)
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Working terms haven't been set yet for this connection.
        </p>
        <p className="text-xs text-muted-foreground/70 italic">
          Informational only — not a contract or guarantee of work.
        </p>
      </div>
    );
  }

  // Calculate summary stats
  const states = [...new Set(rows.map(r => r.state_code))];
  const inspectionTypes = [...new Set(rows.map(r => r.inspection_type))];
  const rates = rows.map(r => r.rate).filter((r): r is number => r !== null);
  const minRate = rates.length > 0 ? Math.min(...rates) : null;
  const maxRate = rates.length > 0 ? Math.max(...rates) : null;
  const turnarounds = rows.map(r => r.turnaround_days).filter((t): t is number => t !== null);
  const avgTurnaround = turnarounds.length > 0 
    ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Working terms (for reference)
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-primary hover:text-primary/80 p-0"
          onClick={() => setDetailsOpen(true)}
        >
          <Eye className="w-3 h-3 mr-1" />
          View full terms
        </Button>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground">Coverage entries:</span> {rows.length}
        </p>
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground">States:</span> {states.join(", ")}
        </p>
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground">Inspection types:</span>{" "}
          {inspectionTypes.map(t => INSPECTION_TYPE_LABELS[t] || t).join(", ")}
        </p>
        {minRate !== null && (
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Rate range:</span>{" "}
            {minRate === maxRate ? `$${minRate}` : `$${minRate}–$${maxRate}`} per inspection
          </p>
        )}
        {avgTurnaround !== null && (
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Target turnaround:</span> typically {avgTurnaround} days
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground/70 italic">
        Informational only — not a contract, guarantee of work, or employment agreement.
      </p>

      {/* Actions */}
      {canRequestChanges && onRequestChanges && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRequestChanges}
          className="mt-2"
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          Request changes
        </Button>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Working Terms Details</DialogTitle>
            <DialogDescription>
              Full coverage & pricing breakdown for this connection.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">State</th>
                    <th className="px-3 py-2 text-left font-medium">County</th>
                    <th className="px-3 py-2 text-left font-medium">Inspection Type</th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                    <th className="px-3 py-2 text-right font-medium">Turnaround</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">{row.state_code}</td>
                      <td className="px-3 py-2">{row.county_name || "All"}</td>
                      <td className="px-3 py-2">
                        {INSPECTION_TYPE_LABELS[row.inspection_type] || row.inspection_type}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.rate !== null ? `$${row.rate}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.turnaround_days !== null ? `${row.turnaround_days} days` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.source === 'from_profile' && (
                          <Badge variant="secondary" className="text-xs">From profile</Badge>
                        )}
                        {row.source === 'added_by_vendor' && (
                          <Badge variant="outline" className="text-xs">Added by vendor</Badge>
                        )}
                        {row.source === 'added_by_rep' && (
                          <Badge variant="outline" className="text-xs">Added by rep</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70 italic mt-4">
            These working terms are shared for reference only and do not create an employment relationship, contract, or guarantee of work.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActiveWorkingTermsDisplay;
