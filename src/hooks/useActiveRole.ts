import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";

export type ActiveRole = "rep" | "vendor" | null;

interface UseActiveRoleResult {
  activeRole: ActiveRole;
  isDualRole: boolean;
  isRep: boolean;
  isVendor: boolean;
  isVendorStaff: boolean;
  effectiveRole: "rep" | "vendor" | null;
  loading: boolean;
  switchRole: (role: "rep" | "vendor") => Promise<void>;
}

/**
 * Hook to manage the active role for dual-role users (both Field Rep and Vendor).
 * Returns the current active role and a function to switch roles.
 * For single-role users, the role is determined by their profile flags.
 * Supports mimic mode - will return the mimicked user's role when active.
 */
export function useActiveRole(): UseActiveRoleResult {
  const { user } = useAuth();
  const { mimickedUser, effectiveUserId } = useMimic();
  const [activeRole, setActiveRole] = useState<ActiveRole>(null);
  const [isFieldRep, setIsFieldRep] = useState(false);
  const [isVendorAdmin, setIsVendorAdmin] = useState(false);
  const [isVendorStaff, setIsVendorStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If in mimic mode, use mimicked user's role flags directly
    if (mimickedUser) {
      setIsFieldRep(mimickedUser.is_fieldrep || false);
      setIsVendorAdmin(mimickedUser.is_vendor_admin || false);
      setIsVendorStaff(mimickedUser.is_vendor_staff || false);
      setActiveRole(null); // Reset active role, will be determined by flags
      setLoading(false);
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    const loadRoleData = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_fieldrep, is_vendor_admin, is_vendor_staff, active_role")
          .eq("id", user.id)
          .single();

        if (profile) {
          setIsFieldRep(profile.is_fieldrep || false);
          setIsVendorAdmin(profile.is_vendor_admin || false);
          setIsVendorStaff(profile.is_vendor_staff || false);
          setActiveRole((profile.active_role as ActiveRole) || null);
        }
      } catch (error) {
        console.error("Error loading role data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRoleData();
  }, [user, mimickedUser]);

  // Vendor access = admin OR staff
  const hasVendorAccess = isVendorAdmin || isVendorStaff;
  const isDualRole = isFieldRep && isVendorAdmin;

  // Determine the effective role based on flags and active_role
  const effectiveRole: "rep" | "vendor" | null = (() => {
    if (isDualRole) {
      // For dual-role users, use active_role if set, otherwise default to 'rep'
      return activeRole || "rep";
    }
    if (isFieldRep) return "rep";
    // Vendor staff or vendor admin both get "vendor" effective role
    if (hasVendorAccess) return "vendor";
    return null;
  })();

  const switchRole = useCallback(async (role: "rep" | "vendor") => {
    if (!user) return;
    
    // Guardrail: prevent setting vendor role without vendor access (admin or staff)
    if (role === "vendor" && !hasVendorAccess) {
      console.error("Cannot switch to vendor role: user does not have vendor access");
      return;
    }
    
    // Guardrail: prevent setting rep role without is_fieldrep flag
    if (role === "rep" && !isFieldRep) {
      console.error("Cannot switch to rep role: user is not a field rep");
      return;
    }
    
    // Only allow switching if user has both roles (dual-role user)
    if (!isDualRole) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ active_role: role })
        .eq("id", user.id);

      if (error) {
        console.error("Error switching role:", error);
        return;
      }

      setActiveRole(role);
    } catch (error) {
      console.error("Error switching role:", error);
    }
  }, [user, isDualRole, isFieldRep, hasVendorAccess]);

  return {
    activeRole,
    isDualRole,
    isRep: isFieldRep,
    isVendor: hasVendorAccess, // Staff or admin = vendor access
    isVendorStaff,
    effectiveRole,
    loading,
    switchRole,
  };
}
