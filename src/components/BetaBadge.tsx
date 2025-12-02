import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

const BETA_MODE = import.meta.env.VITE_BETA_MODE === "true";

export function BetaBadge() {
  if (!BETA_MODE) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="text-[10px] px-2 py-0.5 border-amber-500/50 text-amber-500 bg-amber-500/10 cursor-help"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Beta
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>You're using ClearMarket Beta. Thanks for being an early tester!</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function isBetaMode(): boolean {
  return BETA_MODE;
}
