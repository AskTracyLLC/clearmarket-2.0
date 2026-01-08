import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { vendorProposalsCopy as copy } from "@/copy/vendorProposalsCopy";

interface PaidFeatureBadgeProps {
  className?: string;
}

export function PaidFeatureBadge({ className }: PaidFeatureBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`bg-amber-500/10 text-amber-400 border-amber-500/30 cursor-help ${className || ""}`}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {copy.paidBadge.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{copy.paidBadge.tooltipTitle}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {copy.paidBadge.tooltipBody}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
