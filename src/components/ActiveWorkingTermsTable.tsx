import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit2, Power, MoreVertical, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { INSPECTION_TYPE_LABELS, WorkingTermsRow, WorkingTermsChangeRequest } from "@/lib/workingTerms";
import InactivateAreaDialog from "./InactivateAreaDialog";
import ProposeTermsChangeDialog from "./ProposeTermsChangeDialog";
import ReviewChangeRequestDialog from "./ReviewChangeRequestDialog";

interface ActiveWorkingTermsTableProps {
  rows: WorkingTermsRow[];
  pendingChanges: Map<string, WorkingTermsChangeRequest>;
  role: "vendor" | "rep";
  otherPartyName: string;
  onInactivate: (rowId: string, reason: string) => Promise<void>;
  onProposeChange: (rowId: string, data: {
    newRate: number | null;
    newTurnaround: number | null;
    effectiveFrom: string;
    reason: string;
  }) => Promise<void>;
  onAcceptChange: (changeRequestId: string) => Promise<void>;
  onDeclineChange: (changeRequestId: string, reason: string) => Promise<void>;
  isLoading?: boolean;
}

const ActiveWorkingTermsTable: React.FC<ActiveWorkingTermsTableProps> = ({
  rows,
  pendingChanges,
  role,
  otherPartyName,
  onInactivate,
  onProposeChange,
  onAcceptChange,
  onDeclineChange,
  isLoading = false,
}) => {
  const [inactivateRow, setInactivateRow] = useState<WorkingTermsRow | null>(null);
  const [editRow, setEditRow] = useState<WorkingTermsRow | null>(null);
  const [reviewChange, setReviewChange] = useState<{
    row: WorkingTermsRow;
    change: WorkingTermsChangeRequest;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const getAreaDescription = (row: WorkingTermsRow) => {
    const county = row.county_name ? ` – ${row.county_name}` : "";
    const type = INSPECTION_TYPE_LABELS[row.inspection_type] || row.inspection_type;
    return `${row.state_code}${county} (${type})`;
  };

  const getStatusBadge = (row: WorkingTermsRow) => {
    const pendingChange = pendingChanges.get(row.id);
    
    if (row.status === "inactive") {
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <Power className="w-3 h-3" />
          Inactive
        </Badge>
      );
    }
    
    if (row.status === "pending_change_vendor" || row.status === "pending_change_rep") {
      const isMine = (row.status === "pending_change_rep" && role === "rep") ||
                     (row.status === "pending_change_vendor" && role === "vendor");
      
      return (
        <Badge 
          variant={isMine ? "outline" : "default"} 
          className="text-xs gap-1 cursor-pointer"
          onClick={() => {
            if (pendingChange && !isMine) {
              setReviewChange({ row, change: pendingChange });
            }
          }}
        >
          <Clock className="w-3 h-3" />
          {isMine ? "Change pending" : "Review change"}
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="text-xs gap-1 bg-green-600/20 text-green-600">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </Badge>
    );
  };

  const handleInactivate = async (reason: string) => {
    if (!inactivateRow) return;
    setActionLoading(true);
    await onInactivate(inactivateRow.id, reason);
    setActionLoading(false);
    setInactivateRow(null);
  };

  const handleProposeChange = async (data: any) => {
    if (!editRow) return;
    setActionLoading(true);
    await onProposeChange(editRow.id, data);
    setActionLoading(false);
    setEditRow(null);
  };

  const handleAcceptChange = async () => {
    if (!reviewChange) return;
    setActionLoading(true);
    await onAcceptChange(reviewChange.change.id);
    setActionLoading(false);
    setReviewChange(null);
  };

  const handleDeclineChange = async (reason: string) => {
    if (!reviewChange) return;
    setActionLoading(true);
    await onDeclineChange(reviewChange.change.id, reason);
    setActionLoading(false);
    setReviewChange(null);
  };

  // Separate active and inactive rows
  const activeRows = rows.filter(r => r.status !== "inactive");
  const inactiveRows = rows.filter(r => r.status === "inactive");

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "added_by_vendor":
        return (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
            Added by vendor
          </Badge>
        );
      case "added_by_rep":
        return (
          <Badge variant="secondary" className="text-xs">
            Added by rep
          </Badge>
        );
      case "from_profile":
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            From profile
          </Badge>
        );
    }
  };

  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>State</TableHead>
              <TableHead>County</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Turnaround</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Effective since</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeRows.map((row) => {
              const canEdit = row.status === "active";
              const pendingChange = pendingChanges.get(row.id);
              const needsReview = pendingChange && 
                ((row.status === "pending_change_vendor" && role === "rep") ||
                 (row.status === "pending_change_rep" && role === "vendor"));

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.state_code}</TableCell>
                  <TableCell>{row.county_name || "All"}</TableCell>
                  <TableCell className="text-sm">
                    {INSPECTION_TYPE_LABELS[row.inspection_type] || row.inspection_type}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.rate !== null ? `$${row.rate}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.turnaround_days !== null ? `${row.turnaround_days} days` : "—"}
                  </TableCell>
                  <TableCell>{getSourceBadge(row.source)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(row.effective_from), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>{getStatusBadge(row)}</TableCell>
                  <TableCell>
                    {needsReview ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setReviewChange({ row, change: pendingChange! })}
                      >
                        Review
                      </Button>
                    ) : canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditRow(row)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit terms
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setInactivateRow(row)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Power className="w-4 h-4 mr-2" />
                            Inactivate area
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {activeRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No active working terms.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Inactive rows section */}
      {inactiveRows.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Inactive areas ({inactiveRows.length})
          </h4>
          <div className="border rounded-lg overflow-x-auto opacity-60">
            <Table>
              <TableBody>
                {inactiveRows.map((row) => (
                  <TableRow key={row.id} className="bg-muted/30">
                    <TableCell className="font-medium">{row.state_code}</TableCell>
                    <TableCell>{row.county_name || "All"}</TableCell>
                    <TableCell className="text-sm">
                      {INSPECTION_TYPE_LABELS[row.inspection_type] || row.inspection_type}
                    </TableCell>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      Inactivated {row.inactivated_at ? format(new Date(row.inactivated_at), "MMM d, yyyy") : ""} 
                      {row.inactivated_reason && ` — ${row.inactivated_reason}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <InactivateAreaDialog
        open={!!inactivateRow}
        onOpenChange={(open) => !open && setInactivateRow(null)}
        areaDescription={inactivateRow ? getAreaDescription(inactivateRow) : ""}
        role={role}
        onConfirm={handleInactivate}
        isLoading={actionLoading}
      />

      <ProposeTermsChangeDialog
        open={!!editRow}
        onOpenChange={(open) => !open && setEditRow(null)}
        areaDescription={editRow ? getAreaDescription(editRow) : ""}
        currentRate={editRow?.rate ?? null}
        currentTurnaround={editRow?.turnaround_days ?? null}
        onSubmit={handleProposeChange}
        isLoading={actionLoading}
      />

      {reviewChange && (
        <ReviewChangeRequestDialog
          open={!!reviewChange}
          onOpenChange={(open) => !open && setReviewChange(null)}
          areaDescription={getAreaDescription(reviewChange.row)}
          changeRequest={reviewChange.change}
          requesterName={otherPartyName}
          onAccept={handleAcceptChange}
          onDecline={handleDeclineChange}
          isLoading={actionLoading}
        />
      )}
    </>
  );
};

export default ActiveWorkingTermsTable;
