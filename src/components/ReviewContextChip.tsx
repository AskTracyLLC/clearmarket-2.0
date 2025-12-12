import { Button } from "@/components/ui/button";
import { MapPin, Briefcase, Pencil, Globe } from "lucide-react";
import type { ReviewContextValue } from "./ReviewContextModal";

interface ReviewContextChipProps {
  value: ReviewContextValue | null;
  onEditClick: () => void;
}

export function ReviewContextChip({ value, onEditClick }: ReviewContextChipProps) {
  // No context set yet - show "Add context" prompt
  if (!value || (!value.displayLabel && value.mode !== "overall")) {
    return (
      <div 
        className="rounded-md border border-dashed border-border bg-muted/20 p-3 mb-4 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onEditClick}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Add location & work type context (optional)
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            type="button"
          >
            <Pencil className="h-3 w-3 mr-1" />
            Add context
          </Button>
        </div>
      </div>
    );
  }

  // Context is set - show the chip
  const isOverall = value.mode === "overall";

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 mb-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">
            Reviewing work for:
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {isOverall ? (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3 text-muted-foreground" />
                Overall: All areas & work types
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {value.displayLabel}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEditClick}
          className="text-xs h-6 px-2"
          type="button"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit context
        </Button>
      </div>
    </div>
  );
}
