import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  MessageSquare,
  Users,
  FileSearch,
  Briefcase,
  Map,
  ShieldAlert,
  Wrench,
  FileText,
  CreditCard,
  Settings,
  Star,
  Building2,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  MoreHorizontal,
  HelpCircle,
  LogOut,
  Bell,
  ChevronDown,
  Megaphone,
  User,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CountBadge } from "@/components/CountBadge";
import { BetaBadge } from "@/components/BetaBadge";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useSectionCounts } from "@/hooks/useSectionCounts";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LeftSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
  isAdmin?: boolean;
  isVendor?: boolean;
  isRep?: boolean;
  vendorCredits?: number | null;
  userProfile?: {
    full_name?: string;
    email?: string;
    rep_anonymous_id?: string;
    vendor_anonymous_id?: string;
  } | null;
  /** Called after navigation on mobile to close the sheet */
  onNavigate?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
  roles?: ("rep" | "vendor" | "admin")[];
}

export function LeftSidebar({
  collapsed,
  onToggleCollapse,
  onOpenSearch,
  isAdmin,
  isVendor,
  isRep,
  vendorCredits,
  userProfile,
  onNavigate,
}: LeftSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { effectiveRole, isDualRole, switchRole } = useActiveRole();
  const sectionCounts = useSectionCounts();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleSignOut = async () => {
    onNavigate?.();
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  // Quick Action button config
  const getQuickAction = () => {
    if (isAdmin) {
      return { label: "Broadcast", path: "/admin/broadcasts/new", icon: <Megaphone className="h-4 w-4" /> };
    }
    if (effectiveRole === "vendor" || isVendor) {
      return { label: "New Post", path: "/vendor/seeking-coverage?new=1", icon: <Plus className="h-4 w-4" /> };
    }
    // Field Reps: Network Alert creation is on the Availability page
    return { label: "Network Alert", path: "/rep/availability", icon: <Bell className="h-4 w-4" /> };
  };

  const quickAction = getQuickAction();

  // Primary nav items
  const primaryItems: NavItem[] = [
    { label: "Dashboard", path: "/dashboard", icon: <Home className="h-5 w-5" /> },
    { label: "Messages", path: "/messages", icon: <MessageSquare className="h-5 w-5" />, badge: sectionCounts.unreadMessages },
    { label: "Community", path: "/community", icon: <Users className="h-5 w-5" /> },
  ];

  // Vendor-specific items - Interested Reps deep-links to Seeking Coverage with filters
  const vendorItems: NavItem[] = [
    { label: "My Profile", path: "/vendor/profile", icon: <User className="h-5 w-5" /> },
    { label: "Seeking Coverage", path: "/vendor/seeking-coverage", icon: <FileSearch className="h-5 w-5" />, badge: sectionCounts.vendorPostsWithInterest },
    { label: "Interested Reps", path: "/vendor/seeking-coverage?status=open&interest=with_interest", icon: <Bell className="h-5 w-5" />, badge: sectionCounts.vendorTotalInterestedReps },
    { label: "My Reps", path: "/vendor/my-reps", icon: <Users className="h-5 w-5" /> },
    { label: "Proposals", path: "/vendor/proposals", icon: <FileText className="h-5 w-5" /> },
    { label: "Reviews", path: "/vendor/reviews", icon: <Star className="h-5 w-5" /> },
  ];

  // Rep-specific items
  const repItems: NavItem[] = [
    { label: "My Profile", path: "/rep/profile", icon: <User className="h-5 w-5" /> },
    { label: "Find Work", path: "/rep/find-work", icon: <Briefcase className="h-5 w-5" /> },
    { label: "My Vendors", path: "/rep/my-vendors", icon: <Building2 className="h-5 w-5" /> },
    { label: "My Coverage", path: "/work-setup", icon: <Map className="h-5 w-5" /> },
    { label: "Reviews", path: "/rep/reviews", icon: <Star className="h-5 w-5" /> },
  ];

  // Admin-specific items
  const adminItems: NavItem[] = [
    { label: "Moderation", path: "/admin/moderation", icon: <ShieldAlert className="h-5 w-5" />, badge: sectionCounts.adminOpenReports },
    { label: "Support", path: "/admin/support", icon: <MessageSquare className="h-5 w-5" />, badge: sectionCounts.adminOpenTickets },
    { label: "Users", path: "/admin/users", icon: <Users className="h-5 w-5" /> },
    { label: "Broadcasts", path: "/admin/broadcasts", icon: <Megaphone className="h-5 w-5" /> },
    { label: "Launch Readiness", path: "/admin/launch-readiness", icon: <Rocket className="h-5 w-5" /> },
  ];

  // Tools is a primary nav item (not under More)
  const toolsItem: NavItem = { label: "Tools", path: "/tools", icon: <Wrench className="h-5 w-5" /> };

  // More menu items (Tools NOT here - it's primary)
  const moreItems: NavItem[] = [
    { label: "Coverage Map", path: "/coverage-map", icon: <Map className="h-5 w-5" /> },
    { label: "Safety Center", path: "/safety", icon: <ShieldAlert className="h-5 w-5" /> },
    { label: "Help Center", path: "/help", icon: <HelpCircle className="h-5 w-5" /> },
  ];

  // Get role-specific items
  const roleItems = isAdmin ? adminItems : effectiveRole === "vendor" || isVendor ? vendorItems : repItems;

  const renderNavItem = (item: NavItem, showLabel: boolean = true) => {
    const active = isActive(item.path.split("?")[0]); // Check path without query params
    
    const handleClick = () => {
      navigate(item.path);
      onNavigate?.();
    };
    
    const content = (
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-3 h-10 px-3",
          active && "bg-accent text-accent-foreground font-medium",
          collapsed && "justify-center px-0"
        )}
        onClick={handleClick}
      >
        <span className={cn(active && "text-primary")}>{item.icon}</span>
        {showLabel && !collapsed && (
          <span className="flex-1 text-left">{item.label}</span>
        )}
        {showLabel && !collapsed && item.badge !== undefined && item.badge > 0 && (
          <CountBadge count={item.badge} />
        )}
        {collapsed && item.badge !== undefined && item.badge > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-primary">
            {item.badge > 9 ? "9+" : item.badge}
          </Badge>
        )}
      </Button>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>
            <div className="relative">{content}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <CountBadge count={item.badge} />
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.path}>{content}</div>;
  };

  const userInitials = userProfile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  // Generate role-specific user ID label (e.g., FieldRep#1, Vendor#1)
  const getRoleIdLabel = () => {
    if (isAdmin) {
      return "Admin";
    }
    if (effectiveRole === "vendor" || isVendor) {
      // Use the vendor anonymous_id if available
      return userProfile?.vendor_anonymous_id || "Vendor";
    }
    // Use the rep anonymous_id if available
    return userProfile?.rep_anonymous_id || "FieldRep";
  };

  const roleIdLabel = getRoleIdLabel();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card h-screen sticky top-0 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header with logo and collapse toggle */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">ClearMarket</span>
              <BetaBadge />
            </Link>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className={cn(collapsed && "mx-auto")}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Quick Action Button */}
        <div className="p-3">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="w-full h-10"
                  onClick={() => { navigate(quickAction.path); onNavigate?.(); }}
                >
                  {quickAction.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{quickAction.label}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="default"
              className="w-full gap-2"
              onClick={() => { navigate(quickAction.path); onNavigate?.(); }}
            >
              {quickAction.icon}
              {quickAction.label}
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-full h-10"
                  onClick={onOpenSearch}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Search (⌘K)</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={onOpenSearch}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                ⌘K
              </kbd>
            </Button>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3">
          <nav className="flex flex-col gap-1 py-2">
            {/* Primary items */}
            {primaryItems.map((item) => renderNavItem(item))}

            {/* Divider */}
            <div className="my-2 h-px bg-border" />

            {/* Role-specific items */}
            {roleItems.map((item) => renderNavItem(item))}

            {/* Tools - primary nav for all roles */}
            {renderNavItem(toolsItem)}

            {/* Credits for Vendors */}
            {(effectiveRole === "vendor" || isVendor) && vendorCredits !== undefined && vendorCredits !== null && (
              <div className="mt-2">
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-center h-10 px-0"
                        onClick={() => { navigate("/vendor/credits"); onNavigate?.(); }}
                      >
                        <CreditCard className="h-5 w-5 text-secondary" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Credits: {vendorCredits}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-10 px-3"
                    onClick={() => { navigate("/vendor/credits"); onNavigate?.(); }}
                  >
                    <CreditCard className="h-5 w-5 text-secondary" />
                    <span className="flex-1 text-left">Credits</span>
                    <Badge variant="secondary">{vendorCredits}</Badge>
                  </Button>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="my-2 h-px bg-border" />

            {/* More menu */}
            <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
              <CollapsibleTrigger asChild>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" className="w-full justify-center h-10 px-0">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">More</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button variant="ghost" className="w-full justify-start gap-3 h-10 px-3">
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="flex-1 text-left">More</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} />
                  </Button>
                )}
              </CollapsibleTrigger>
              {!collapsed && (
                <CollapsibleContent className="pl-4 mt-1 flex flex-col gap-1">
                  {moreItems.map((item) => renderNavItem(item))}
                </CollapsibleContent>
              )}
            </Collapsible>

            {/* Settings (always visible) */}
            {renderNavItem({ label: "Settings", path: "/settings", icon: <Settings className="h-5 w-5" /> })}
          </nav>
        </ScrollArea>

        {/* User menu at bottom */}
        <div className="mt-auto border-t border-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {collapsed ? (
                <Button variant="ghost" size="icon" className="w-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              ) : (
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2 px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{userProfile?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{roleIdLabel}</p>
                    <p className="text-xs text-muted-foreground truncate">{userProfile?.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isDualRole && (
                <>
                  <DropdownMenuItem onClick={() => { switchRole("rep"); onNavigate?.(); }} className={effectiveRole === "rep" ? "bg-accent" : ""}>
                    <Briefcase className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span>Field Rep</span>
                      <span className="text-xs text-muted-foreground">Perform inspections</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { switchRole("vendor"); onNavigate?.(); }} className={effectiveRole === "vendor" ? "bg-accent" : ""}>
                    <Building2 className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span>Vendor</span>
                      <span className="text-xs text-muted-foreground">Assign work to reps</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => { navigate("/settings"); onNavigate?.(); }}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
