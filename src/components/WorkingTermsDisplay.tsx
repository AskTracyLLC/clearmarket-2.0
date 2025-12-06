import React from "react";
import { Button } from "@/components/ui/button";
import { Edit2 } from "lucide-react";
import type { WorkingTerms } from "./WorkingTermsDialog";

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  property: "Property Inspections",
  loss_claims: "Loss / Insurance Claims",
  commercial: "Commercial",
  other: "Other",
};

interface WorkingTermsDisplayProps {
  workingTerms?: WorkingTerms | null;
  onEditClick: () => void;
  canEdit?: boolean;
}

const WorkingTermsDisplay: React.FC<WorkingTermsDisplayProps> = ({
  workingTerms,
  onEditClick,
  canEdit = true,
}) => {
  const hasTerms = workingTerms && (
    workingTerms.typical_rate !== null ||
    workingTerms.target_turnaround_days !== null ||
    (workingTerms.inspection_types_covered && workingTerms.inspection_types_covered.length > 0)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Working terms (for reference)
        </span>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-primary hover:text-primary/80 p-0"
            onClick={onEditClick}
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit working terms
          </Button>
        )}
      </div>

      {hasTerms ? (
        <div className="space-y-1.5">
          {/* Summary sentence */}
          <p className="text-sm text-foreground">
            {workingTerms.typical_rate !== null && workingTerms.target_turnaround_days !== null ? (
              <>
                You've agreed to cover this area at <strong>${workingTerms.typical_rate}</strong> per inspection
                with a target turnaround of <strong>{workingTerms.target_turnaround_days} days</strong> from assignment.
              </>
            ) : workingTerms.typical_rate !== null ? (
              <>
                Typical rate: <strong>${workingTerms.typical_rate}</strong> per inspection.
              </>
            ) : workingTerms.target_turnaround_days !== null ? (
              <>
                Target turnaround: <strong>{workingTerms.target_turnaround_days} days</strong> from assignment.
              </>
            ) : null}
          </p>

          {/* Inspection types line */}
          {workingTerms.inspection_types_covered && workingTerms.inspection_types_covered.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Inspection types:{" "}
              {workingTerms.inspection_types_covered
                .map((t) => INSPECTION_TYPE_LABELS[t] || t)
                .join(", ")}
              .
            </p>
          )}

          {/* Additional expectations */}
          {workingTerms.additional_expectations && (
            <p className="text-xs text-muted-foreground italic">
              "{workingTerms.additional_expectations}"
            </p>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground/70 italic">
            Informational only — not a contract or guarantee of work.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Working terms haven't been set yet for this connection.
          </p>
          <p className="text-xs text-muted-foreground/70 italic">
            Informational only — not a contract or guarantee of work.
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkingTermsDisplay;
