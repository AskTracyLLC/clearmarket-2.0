import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { TopNavRow } from "@/components/layout/TopNavRow";
import { CommandPalette, useCommandPalette } from "@/components/layout/CommandPalette";
import { MimicBanner } from "@/components/MimicBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  className?: string;
  hideTopNav?: boolean;
}

interface UserProfile {
  is_admin?: boolean;
  is_vendor_admin?: boolean;
  is_fieldrep?: boolean;
  full_name?: string;
  email?: string;
  rep_anonymous_id?: string;
  vendor_anonymous_id?: string;
}

export function AppShell({ children, className = "", hideTopNav = false }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { mimickedUser } = useMimic();
  const { collapsed, toggleCollapsed } = useSidebarState();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const isMobile = useIsMobile();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [vendorCredits, setVendorCredits] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (user) {
      loadProfile();
    }
  }, [user, authLoading, navigate, mimickedUser]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const targetUserId = mimickedUser?.id || user.id;
      
      // Fetch main profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("is_admin, is_vendor_admin, is_fieldrep, full_name, email")
        .eq("id", targetUserId)
        .single();

      // Fetch rep_profile anonymous_id if applicable
      let repAnonymousId: string | undefined;
      if (profileData?.is_fieldrep) {
        const { data: repProfile } = await supabase
          .from("rep_profile")
          .select("anonymous_id")
          .eq("user_id", targetUserId)
          .maybeSingle();
        repAnonymousId = repProfile?.anonymous_id ?? undefined;
      }

      // Fetch vendor_profile anonymous_id if applicable
      let vendorAnonymousId: string | undefined;
      if (profileData?.is_vendor_admin) {
        const { data: vendorProfile } = await supabase
          .from("vendor_profile")
          .select("anonymous_id")
          .eq("user_id", targetUserId)
          .maybeSingle();
        vendorAnonymousId = vendorProfile?.anonymous_id ?? undefined;
      }

      if (profileData) {
        setProfile({
          is_admin: profileData.is_admin ?? undefined,
          is_vendor_admin: profileData.is_vendor_admin ?? undefined,
          is_fieldrep: profileData.is_fieldrep ?? undefined,
          full_name: profileData.full_name ?? undefined,
          email: profileData.email ?? undefined,
          rep_anonymous_id: repAnonymousId,
          vendor_anonymous_id: vendorAnonymousId,
        });

        if (profileData.is_vendor_admin) {
          const { data: walletData } = await supabase
            .from("user_wallet")
            .select("credits")
            .eq("user_id", targetUserId)
            .maybeSingle();
          setVendorCredits(walletData?.credits ?? 0);
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setProfileLoading(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const sidebarProps = {
    collapsed: isMobile ? false : collapsed,
    onToggleCollapse: isMobile ? () => setMobileMenuOpen(false) : toggleCollapsed,
    onOpenSearch: () => {
      setMobileMenuOpen(false);
      setCommandOpen(true);
    },
    isAdmin: mimickedUser ? false : profile?.is_admin,
    isVendor: mimickedUser ? mimickedUser.is_vendor_admin : profile?.is_vendor_admin,
    isRep: mimickedUser ? mimickedUser.is_fieldrep : profile?.is_fieldrep,
    vendorCredits,
    userProfile: profile,
    onNavigate: isMobile ? () => setMobileMenuOpen(false) : undefined,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <MimicBanner />
      
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
            </header>
          )}

          {/* Top nav row - hide on mobile as it's redundant */}
          {!hideTopNav && !isMobile && (
            <TopNavRow
              isVendor={mimickedUser ? mimickedUser.is_vendor_admin : profile?.is_vendor_admin}
              isRep={mimickedUser ? mimickedUser.is_fieldrep : profile?.is_fieldrep}
              vendorCredits={vendorCredits}
            />
          )}

          {/* Page content */}
          <main className={cn("flex-1", className)}>{children}</main>

          {/* Footer */}
          <SiteFooter />
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
