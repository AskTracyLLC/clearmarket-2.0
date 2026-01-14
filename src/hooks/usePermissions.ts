import { useCurrentUserRoles } from "@/hooks/useCurrentUserRoles";

/**
 * Capability-based permissions for UI gating.
 * Use these instead of checking role flags directly.
 * 
 * Example:
 * ```tsx
 * const { canViewVendorDashboard, canManageBilling } = usePermissions();
 * 
 * if (!canViewVendorDashboard) {
 *   navigate("/dashboard");
 *   return;
 * }
 * ```
 */
export interface Permissions {
  // ============================================================================
  // VENDOR PERMISSIONS
  // ============================================================================
  
  /** Can access vendor dashboard and tools (vendor_admin OR vendor_staff) */
  canViewVendorDashboard: boolean;
  
  /** Can edit vendor profile settings (vendor_admin OR vendor_staff) */
  canEditVendorProfile: boolean;
  
  /** Can post Seeking Coverage and use vendor tools (vendor_admin OR vendor_staff) */
  canUseVendorTools: boolean;
  
  /** Can unlock rep contact details (vendor_admin OR vendor_staff) */
  canUnlockRepContacts: boolean;
  
  /** Can invite new vendor staff members (vendor_admin ONLY) */
  canInviteVendorStaff: boolean;
  
  /** Can disable/manage vendor staff members (vendor_admin ONLY) */
  canManageVendorStaff: boolean;
  
  /** Can access billing, credits, and Stripe settings (vendor_admin ONLY) */
  canManageBilling: boolean;
  
  /** Can view staff performance metrics (vendor_admin + platform admins) */
  canViewStaffMetrics: boolean;

  // ============================================================================
  // FIELD REP PERMISSIONS
  // ============================================================================
  
  /** Can access field rep dashboard and tools */
  canViewRepDashboard: boolean;
  
  /** Can edit field rep profile */
  canEditRepProfile: boolean;
  
  /** Can use rep tools (find work, express interest, etc.) */
  canUseRepTools: boolean;

  // ============================================================================
  // PLATFORM ADMIN PERMISSIONS
  // ============================================================================
  
  /** Can access any admin area (platform staff only) */
  canAccessAdminArea: boolean;
  
  /** Can view any user's data for support (platform staff) */
  canViewAnyUser: boolean;
  
  /** Can use mimic mode (platform admins only) */
  canMimicUsers: boolean;
}

interface UsePermissionsReturn extends Permissions {
  loading: boolean;
}

/**
 * Hook to get capability-based permissions for the current user.
 * 
 * Use this for UI gating instead of checking role flags directly.
 * This ensures consistent permission logic across the application.
 */
export function usePermissions(): UsePermissionsReturn {
  const roles = useCurrentUserRoles();

  // Vendor permissions
  const canViewVendorDashboard = roles.isVendor || roles.isPlatformAdmin;
  const canEditVendorProfile = roles.isVendor || roles.isPlatformAdmin;
  const canUseVendorTools = roles.isVendor || roles.isPlatformAdmin;
  const canUnlockRepContacts = roles.isVendor || roles.isPlatformAdmin;
  
  // Vendor admin-only permissions (staff cannot do these)
  const canInviteVendorStaff = roles.isVendorAdmin || roles.isPlatformAdmin;
  const canManageVendorStaff = roles.isVendorAdmin || roles.isPlatformAdmin;
  const canManageBilling = roles.isVendorAdmin || roles.isPlatformAdmin;
  const canViewStaffMetrics = roles.isVendorAdmin || roles.isPlatformAdmin;

  // Field rep permissions
  const canViewRepDashboard = roles.isFieldRep || roles.isPlatformAdmin;
  const canEditRepProfile = roles.isFieldRep || roles.isPlatformAdmin;
  const canUseRepTools = roles.isFieldRep || roles.isPlatformAdmin;

  // Platform admin permissions
  const canAccessAdminArea = roles.isPlatformStaff;
  const canViewAnyUser = roles.isPlatformStaff;
  const canMimicUsers = roles.isPlatformAdmin;

  return {
    loading: roles.loading,
    
    // Vendor
    canViewVendorDashboard,
    canEditVendorProfile,
    canUseVendorTools,
    canUnlockRepContacts,
    canInviteVendorStaff,
    canManageVendorStaff,
    canManageBilling,
    canViewStaffMetrics,
    
    // Rep
    canViewRepDashboard,
    canEditRepProfile,
    canUseRepTools,
    
    // Admin
    canAccessAdminArea,
    canViewAnyUser,
    canMimicUsers,
  };
}
