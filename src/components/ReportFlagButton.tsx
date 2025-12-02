import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ReportFlagButtonProps {
  onClick: () => void;
  disabled?: boolean;
  alreadyReported?: boolean;
}

export function ReportFlagButton({ onClick, disabled, alreadyReported }: ReportFlagButtonProps) {
  const label = alreadyReported ? "Reported" : "Report";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={alreadyReported ? "opacity-70 text-muted-foreground" : ""}
          >
            <Flag className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span>{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
