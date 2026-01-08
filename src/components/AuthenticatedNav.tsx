import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { NavIconCluster } from "@/components/NavIconCluster";
import { CountBadge } from "@/components/CountBadge";
import { BetaBadge } from "@/components/BetaBadge";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { useSectionCounts } from "@/hooks/useSectionCounts";
import { Briefcase, Users, ShieldAlert, MessageSquare, FileSearch, Wrench, Menu, Map, FileText } from "lucide-react";
import { signOut } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AuthenticatedNavProps {
  isAdmin?: boolean;
  isVendor?: boolean;
  isRep?: boolean;
  vendorCredits?: number | null;
}

export function AuthenticatedNav({ isAdmin, isVendor, vendorCredits }: AuthenticatedNavProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const sectionCounts = useSectionCounts();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="text-xl font-bold text-foreground hover:text-primary transition-colors flex items-center gap-2">
              ClearMarket
              <BetaBadge />
            </Link>
            <nav className="hidden md:flex gap-6">
              <NavLink 
                to="/dashboard" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                activeClassName="text-primary"
              >
                <Briefcase className="w-4 h-4" />
                Dashboard
              </NavLink>
              <NavLink 
                to="/community" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                activeClassName="text-primary"
              >
                <Users className="w-4 h-4" />
                Community
              </NavLink>
              <NavLink 
                to="/safety" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                activeClassName="text-primary"
              >
                <ShieldAlert className="w-4 h-4" />
                Safety
              </NavLink>
              <NavLink 
                to="/tools" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                activeClassName="text-primary"
              >
                <Wrench className="w-4 h-4" />
                Tools
              </NavLink>
              <NavLink 
                to="/coverage-map" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                activeClassName="text-primary"
              >
                <Map className="w-4 h-4" />
                Map
              </NavLink>
              {/* Vendor-only: Seeking Coverage link with interest badge */}
              {isVendor && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink 
                          to="/vendor/seeking-coverage" 
                          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                          activeClassName="text-primary"
                        >
                          <FileSearch className="w-4 h-4" />
                          Seeking Coverage
                          {sectionCounts.vendorPostsWithInterest > 0 && (
                            <CountBadge count={sectionCounts.vendorPostsWithInterest} className="ml-1" />
                          )}
                        </NavLink>
                      </TooltipTrigger>
                      {sectionCounts.vendorPostsWithInterest > 0 && (
                        <TooltipContent>
                          <p>You have {sectionCounts.vendorPostsWithInterest} Seeking Coverage post{sectionCounts.vendorPostsWithInterest !== 1 ? 's' : ''} with interested reps.</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <NavLink 
                    to="/vendor/proposals" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                    activeClassName="text-primary"
                  >
                    <FileText className="w-4 h-4" />
                    Proposals
                  </NavLink>
                </>
              )}
              {isAdmin && (
                <>
                  <NavLink 
                    to="/messages" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                    activeClassName="text-primary"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Messages
                    <CountBadge count={sectionCounts.unreadMessages} className="ml-1" />
                  </NavLink>
                  <NavLink 
                    to="/admin/moderation" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2" 
                    activeClassName="text-primary"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Admin
                    <CountBadge count={sectionCounts.adminOpenReports + sectionCounts.adminOpenTickets} className="ml-1" />
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {/* Mobile hamburger menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    ClearMarket
                    <BetaBadge />
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-6">
                  <NavLink 
                    to="/dashboard" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                    activeClassName="text-primary"
                    onClick={closeMobileMenu}
                  >
                    <Briefcase className="w-4 h-4" />
                    Dashboard
                  </NavLink>
                  <NavLink 
                    to="/community" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                    activeClassName="text-primary"
                    onClick={closeMobileMenu}
                  >
                    <Users className="w-4 h-4" />
                    Community
                  </NavLink>
                  <NavLink 
                    to="/safety" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                    activeClassName="text-primary"
                    onClick={closeMobileMenu}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Safety
                  </NavLink>
                  <NavLink 
                    to="/tools" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                    activeClassName="text-primary"
                    onClick={closeMobileMenu}
                  >
                    <Wrench className="w-4 h-4" />
                    Tools
                  </NavLink>
                  <NavLink 
                    to="/coverage-map" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                    activeClassName="text-primary"
                    onClick={closeMobileMenu}
                  >
                    <Map className="w-4 h-4" />
                    Map
                  </NavLink>
                  {isVendor && (
                    <>
                      <NavLink 
                        to="/vendor/seeking-coverage" 
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                        activeClassName="text-primary"
                        onClick={closeMobileMenu}
                      >
                        <FileSearch className="w-4 h-4" />
                        Seeking Coverage
                        {sectionCounts.vendorPostsWithInterest > 0 && (
                          <CountBadge count={sectionCounts.vendorPostsWithInterest} className="ml-1" />
                        )}
                      </NavLink>
                      <NavLink 
                        to="/vendor/proposals" 
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                        activeClassName="text-primary"
                        onClick={closeMobileMenu}
                      >
                        <FileText className="w-4 h-4" />
                        Proposals
                      </NavLink>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <NavLink 
                        to="/messages" 
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                        activeClassName="text-primary"
                        onClick={closeMobileMenu}
                      >
                        <MessageSquare className="w-4 h-4" />
                        Messages
                        <CountBadge count={sectionCounts.unreadMessages} className="ml-1" />
                      </NavLink>
                      <NavLink 
                        to="/admin/moderation" 
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 py-2" 
                        activeClassName="text-primary"
                        onClick={closeMobileMenu}
                      >
                        <ShieldAlert className="w-4 h-4" />
                        Admin
                        <CountBadge count={sectionCounts.adminOpenReports + sectionCounts.adminOpenTickets} className="ml-1" />
                      </NavLink>
                    </>
                  )}
                  <div className="border-t border-border pt-4 mt-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { handleSignOut(); closeMobileMenu(); }}>
                      Sign Out
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
            
            <RoleSwitcher />
            <NavIconCluster 
              vendorCredits={vendorCredits} 
              showCredits={isVendor} 
            />
            <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden md:inline-flex">
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
