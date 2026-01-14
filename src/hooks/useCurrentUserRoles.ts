import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMimic } from "@/hooks/useMimic";
import { supabase } from "@/integrations/supabase/client";
import { 
  RoleFlags, 
  RoleState, 
  computeRoleState,
  hasAnyRole,
} from "@/lib/roleUtils";

interface UseCurrentUserRolesReturn extends RoleState {
  loading: boolean;
  /** Raw flags from profile - use RoleState properties instead where possible */
  flags: RoleFlags | null;
  /** Whether user has any valid role (rep/vendor/staff/admin) */
  hasRole: boolean;
  /** Refresh role data from database */
  refresh: () => Promise<void>;
}

/**
 * Hook to get the current user's role state.
 * Supports mimic mode - returns mimicked user's roles when active.
 * 
 * Use this instead of scattered profile queries for role checks.
 * For permission checks, use usePermissions() instead.
 */
export function useCurrentUserRoles(): UseCurrentUserRolesReturn {
  const { user, loading: authLoading } = useAuth();
  const { mimickedUser, effectiveUserId } = useMimic();
  
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<RoleFlags | null>(null);
  const [activeRole, setActiveRole] = useState<"rep" | "vendor" | null>(null);

  const loadRoles = useCallback(async () => {
    // If in mimic mode, use mimicked user's flags directly
    // Note: MimickedUser only has rep/vendor flags, not platform staff flags
    if (mimickedUser) {
      const mimicFlags: RoleFlags = {
        is_fieldrep: mimickedUser.is_fieldrep,
        is_vendor_admin: mimickedUser.is_vendor_admin,
        is_vendor_staff: mimickedUser.is_vendor_staff,
        // Platform staff flags not available in mimic mode (admins mimic regular users)
        is_admin: false,
        is_moderator: false,
        is_support: false,
        email: mimickedUser.email,
      };
      setFlags(mimicFlags);
      setActiveRole(null); // Mimic mode doesn't preserve active_role selection
      setLoading(false);
      return;
    }

    if (!user) {
      setFlags(null);
      setActiveRole(null);
      setLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(`
          is_fieldrep,
          is_vendor_admin,
          is_vendor_staff,
          is_admin,
          is_moderator,
          is_support,
          is_super_admin,
          email,
          active_role
        `)
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[useCurrentUserRoles] Error loading profile:", error);
      }

      if (profile) {
        setFlags({
          is_fieldrep: profile.is_fieldrep,
          is_vendor_admin: profile.is_vendor_admin,
          is_vendor_staff: profile.is_vendor_staff,
          is_admin: profile.is_admin,
          is_moderator: profile.is_moderator,
          is_support: profile.is_support,
          is_super_admin: profile.is_super_admin,
          email: profile.email,
        });
        setActiveRole(profile.active_role as "rep" | "vendor" | null);
      } else {
        // Fallback to user email if profile not found
        setFlags({ email: user.email });
        setActiveRole(null);
      }
    } catch (err) {
      console.error("[useCurrentUserRoles] Unexpected error:", err);
      setFlags({ email: user?.email });
    } finally {
      setLoading(false);
    }
  }, [user, mimickedUser]);

  useEffect(() => {
    if (authLoading) return;
    loadRoles();
  }, [authLoading, loadRoles]);

  // Compute derived role state
  const roleState = computeRoleState(flags, activeRole);
  const hasRole = hasAnyRole(flags);

  return {
    loading,
    flags,
    hasRole,
    refresh: loadRoles,
    ...roleState,
  };
}
