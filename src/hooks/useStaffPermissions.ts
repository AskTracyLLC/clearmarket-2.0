import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getRoleFromProfile,
  getPermissionsForProfile,
  isSuperAdminFromProfile,
  StaffPermissions,
  StaffRole,
  ProfileForRoleCheck,
} from "@/lib/staffPermissions";

interface UseStaffPermissionsReturn {
  loading: boolean;
  role: StaffRole;
  permissions: StaffPermissions;
  isSuperAdmin: boolean;
}

export function useStaffPermissions(): UseStaffPermissionsReturn {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<StaffRole>("none");
  const [permissions, setPermissions] = useState<StaffPermissions>(() => getPermissionsForProfile(null));
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      
      if (!user) {
        setRole("none");
        setPermissions(getPermissionsForProfile(null));
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_admin, is_moderator, is_support, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile for staff permissions:", error);
      }

      const effectiveProfile: ProfileForRoleCheck = profile || {};
      const r = getRoleFromProfile(effectiveProfile);
      setRole(r);
      setPermissions(getPermissionsForProfile(effectiveProfile));
      setIsSuperAdmin(isSuperAdminFromProfile(effectiveProfile));
      setLoading(false);
    };

    load();
  }, [user, authLoading]);

  return { loading, role, permissions, isSuperAdmin };
}
