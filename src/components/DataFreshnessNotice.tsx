import { RefreshCw, Radio, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export type FreshnessMode = "real-time" | "hourly" | "daily" | "manual";

interface DataFreshnessNoticeProps {
  mode: FreshnessMode;
  lastUpdated?: string | Date | null;
  messageOverride?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  size?: "sm" | "default";
}

const modeConfig: Record<FreshnessMode, { icon: typeof Clock; label: string; tooltip: string }> = {
  "real-time": {
    icon: Radio,
    label: "Live updates",
    tooltip: "This data updates in real-time as changes happen.",
  },
  hourly: {
    icon: Clock,
    label: "Updates hourly",
    tooltip: "Scores update on a schedule and may not reflect the most recent activity.",
  },
  daily: {
    icon: Clock,
    label: "Updates daily",
    tooltip: "Scores update on a schedule and may not reflect the most recent activity.",
  },
  manual: {
    icon: RefreshCw,
    label: "Not live",
    tooltip: "This data does not update automatically. Tap Refresh to get the latest.",
  },
};

export function DataFreshnessNotice({
  mode,
  lastUpdated,
  messageOverride,
  onRefresh,
  isRefreshing = false,
  className,
  size = "default",
}: DataFreshnessNoticeProps) {
  const config = modeConfig[mode];
  const Icon = config.icon;

  const formattedTime = lastUpdated
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })
    : null;

  const displayMessage = messageOverride
    ? messageOverride
    : mode === "real-time"
    ? config.label
    : mode === "manual"
    ? "Not live — tap Refresh to update"
    : `${config.label}${formattedTime ? ` — last updated ${formattedTime}` : ""}`;

  const isSmall = size === "sm";

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-muted-foreground",
        isSmall ? "text-xs" : "text-sm",
        className
      )}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5 cursor-help">
              <Icon
                className={cn(
                  "shrink-0",
                  isSmall ? "h-3 w-3" : "h-4 w-4",
                  mode === "real-time" && "text-green-500 animate-pulse"
                )}
              />
              <span>{displayMessage}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p>{config.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {mode === "manual" && onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn("h-auto py-1 px-2", isSmall && "text-xs")}
        >
          <RefreshCw
            className={cn(
              "mr-1",
              isSmall ? "h-3 w-3" : "h-3.5 w-3.5",
              isRefreshing && "animate-spin"
            )}
          />
          Refresh
        </Button>
      )}
    </div>
  );
}

// Score-specific helper component with tooltip
interface ScoreTooltipProps {
  children: React.ReactNode;
  className?: string;
}

export function ScoreTooltip({ children, className }: ScoreTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1 cursor-help", className)}>
            {children}
            <Info className="h-3 w-3 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p>Scores update on a schedule and may not reflect the most recent activity.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
