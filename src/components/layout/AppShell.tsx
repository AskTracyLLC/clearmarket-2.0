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
import { resolveCurrentVendorId, getVendorWalletBalance } from "@/lib/vendorWallet";

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
  const [repCredits, setRepCredits] = useState<number | null>(null);
  const [isVendorMember, setIsVendorMember] = useState(false); // True if owner or staff
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
      anonymous_id?: string | null;
    } | null = null;

    // Fetch main profile (self-only RLS) - email removed for privacy
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin, is_vendor_admin, is_fieldrep, full_name, anonymous_id")
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

    // profiles.anonymous_id is now the canonical source - no need to fetch from rep_profile
    // The rep_anonymous_id is set to the same value as profiles.anonymous_id
    const repAnonymousId = profileData?.is_fieldrep ? (profileData?.anonymous_id ?? undefined) : undefined;

    // Fetch vendor_profile anonymous_id if applicable (for vendor-specific display name)
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
      anonymous_id: profileData?.anonymous_id ?? undefined,
      rep_anonymous_id: repAnonymousId,
      vendor_anonymous_id: vendorAnonymousId,
    });

    // Fetch vendor credits from shared vendor_wallet (for owner or staff)
    // First check if user is vendor owner or vendor staff
    const isVendorOwner = profileData?.is_vendor_admin;
    let isVendorStaff = false;
    
    if (!isVendorOwner) {
      // Check if user is active vendor staff
      const { data: staffRecord } = await supabase
        .from("vendor_staff")
        .select("vendor_id")
        .eq("staff_user_id", targetUserId)
        .eq("status", "active")
        .maybeSingle();
      
      isVendorStaff = !!staffRecord;
    }

    if (isVendorOwner || isVendorStaff) {
      setIsVendorMember(true);
      try {
        const resolvedVendorId = await resolveCurrentVendorId(targetUserId);
        if (resolvedVendorId) {
          const balance = await getVendorWalletBalance(resolvedVendorId);
          setVendorCredits(balance ?? 0);
        }
      } catch (err) {
        console.warn("AppShell: Unexpected error fetching vendor credits:", err);
      }
    } else {
      setIsVendorMember(false);
    }

    // Fetch rep credits if user is a rep
    if (profileData?.is_fieldrep) {
      try {
        const { data: walletData } = await supabase
          .from("user_wallet")
          .select("credits")
          .eq("user_id", targetUserId)
          .maybeSingle();
        setRepCredits(walletData?.credits ?? 0);
      } catch (err) {
        console.warn("AppShell: Error fetching rep credits:", err);
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
    isVendor: mimickedUser ? mimickedUser.is_vendor_admin : (profile?.is_vendor_admin || isVendorMember),
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
              isVendor={mimickedUser ? mimickedUser.is_vendor_admin : (profile?.is_vendor_admin || isVendorMember)}
              isRep={mimickedUser ? mimickedUser.is_fieldrep : profile?.is_fieldrep}
              isAdmin={mimickedUser ? false : profile?.is_admin}
              vendorCredits={vendorCredits}
              repCredits={repCredits}
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
