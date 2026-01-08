import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { useSidebarState } from "@/hooks/useSidebarState";
import { supabase } from "@/integrations/supabase/client";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { TopNavRow } from "@/components/layout/TopNavRow";
import { CommandPalette, useCommandPalette } from "@/components/layout/CommandPalette";
import { MimicBanner } from "@/components/MimicBanner";
import { SiteFooter } from "@/components/SiteFooter";
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
}

export function AppShell({ children, className = "", hideTopNav = false }: AppShellProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { mimickedUser } = useMimic();
  const { collapsed, toggleCollapsed } = useSidebarState();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [vendorCredits, setVendorCredits] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }
    if (user) {
      loadProfile();
    }
  }, [user, authLoading, navigate, mimickedUser]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const targetUserId = mimickedUser?.id || user.id;
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("is_admin, is_vendor_admin, is_fieldrep, full_name, email")
        .eq("id", targetUserId)
        .single();

      if (profileData) {
        setProfile({
          is_admin: profileData.is_admin ?? undefined,
          is_vendor_admin: profileData.is_vendor_admin ?? undefined,
          is_fieldrep: profileData.is_fieldrep ?? undefined,
          full_name: profileData.full_name ?? undefined,
          email: profileData.email ?? undefined,
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

  return (
    <div className="min-h-screen flex flex-col">
      <MimicBanner />
      <div className="flex flex-1">
        <LeftSidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          onOpenSearch={() => setCommandOpen(true)}
          isAdmin={mimickedUser ? false : profile?.is_admin}
          isVendor={mimickedUser ? mimickedUser.is_vendor_admin : profile?.is_vendor_admin}
          isRep={mimickedUser ? mimickedUser.is_fieldrep : profile?.is_fieldrep}
          vendorCredits={vendorCredits}
          userProfile={profile}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {!hideTopNav && (
            <TopNavRow
              isVendor={mimickedUser ? mimickedUser.is_vendor_admin : profile?.is_vendor_admin}
              isRep={mimickedUser ? mimickedUser.is_fieldrep : profile?.is_fieldrep}
              vendorCredits={vendorCredits}
            />
          )}
          <main className={cn("flex-1", className)}>{children}</main>
          <SiteFooter />
        </div>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
