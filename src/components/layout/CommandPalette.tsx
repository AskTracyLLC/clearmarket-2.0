import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Home, Users, MessageSquare, FileSearch, Briefcase, Map, ShieldAlert, Wrench, FileText, CreditCard, Settings, Star, Building2, Bell, HelpCircle, Rocket } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

interface NavDestination {
  label: string;
  path: string;
  icon: React.ReactNode;
  keywords?: string[];
  roles?: ("rep" | "vendor" | "admin")[];
}

const allDestinations: NavDestination[] = [
  // Common
  { label: "Dashboard", path: "/dashboard", icon: <Home className="h-4 w-4" />, keywords: ["home"] },
  { label: "Messages", path: "/messages", icon: <MessageSquare className="h-4 w-4" />, keywords: ["inbox", "chat"] },
  { label: "Community", path: "/community", icon: <Users className="h-4 w-4" />, keywords: ["forum", "posts"] },
  { label: "Safety Center", path: "/safety", icon: <ShieldAlert className="h-4 w-4" />, keywords: ["security", "report"] },
  { label: "Coverage Map", path: "/coverage-map", icon: <Map className="h-4 w-4" />, keywords: ["map", "regions"] },
  { label: "Tools", path: "/tools", icon: <Wrench className="h-4 w-4" />, keywords: ["utilities"] },
  { label: "Settings", path: "/settings", icon: <Settings className="h-4 w-4" />, keywords: ["preferences", "account"] },
  { label: "Help Center", path: "/help", icon: <HelpCircle className="h-4 w-4" />, keywords: ["support", "faq"] },
  
  // Vendor-only
  { label: "Seeking Coverage", path: "/vendor/seeking-coverage", icon: <FileSearch className="h-4 w-4" />, keywords: ["posts", "coverage"], roles: ["vendor"] },
  { label: "My Reps", path: "/vendor/my-reps", icon: <Users className="h-4 w-4" />, keywords: ["network", "contractors"], roles: ["vendor"] },
  { label: "Interested Reps", path: "/vendor/interested-reps", icon: <Bell className="h-4 w-4" />, keywords: ["applicants", "interest"], roles: ["vendor"] },
  { label: "Proposals", path: "/vendor/proposals", icon: <FileText className="h-4 w-4" />, keywords: ["quotes", "pricing"], roles: ["vendor"] },
  { label: "Credits", path: "/vendor/credits", icon: <CreditCard className="h-4 w-4" />, keywords: ["balance", "purchase"], roles: ["vendor"] },
  { label: "Reviews", path: "/vendor/reviews", icon: <Star className="h-4 w-4" />, keywords: ["ratings", "feedback"], roles: ["vendor"] },
  { label: "Vendor Profile", path: "/vendor/profile", icon: <Building2 className="h-4 w-4" />, keywords: ["company", "settings"], roles: ["vendor"] },
  
  // Rep-only
  { label: "Find Work", path: "/rep/find-work", icon: <Briefcase className="h-4 w-4" />, keywords: ["opportunities", "jobs"], roles: ["rep"] },
  { label: "My Vendors", path: "/rep/my-vendors", icon: <Building2 className="h-4 w-4" />, keywords: ["network", "companies"], roles: ["rep"] },
  { label: "My Coverage", path: "/work-setup", icon: <Map className="h-4 w-4" />, keywords: ["areas", "rates"], roles: ["rep"] },
  { label: "My Profile", path: "/rep/profile", icon: <Briefcase className="h-4 w-4" />, keywords: ["bio", "settings"], roles: ["rep"] },
  { label: "Reviews", path: "/rep/reviews", icon: <Star className="h-4 w-4" />, keywords: ["ratings", "feedback"], roles: ["rep"] },
  
  // Admin-only
  { label: "Support Queue", path: "/admin/support-queue", icon: <ShieldAlert className="h-4 w-4" />, keywords: ["moderate", "queue"], roles: ["admin"] },
  { label: "Violation Review", path: "/admin/support-queue?category=violation_review", icon: <ShieldAlert className="h-4 w-4" />, keywords: ["reports", "flags", "moderation"], roles: ["admin"] },
  { label: "User Management", path: "/admin/users", icon: <Users className="h-4 w-4" />, keywords: ["accounts"], roles: ["admin"] },
  { label: "Broadcasts", path: "/admin/broadcasts", icon: <Bell className="h-4 w-4" />, keywords: ["announcements"], roles: ["admin"] },
  { label: "Support Tickets", path: "/admin/support", icon: <MessageSquare className="h-4 w-4" />, keywords: ["tickets", "help"], roles: ["admin"] },
  { label: "Launch Readiness", path: "/admin/launch-readiness", icon: <Rocket className="h-4 w-4" />, keywords: ["launch", "checks", "deploy"], roles: ["admin"] },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { effectiveRole, isVendor, isRep } = useActiveRole();
  const { permissions } = useStaffPermissions();
  const isAdmin = permissions.canViewModeration || permissions.canViewSupportQueue;

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    onOpenChange(false);
  }, [navigate, onOpenChange]);

  // Filter destinations based on role
  const filteredDestinations = allDestinations.filter((dest) => {
    if (!dest.roles) return true; // Common destinations
    if (dest.roles.includes("vendor") && (effectiveRole === "vendor" || isVendor)) return true;
    if (dest.roles.includes("rep") && (effectiveRole === "rep" || isRep)) return true;
    if (dest.roles.includes("admin") && isAdmin) return true;
    return false;
  });

  // Group destinations
  const commonDests = filteredDestinations.filter(d => !d.roles);
  const roleDests = filteredDestinations.filter(d => d.roles);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          {commonDests.map((dest) => (
            <CommandItem
              key={dest.path}
              value={`${dest.label} ${dest.keywords?.join(" ") || ""}`}
              onSelect={() => handleSelect(dest.path)}
              className="flex items-center gap-2 cursor-pointer"
            >
              {dest.icon}
              <span>{dest.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {roleDests.length > 0 && (
          <CommandGroup heading={effectiveRole === "vendor" ? "Vendor" : effectiveRole === "rep" ? "Field Rep" : isAdmin ? "Admin" : "More"}>
            {roleDests.map((dest) => (
              <CommandItem
                key={dest.path}
                value={`${dest.label} ${dest.keywords?.join(" ") || ""}`}
                onSelect={() => handleSelect(dest.path)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {dest.icon}
                <span>{dest.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Hook to manage command palette state with keyboard shortcut
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, setOpen };
}
