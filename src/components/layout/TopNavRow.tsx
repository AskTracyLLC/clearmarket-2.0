import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Home, Users, Map, Briefcase, MessageSquare, Bell, CreditCard, Star, Wrench } from "lucide-react";
import { useSectionCounts } from "@/hooks/useSectionCounts";
import { useActiveRole } from "@/hooks/useActiveRole";
import { cn } from "@/lib/utils";

interface TopNavRowProps {
  isVendor?: boolean;
  isRep?: boolean;
  vendorCredits?: number | null;
}

interface NavTab {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface StatusChip {
  label: string;
  path: string;
  icon: React.ReactNode;
  count?: number;
  showCount?: boolean;
  variant?: "default" | "secondary";
}

export function TopNavRow({ isVendor, isRep, vendorCredits }: TopNavRowProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const sectionCounts = useSectionCounts();
  const { effectiveRole } = useActiveRole();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  // Left tabs - mode switches (shared + role-specific)
  const tabs: NavTab[] = [
    { label: "Dashboard", path: "/dashboard", icon: <Home className="h-4 w-4" /> },
    { label: "Community", path: "/community", icon: <Users className="h-4 w-4" /> },
    { label: "Coverage", path: "/work-setup", icon: <Map className="h-4 w-4" /> },
    { label: "Tools", path: "/tools", icon: <Wrench className="h-4 w-4" /> },
  ];

  // Add Find Work for reps only (as a tab, NOT a chip)
  if (effectiveRole === "rep" || isRep) {
    tabs.push({ label: "Find Work", path: "/rep/find-work", icon: <Briefcase className="h-4 w-4" /> });
  }

  // Right status chips - role-based
  const getStatusChips = (): StatusChip[] => {
    if (effectiveRole === "vendor" || isVendor) {
      return [
        { 
          label: "Messages", 
          path: "/messages", 
          icon: <MessageSquare className="h-3.5 w-3.5" />, 
          count: sectionCounts.unreadMessages,
          showCount: true,
        },
        { 
          label: "Interested Reps", 
          path: "/vendor/seeking-coverage?status=open&interest=with_interest", 
          icon: <Bell className="h-3.5 w-3.5" />, 
          count: sectionCounts.vendorPostsWithInterest,
          showCount: true,
        },
        { 
          label: "Credits", 
          path: "/vendor/credits", 
          icon: <CreditCard className="h-3.5 w-3.5" />, 
          count: vendorCredits ?? 0,
          showCount: true,
          variant: "secondary",
        },
      ];
    }

    // Field Rep chips (Find Work is a TAB, not a chip - avoid duplication)
    return [
      { 
        label: "Messages", 
        path: "/messages", 
        icon: <MessageSquare className="h-3.5 w-3.5" />, 
        count: sectionCounts.unreadMessages,
        showCount: true,
      },
      { 
        label: "Alerts", 
        path: "/community?tab=alerts", 
        icon: <Bell className="h-3.5 w-3.5" />, 
        count: sectionCounts.networkUnread,
        showCount: true,
      },
      { 
        label: "Reviews", 
        path: "/rep/reviews", 
        icon: <Star className="h-3.5 w-3.5" />, 
      },
    ];
  };

  const statusChips = getStatusChips();

  return (
    <TooltipProvider>
      <div className="border-b border-border bg-background/50 px-6 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Tabs */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => (
              <Button
                key={tab.path}
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-2 h-8",
                  isActive(tab.path) && "bg-accent text-accent-foreground font-medium"
                )}
                onClick={() => navigate(tab.path)}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </Button>
            ))}
          </nav>

          {/* Right: Status chips */}
          <div className="flex items-center gap-2">
            {statusChips.map((chip) => (
              <Tooltip key={chip.label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 px-2 gap-1.5 text-xs",
                      chip.variant === "secondary" && "text-secondary"
                    )}
                    onClick={() => navigate(chip.path)}
                  >
                    {chip.icon}
                    <span className="hidden lg:inline">{chip.label}</span>
                    {chip.showCount && chip.count !== undefined && chip.count > 0 && (
                      <Badge 
                        variant={chip.variant === "secondary" ? "secondary" : "default"} 
                        className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] ml-0.5"
                      >
                        {chip.count > 99 ? "99+" : chip.count}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {chip.label}
                  {chip.showCount && chip.count !== undefined && chip.count > 0 && ` (${chip.count})`}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
