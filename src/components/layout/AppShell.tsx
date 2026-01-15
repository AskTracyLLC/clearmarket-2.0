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
  anonymous_id?: string;
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
      // Fire-and-forget: stamp dashboard access + assign anon id if eligible
      supabase.rpc("ensure_anon_id_after_terms_and_dashboard").then(({ error }) => {
        if (error) console.warn("ensure_anon_id_after_terms_and_dashboard error:", error.message);
      });
    }
  }, [user, authLoading, navigate, mimickedUser]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const loadProfile = async () => {
    if (!user) return;
    const targetUserId = mimickedUser?.id || user.id;
    
    let profileData: {
      is_admin?: boolean | null;
      is_vendor_admin?: boolean | null;
      is_fieldrep?: boolean | null;
      full_name?: string | null;
      email?: string | null;
      anonymous_id?: string | null;
    } | null = null;

    // Fetch main profile (self-only RLS)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin, is_vendor_admin, is_fieldrep, full_name, email, anonymous_id")
        .eq("id", targetUserId)
        .maybeSingle();
      
      if (error) {
        console.warn("AppShell: Could not fetch profiles row (RLS or permission issue):", error.message);
      } else {
        profileData = data;
      }
    } catch (err) {
      console.warn("AppShell: Unexpected error fetching profile:", err);
    }

    // Fetch rep anonymous_id from rep_profile_public view (self-only via RLS on underlying table)
    let repAnonymousId: string | undefined;
    if (profileData?.is_fieldrep) {
      try {
        const { data: repProfile, error } = await supabase
          .from("rep_profile_public")
          .select("anonymous_id")
          .eq("user_id", targetUserId)
          .maybeSingle();
        
        if (error) {
          console.warn("AppShell: Could not fetch rep_profile_public anonymous_id:", error.message);
        } else {
          repAnonymousId = repProfile?.anonymous_id ?? undefined;
        }
      } catch (err) {
        console.warn("AppShell: Unexpected error fetching rep anonymous_id:", err);
      }
    }

    // Fetch vendor_profile anonymous_id if applicable
    let vendorAnonymousId: string | undefined;
    if (profileData?.is_vendor_admin) {
      try {
        const { data: vendorProfile, error } = await supabase
          .from("vendor_profile")
          .select("anonymous_id")
          .eq("user_id", targetUserId)
          .maybeSingle();
        
        if (error) {
          console.warn("AppShell: Could not fetch vendor_profile anonymous_id:", error.message);
        } else {
          vendorAnonymousId = vendorProfile?.anonymous_id ?? undefined;
        }
      } catch (err) {
        console.warn("AppShell: Unexpected error fetching vendor anonymous_id:", err);
      }
    }

    // Set profile with fallbacks - profiles.anonymous_id is source of truth
    setProfile({
      is_admin: profileData?.is_admin ?? undefined,
      is_vendor_admin: profileData?.is_vendor_admin ?? undefined,
      is_fieldrep: profileData?.is_fieldrep ?? undefined,
      full_name: profileData?.full_name ?? undefined,
      email: profileData?.email ?? undefined,
      anonymous_id: profileData?.anonymous_id ?? undefined,
      rep_anonymous_id: repAnonymousId,
      vendor_anonymous_id: vendorAnonymousId,
    });

    // Fetch vendor credits if applicable
    if (profileData?.is_vendor_admin) {
      try {
        const { data: walletData, error } = await supabase
          .from("user_wallet")
          .select("credits")
          .eq("user_id", targetUserId)
          .maybeSingle();
        
        if (error) {
          console.warn("AppShell: Could not fetch vendor credits:", error.message);
        } else {
          setVendorCredits(walletData?.credits ?? 0);
        }
      } catch (err) {
        console.warn("AppShell: Unexpected error fetching credits:", err);
      }
    }

    setProfileLoading(false);
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
              isAdmin={mimickedUser ? false : profile?.is_admin}
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
