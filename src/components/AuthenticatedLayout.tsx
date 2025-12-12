import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedNav } from "@/components/AuthenticatedNav";
import { SiteFooter } from "@/components/SiteFooter";
import { MimicBanner } from "@/components/MimicBanner";

interface AuthenticatedLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared authenticated layout with consistent navbar and footer.
 * Use this for all authenticated pages to maintain consistent navigation.
 */
export function AuthenticatedLayout({ children, className = "" }: AuthenticatedLayoutProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { mimickedUser } = useMimic();
  const [profile, setProfile] = useState<{
    is_admin?: boolean;
    is_vendor_admin?: boolean;
    is_fieldrep?: boolean;
  } | null>(null);
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
      // If in mimic mode, use mimicked user's profile for nav display
      const targetUserId = mimickedUser?.id || user.id;
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("is_admin, is_vendor_admin, is_fieldrep")
        .eq("id", targetUserId)
        .single();

      setProfile(profileData);

      // Load vendor credits if user is a vendor
      if (profileData?.is_vendor_admin) {
        const { data: walletData } = await supabase
          .from("user_wallet")
          .select("credits")
          .eq("user_id", targetUserId)
          .maybeSingle();
        
        setVendorCredits(walletData?.credits ?? 0);
      }
    } catch (error) {
      console.error("Error loading profile for layout:", error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Show minimal loading state while checking auth
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
      <AuthenticatedNav 
        isAdmin={mimickedUser ? false : profile?.is_admin}
        isVendor={mimickedUser ? mimickedUser.is_vendor_admin : profile?.is_vendor_admin}
        isRep={mimickedUser ? mimickedUser.is_fieldrep : profile?.is_fieldrep}
        vendorCredits={vendorCredits}
      />
      <main className={`flex-1 ${className}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
