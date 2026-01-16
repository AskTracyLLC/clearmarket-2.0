import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
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
  Share2,
  LayoutDashboard,
  Inbox,
  FileCheck,
  UserCog,
  Ticket,
  Coins,
  ToggleLeft,
  Mail,
  ClipboardList,
  Scale,
  Activity,
  BarChart3,
  PieChart,
  Pin,
  Ban,
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
import { usePinnedFeatures } from "@/hooks/usePinnedFeatures";
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
  /** Demo mode - disables certain features and remaps routes */
  isDemo?: boolean;
  /** Demo role when in demo mode */
  demoRole?: "vendor" | "rep";
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
  roles?: ("rep" | "vendor" | "admin")[];
  pinnable?: boolean;
}

interface AdminFolder {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  storageKey: string;
}

const ADMIN_FOLDER_STORAGE_KEY = "admin_sidebar_folders";

// Demo route mapping - only these routes are available in demo mode
const DEMO_ROUTE_MAP: Record<string, Record<string, string>> = {
  vendor: {
    // Primary nav
    "/dashboard": "/demo/vendor",
    "/messages": "", // Not available
    "/community": "/demo/vendor/community",
    // Feature nav
    "/vendor/seeking-coverage": "", // Not available
    "/vendor/find-reps": "/demo/vendor/search",
    "/vendor/my-reps": "", // Not available
    "/vendor/staff": "", // Not available
    "/vendor/proposals": "", // Not available
    "/vendor/reviews": "", // Not available
    "/tools": "", // Not available
    "/vendor/credits": "", // Not available
    "/vendor/share-profile": "", // Not available
    "/coverage-map": "/demo/vendor/coverage-map",
    // Avatar menu
    "/vendor/profile": "", // Not available in demo
    "/settings": "", // Not available
    "/safety": "", // Not available
    "/help": "/help", // Available in demo
  },
  rep: {
    // Primary nav
    "/dashboard": "/demo/rep",
    "/messages": "", // Not available
    "/community": "/demo/rep/community",
    // Feature nav
    "/rep/find-work": "", // Not available
    "/rep/my-vendors": "/demo/rep/vendors",
    "/work-setup": "", // Not available (My Coverage)
    "/rep/reviews": "", // Not available
    "/tools": "", // Not available
    "/rep/share-profile": "", // Not available
    "/coverage-map": "/demo/rep/coverage-map",
    // Avatar menu
    "/rep/profile": "/demo/rep/profile",
    "/settings": "", // Not available
    "/safety": "", // Not available
    "/help": "/help", // Available in demo
  },
};

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
  isDemo = false,
  demoRole,
}: LeftSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { effectiveRole, isDualRole, switchRole } = useActiveRole();
  const sectionCounts = useSectionCounts();
  const { isPinned, togglePin } = usePinnedFeatures();
  const [moreOpen, setMoreOpen] = useState(false);
  
  // Admin folder open states - load from localStorage
  const [adminFolderStates, setAdminFolderStates] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(ADMIN_FOLDER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Persist folder states to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ADMIN_FOLDER_STORAGE_KEY, JSON.stringify(adminFolderStates));
    }
  }, [adminFolderStates]);

  const toggleAdminFolder = (key: string) => {
    setAdminFolderStates((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Determine demo role from prop or from isVendor/isRep flags
  const currentDemoRole = demoRole || (isVendor ? "vendor" : "rep");
  
  // Get demo route map for current role
  const getDemoPath = (prodPath: string): string | null => {
    if (!isDemo) return null;
    const roleMap = DEMO_ROUTE_MAP[currentDemoRole];
    if (!roleMap) return null;
    // Strip query params for lookup
    const basePath = prodPath.split("?")[0];
    const demoPath = roleMap[basePath];
    return demoPath !== undefined ? demoPath : null;
  };

  // Check if a path is available in demo
  const isDemoAvailable = (prodPath: string): boolean => {
    const demoPath = getDemoPath(prodPath);
    return demoPath !== null && demoPath !== "";
  };

  const handleSignOut = async () => {
    if (isDemo) {
      // In demo, "sign out" just exits demo
      navigate("/demo");
      onNavigate?.();
      return;
    }
    onNavigate?.();
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  const handlePinClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const result = togglePin(id);
    if (!result.success && result.message) {
      toast({
        title: "Pin limit reached",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  // Handle navigation with demo awareness
  const handleNavigation = (path: string) => {
    if (isDemo) {
      const demoPath = getDemoPath(path);
      if (demoPath === null || demoPath === "") {
        // Not available in demo - show toast, don't navigate
        toast({
          title: "Not available in demo",
          description: "This feature is not available in demo yet.",
        });
        return;
      }
      // Navigate to demo path
      navigate(demoPath);
    } else {
      navigate(path);
    }
    onNavigate?.();
  };

  const isActive = (path: string) => {
    const pathWithoutQuery = path.split("?")[0];
    
    if (isDemo) {
      // In demo, check if current location matches the demo version of this path
      const demoPath = getDemoPath(path);
      if (demoPath) {
        return location.pathname === demoPath || location.pathname.startsWith(demoPath + "/");
      }
      return false;
    }
    
    return location.pathname === pathWithoutQuery || location.pathname.startsWith(pathWithoutQuery + "/");
  };

  // Quick Action button config - disabled in demo
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

  // Primary nav items - ALWAYS VISIBLE (NOT PINNABLE)
  const primaryItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: <Home className="h-5 w-5" /> },
    { id: "messages", label: "Messages", path: "/messages", icon: <MessageSquare className="h-5 w-5" />, badge: isDemo ? undefined : sectionCounts.unreadMessages },
    { id: "community", label: "Community", path: "/community", icon: <Users className="h-5 w-5" /> },
  ];

  // Vendor feature items (PINNABLE - under ...More by default)
  const vendorFeatureItems: NavItem[] = [
    { id: "vendor-seeking", label: "Seeking Coverage", path: "/vendor/seeking-coverage", icon: <FileSearch className="h-5 w-5" />, badge: isDemo ? undefined : sectionCounts.vendorPostsWithInterest, pinnable: true },
    { id: "vendor-findreps", label: "Find Reps", path: "/vendor/find-reps", icon: <Search className="h-5 w-5" />, pinnable: true },
    { id: "vendor-interested", label: "Interested Reps", path: "/vendor/seeking-coverage?status=open&interest=with_interest", icon: <Bell className="h-5 w-5" />, badge: isDemo ? undefined : sectionCounts.vendorTotalInterestedReps, pinnable: true },
    { id: "vendor-myreps", label: "My Reps", path: "/vendor/my-reps", icon: <Users className="h-5 w-5" />, pinnable: true },
    { id: "vendor-staff", label: "My Staff", path: "/vendor/staff", icon: <Users className="h-5 w-5" />, pinnable: true },
    
    { id: "vendor-proposals", label: "Proposals", path: "/vendor/proposals", icon: <FileText className="h-5 w-5" />, pinnable: true },
    { id: "vendor-reviews", label: "Reviews", path: "/vendor/reviews", icon: <Star className="h-5 w-5" />, pinnable: true },
    { id: "vendor-tools", label: "Tools", path: "/tools", icon: <Wrench className="h-5 w-5" />, pinnable: true },
    { id: "vendor-credits", label: "Credits", path: "/vendor/credits", icon: <CreditCard className="h-5 w-5" />, pinnable: true },
    { id: "vendor-share", label: "Share Profile", path: "/vendor/share-profile", icon: <Share2 className="h-5 w-5" />, pinnable: true },
    { id: "coverage-map", label: "Coverage Map", path: "/coverage-map", icon: <Map className="h-5 w-5" />, pinnable: true },
  ];

  // Rep feature items (PINNABLE - under ...More by default)
  const repFeatureItems: NavItem[] = [
    { id: "rep-findwork", label: "Find Work", path: "/rep/find-work", icon: <Briefcase className="h-5 w-5" />, pinnable: true },
    { id: "rep-myvendors", label: "My Vendors", path: "/rep/my-vendors", icon: <Building2 className="h-5 w-5" />, pinnable: true },
    { id: "rep-coverage", label: "My Coverage", path: "/work-setup", icon: <Map className="h-5 w-5" />, pinnable: true },
    { id: "rep-reviews", label: "Reviews", path: "/rep/reviews", icon: <Star className="h-5 w-5" />, pinnable: true },
    { id: "rep-tools", label: "Tools", path: "/tools", icon: <Wrench className="h-5 w-5" />, pinnable: true },
    { id: "rep-share", label: "Share Profile", path: "/rep/share-profile", icon: <Share2 className="h-5 w-5" />, pinnable: true },
    { id: "coverage-map", label: "Coverage Map", path: "/coverage-map", icon: <Map className="h-5 w-5" />, pinnable: true },
  ];

  // Admin folders with collapsible groups
  const adminFolders: AdminFolder[] = [
    {
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
      storageKey: "overview",
      items: [
        { id: "admin-dashboard", label: "Admin Dashboard", path: "/dashboard", icon: <Home className="h-5 w-5" /> },
      ],
    },
    {
      label: "Queue & Moderation",
      icon: <Inbox className="h-4 w-4" />,
      storageKey: "queue",
      items: [
        { id: "admin-support", label: "Support Queue", path: "/admin/support-queue", icon: <Inbox className="h-5 w-5" />, badge: (sectionCounts.adminOpenReports || 0) + (sectionCounts.adminOpenTickets || 0) },
        { id: "admin-bgcheck", label: "Background Checks", path: "/admin/background-checks", icon: <FileCheck className="h-5 w-5" /> },
      ],
    },
    {
      label: "People & Access",
      icon: <Users className="h-4 w-4" />,
      storageKey: "people",
      items: [
        { id: "admin-users", label: "User Management", path: "/admin/users", icon: <Users className="h-5 w-5" /> },
        { id: "admin-staff", label: "Staff & Roles", path: "/admin/staff", icon: <UserCog className="h-5 w-5" /> },
        { id: "admin-safety", label: "Safety Analytics", path: "/admin/safety-analytics", icon: <PieChart className="h-5 w-5" /> },
        { id: "admin-invites", label: "Invite Codes", path: "/admin/invites", icon: <Ticket className="h-5 w-5" /> },
      ],
    },
    {
      label: "Platform Settings",
      icon: <Settings className="h-4 w-4" />,
      storageKey: "platform",
      items: [
        { id: "admin-credits", label: "Credit Management", path: "/admin/credits", icon: <Coins className="h-5 w-5" /> },
        { id: "admin-flags", label: "Feature Flags", path: "/admin/feature-flags", icon: <ToggleLeft className="h-5 w-5" /> },
        { id: "admin-email", label: "Email Templates", path: "/admin/email-templates", icon: <Mail className="h-5 w-5" /> },
        { id: "admin-review", label: "Review Settings", path: "/admin/review-settings", icon: <Star className="h-5 w-5" /> },
        { id: "admin-inspect", label: "Inspection Types", path: "/admin/inspection-types", icon: <ClipboardList className="h-5 w-5" /> },
        { id: "admin-systems", label: "Systems Used", path: "/admin/systems-used", icon: <Wrench className="h-5 w-5" /> },
        { id: "admin-checklists", label: "Checklists", path: "/admin/checklists", icon: <ClipboardList className="h-5 w-5" /> },
        { id: "admin-legal", label: "Legal & Help Center", path: "/admin/legal-help", icon: <Scale className="h-5 w-5" /> },
      ],
    },
    {
      label: "System",
      icon: <Activity className="h-4 w-4" />,
      storageKey: "system",
      items: [
        { id: "admin-audit", label: "Activity Log", path: "/admin/audit", icon: <Activity className="h-5 w-5" /> },
        { id: "admin-metrics", label: "System Metrics", path: "/admin/metrics", icon: <BarChart3 className="h-5 w-5" /> },
        { id: "admin-stripe", label: "Stripe Health", path: "/admin/stripe-health", icon: <CreditCard className="h-5 w-5" /> },
        { id: "admin-launch", label: "Launch Readiness", path: "/admin/launch-readiness", icon: <Rocket className="h-5 w-5" /> },
      ],
    },
    {
      label: "Broadcasts",
      icon: <Megaphone className="h-4 w-4" />,
      storageKey: "broadcasts",
      items: [
        { id: "admin-broadcasts", label: "Broadcasts", path: "/admin/broadcasts", icon: <Megaphone className="h-5 w-5" /> },
      ],
    },
  ];

  // Get role-specific feature items
  const featureItems = effectiveRole === "vendor" || isVendor ? vendorFeatureItems : repFeatureItems;
  
  // Separate pinned from unpinned features
  const pinnedFeatures = featureItems.filter((item) => isPinned(item.id)).sort((a, b) => a.label.localeCompare(b.label));
  const unpinnedFeatures = featureItems.filter((item) => !isPinned(item.id));

  const renderNavItem = (item: NavItem, showLabel: boolean = true, showPinIcon: boolean = false) => {
    const pathWithoutQuery = item.path.split("?")[0];
    const active = isActive(pathWithoutQuery);
    const pinned = item.pinnable && isPinned(item.id);
    const disabled = isDemo && !isDemoAvailable(item.path);
    
    const handleClick = () => {
      handleNavigation(item.path);
    };
    
    const content = (
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-3 h-10 px-3 group",
          active && "bg-accent text-accent-foreground font-medium",
          collapsed && "justify-center px-0",
          disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
        )}
        onClick={handleClick}
        disabled={false} // We handle disabling via the onClick logic
      >
        <span className={cn(active && "text-primary", disabled && "text-muted-foreground")}>{item.icon}</span>
        {showLabel && !collapsed && (
          <span className={cn("flex-1 text-left", disabled && "text-muted-foreground")}>{item.label}</span>
        )}
        {showLabel && !collapsed && item.badge !== undefined && item.badge > 0 && !disabled && (
          <CountBadge count={item.badge} />
        )}
        {/* Pin icon */}
        {showPinIcon && showLabel && !collapsed && item.pinnable && (
          <button
            onClick={(e) => handlePinClick(e, item.id)}
            className={cn(
              "p-1 rounded hover:bg-muted/80 transition-colors",
              pinned ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
            )}
            title={pinned ? "Unpin" : "Pin to sidebar"}
          >
            <Pin className={cn("h-3.5 w-3.5", pinned && "fill-current")} />
          </button>
        )}
        {collapsed && item.badge !== undefined && item.badge > 0 && !disabled && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-primary">
            {item.badge > 9 ? "9+" : item.badge}
          </Badge>
        )}
      </Button>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <div className="relative">{content}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.label}
            {disabled && <span className="text-xs text-muted-foreground">(Demo unavailable)</span>}
            {item.badge !== undefined && item.badge > 0 && !disabled && (
              <CountBadge count={item.badge} />
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.id}>{content}</div>;
  };

  const renderAdminFolder = (folder: AdminFolder) => {
    const isOpen = adminFolderStates[folder.storageKey] ?? false;
    const hasActiveItem = folder.items.some((item) => isActive(item.path.split("?")[0]));
    const totalBadge = folder.items.reduce((sum, item) => sum + (item.badge || 0), 0);

    if (collapsed) {
      // In collapsed mode, show first item with badge as icon
      const firstItem = folder.items[0];
      return (
        <Tooltip key={folder.storageKey}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-center h-10 px-0 relative",
                hasActiveItem && "bg-accent"
              )}
              onClick={() => {
                handleNavigation(firstItem.path);
              }}
            >
              {folder.icon}
              {totalBadge > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-primary">
                  {totalBadge > 9 ? "9+" : totalBadge}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{folder.label}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Collapsible
        key={folder.storageKey}
        open={isOpen || hasActiveItem}
        onOpenChange={() => toggleAdminFolder(folder.storageKey)}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-9 px-3 text-sm",
              hasActiveItem && "text-primary"
            )}
          >
            {folder.icon}
            <span className="flex-1 text-left font-medium">{folder.label}</span>
            {totalBadge > 0 && <CountBadge count={totalBadge} />}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform text-muted-foreground",
                (isOpen || hasActiveItem) && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4 mt-1 flex flex-col gap-0.5">
          {folder.items.map((item) => (
            <div key={item.id}>
              {renderNavItem(item)}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const userInitials = userProfile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const getRoleIdLabel = () => {
    if (isAdmin) {
      return "Admin";
    }
    if (effectiveRole === "vendor" || isVendor) {
      return userProfile?.vendor_anonymous_id || "Vendor";
    }
    return userProfile?.rep_anonymous_id || "FieldRep";
  };

  const roleIdLabel = getRoleIdLabel();
  
  // Get My Profile path based on role
  const myProfilePath = effectiveRole === "vendor" || isVendor ? "/vendor/profile" : "/rep/profile";

  // Avatar menu item click handler (demo-aware)
  const handleAvatarMenuClick = (path: string) => {
    handleNavigation(path);
  };

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
            <Link to={isDemo ? "/demo" : "/dashboard"} className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">ClearMarket</span>
              {isDemo && (
                <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded">
                  Demo
                </span>
              )}
              {!isDemo && <BetaBadge />}
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

        {/* Quick Action Button - disabled in demo */}
        {!isDemo && (
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
        )}

        {/* Search - disabled in demo */}
        {!isDemo && (
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
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3">
          <nav className="flex flex-col gap-1 py-2">
            {/* Admin Navigation - Collapsible Folders (NOT shown in demo) */}
            {isAdmin && !isDemo && (
              <>
                {!collapsed && (
                  <div className="px-3 py-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Admin
                    </span>
                  </div>
                )}
                {adminFolders.map((folder) => renderAdminFolder(folder))}
                
                <div className="my-2 h-px bg-border" />
              </>
            )}

            {/* Non-admin navigation */}
            {(!isAdmin || isDemo) && (
              <>
                {/* Primary items - ALWAYS VISIBLE */}
                {primaryItems.map((item) => renderNavItem(item))}

                {/* Pinned features (appear directly under Community) */}
                {pinnedFeatures.length > 0 && (
                  <>
                    {pinnedFeatures.map((item) => renderNavItem(item, true, true))}
                  </>
                )}

                {/* Divider before More */}
                <div className="my-2 h-px bg-border" />

                {/* More menu - contains all unpinned feature items */}
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
                      {unpinnedFeatures.map((item) => renderNavItem(item, true, true))}
                    </CollapsibleContent>
                  )}
                </Collapsible>
              </>
            )}

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
              {isDualRole && !isDemo && (
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
                      <span className="text-xs text-muted-foreground">Manage coverage</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {/* My Profile - in avatar menu */}
              <DropdownMenuItem 
                onClick={() => handleAvatarMenuClick(myProfilePath)}
                className={isDemo && !isDemoAvailable(myProfilePath) ? "opacity-50" : ""}
              >
                <User className="h-4 w-4 mr-2" />
                My Profile
                {isDemo && !isDemoAvailable(myProfilePath) && (
                  <span className="ml-auto text-xs text-muted-foreground">N/A</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleAvatarMenuClick("/settings")}
                className={isDemo ? "opacity-50" : ""}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
                {isDemo && <span className="ml-auto text-xs text-muted-foreground">N/A</span>}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleAvatarMenuClick("/safety")}
                className={isDemo ? "opacity-50" : ""}
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Safety Center
                {isDemo && <span className="ml-auto text-xs text-muted-foreground">N/A</span>}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleAvatarMenuClick("/help")}
                className={isDemo ? "opacity-50" : ""}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Help Center
                {isDemo && <span className="ml-auto text-xs text-muted-foreground">N/A</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className={isDemo ? "" : "text-destructive"}>
                <LogOut className="h-4 w-4 mr-2" />
                {isDemo ? "Exit Demo" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
