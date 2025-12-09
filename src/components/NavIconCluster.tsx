import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, Settings } from "lucide-react";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { useSectionCounts } from "@/hooks/useSectionCounts";
import { ThemeToggle } from "./ThemeToggle";

interface NavIconClusterProps {
  vendorCredits?: number | null;
  showCredits?: boolean;
}

export function NavIconCluster({ vendorCredits, showCredits = false }: NavIconClusterProps) {
  const navigate = useNavigate();
  const { unreadMessages } = useSectionCounts();

  return (
    <div className="flex items-center gap-1">
      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Messages Icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => navigate("/messages")}
          >
            <Mail className="h-5 w-5" />
            {unreadMessages > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-primary hover:bg-primary"
              >
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Messages</TooltipContent>
      </Tooltip>

      {/* Notifications Dropdown */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <NotificationsDropdown />
          </span>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>

      {/* Settings Icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/settings")}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>

      {/* Credits Pill (for vendors) */}
      {showCredits && vendorCredits !== null && vendorCredits !== undefined && (
        <Badge 
          variant="secondary" 
          className="bg-secondary/20 text-secondary hover:bg-secondary/30 cursor-pointer ml-2"
          onClick={() => navigate("/vendor/credits")}
        >
          Credits: {vendorCredits}
        </Badge>
      )}
    </div>
  );
}
