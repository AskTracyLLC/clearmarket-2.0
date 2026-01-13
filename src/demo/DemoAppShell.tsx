import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

interface DemoAppShellProps {
  children: ReactNode;
  role: "vendor" | "rep";
}

/**
 * Demo App Shell - uses the same LeftSidebar as production but with demo mode enabled.
 * Includes demo banner and no database/payment operations.
 */
export function DemoAppShell({ children, role }: DemoAppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed, toggleCollapsed } = useSidebarState();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Mock user profile for demo
  const demoProfile = {
    full_name: role === "vendor" ? "NorthStar Demo" : "Demo Rep",
    email: "demo@clearmarket.io",
    rep_anonymous_id: "FieldRep#DEMO",
    vendor_anonymous_id: "Vendor#DEMO",
  };

  const sidebarProps = {
    collapsed: isMobile ? false : collapsed,
    onToggleCollapse: isMobile ? () => setMobileMenuOpen(false) : toggleCollapsed,
    onOpenSearch: () => {}, // No search in demo
    isAdmin: false,
    isVendor: role === "vendor",
    isRep: role === "rep",
    vendorCredits: role === "vendor" ? 100 : null,
    userProfile: demoProfile,
    onNavigate: isMobile ? () => setMobileMenuOpen(false) : undefined,
    isDemo: true,
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Demo Banner */}
      <div className="bg-yellow-500 text-yellow-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-4 flex-wrap">
        <span>🎮 DEMO MODE — No real data, no payments</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/demo")}
          className="bg-yellow-400 border-yellow-600 text-yellow-950 hover:bg-yellow-300"
        >
          <LogOut className="h-4 w-4 mr-1" />
          Exit Demo
        </Button>
      </div>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <LeftSidebar {...sidebarProps} />
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header with hamburger */}
          {isMobile && (
            <header className="border-b border-border bg-card sticky top-0 z-40 flex items-center gap-3 px-4 py-3">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <LeftSidebar {...sidebarProps} />
                </SheetContent>
              </Sheet>
              <span className="font-semibold text-foreground">ClearMarket</span>
              <span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded">
                Demo
              </span>
            </header>
          )}

          {/* Page content */}
          <main className="flex-1">{children}</main>

          {/* Footer */}
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
