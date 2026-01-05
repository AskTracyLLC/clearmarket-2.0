import { Briefcase, Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useActiveRole } from "@/hooks/useActiveRole";

/**
 * Role switcher dropdown for dual-role users who are both Field Rep and Vendor.
 * Shows a dropdown to switch between roles in the top nav.
 * Only renders if user has both roles.
 */
export function RoleSwitcher() {
  const { isDualRole, effectiveRole, switchRole, loading } = useActiveRole();

  // Don't render if not a dual-role user or still loading
  if (!isDualRole || loading) {
    return null;
  }

  const isActingAsRep = effectiveRole === "rep";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          {isActingAsRep ? (
            <>
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Field Rep</span>
            </>
          ) : (
            <>
              <Building2 className="h-3.5 w-3.5 text-secondary" />
              <span className="hidden sm:inline">Vendor</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem 
          onClick={() => switchRole("rep")}
          className={effectiveRole === "rep" ? "bg-accent" : ""}
        >
          <Briefcase className="h-4 w-4 mr-2 text-primary" />
          <div className="flex flex-col">
            <span>Field Rep</span>
            <span className="text-xs text-muted-foreground">Perform inspections</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => switchRole("vendor")}
          className={effectiveRole === "vendor" ? "bg-accent" : ""}
        >
          <Building2 className="h-4 w-4 mr-2 text-secondary" />
          <div className="flex flex-col">
            <span>Vendor</span>
            <span className="text-xs text-muted-foreground">Assign work to reps</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
