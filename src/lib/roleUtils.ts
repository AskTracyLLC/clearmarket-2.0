/**
 * Centralized Role Utilities
 * 
 * This module provides canonical role detection and effective role resolution.
 * Use this instead of scattered is_vendor_admin || is_vendor_staff checks.
 */

// ============================================================================
// TYPES
// ============================================================================

/** Profile flags relevant to role detection */
export interface RoleFlags {
  is_fieldrep?: boolean | null;
  is_vendor_admin?: boolean | null;
  is_vendor_staff?: boolean | null;
  is_admin?: boolean | null;
  is_moderator?: boolean | null;
  is_support?: boolean | null;
  is_super_admin?: boolean | null;
  email?: string | null;
}

/** The effective UI role for routing/navigation */
export type EffectiveRole = "admin" | "vendor" | "rep" | "viewer";

/** Computed role state from profile flags */
export interface RoleState {
  // Platform staff roles
  isPlatformAdmin: boolean;
  isPlatformModerator: boolean;
  isPlatformSupport: boolean;
  isPlatformStaff: boolean; // admin OR moderator OR support
  isSuperAdmin: boolean;

  // Vendor roles
  isVendorAdmin: boolean;
  isVendorStaff: boolean;
  isVendor: boolean; // vendor_admin OR vendor_staff (has vendor access)

  // Field rep
  isFieldRep: boolean;

  // Dual role (can switch between rep and vendor)
  isDualRole: boolean;

  // The effective role for routing/UI
  effectiveRole: EffectiveRole;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Super admin email that always has full admin rights */
const SUPER_ADMIN_EMAIL = "tracy@asktracyllc.com";

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Compute the complete role state from profile flags.
 * This is the canonical source of truth for role detection.
 */
export function computeRoleState(
  flags: RoleFlags | null,
  activeRole?: "rep" | "vendor" | null
): RoleState {
  if (!flags) {
    return {
      isPlatformAdmin: false,
      isPlatformModerator: false,
      isPlatformSupport: false,
      isPlatformStaff: false,
      isSuperAdmin: false,
      isVendorAdmin: false,
      isVendorStaff: false,
      isVendor: false,
      isFieldRep: false,
      isDualRole: false,
      effectiveRole: "viewer",
    };
  }

  // Super admin check (Tracy always has full admin rights)
  const isSuperAdminEmail = 
    flags.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  
  // Platform staff roles
  const isPlatformAdmin = Boolean(flags.is_admin) || isSuperAdminEmail;
  const isPlatformModerator = Boolean(flags.is_moderator);
  const isPlatformSupport = Boolean(flags.is_support);
  const isPlatformStaff = isPlatformAdmin || isPlatformModerator || isPlatformSupport;
  const isSuperAdmin = Boolean(flags.is_super_admin) || isSuperAdminEmail;

  // Vendor roles
  const isVendorAdmin = Boolean(flags.is_vendor_admin);
  const isVendorStaff = Boolean(flags.is_vendor_staff);
  const isVendor = isVendorAdmin || isVendorStaff;

  // Field rep
  const isFieldRep = Boolean(flags.is_fieldrep);

  // Dual role: can switch between rep and vendor (only vendor admins can be dual-role)
  const isDualRole = isFieldRep && isVendorAdmin;

  // Determine effective role for routing/UI
  const effectiveRole = resolveEffectiveRole({
    isPlatformAdmin,
    isVendor,
    isFieldRep,
    isDualRole,
    activeRole,
  });

  return {
    isPlatformAdmin,
    isPlatformModerator,
    isPlatformSupport,
    isPlatformStaff,
    isSuperAdmin,
    isVendorAdmin,
    isVendorStaff,
    isVendor,
    isFieldRep,
    isDualRole,
    effectiveRole,
  };
}

/**
 * Resolve the effective role for routing and UI display.
 * Priority: admin > dual-role selection > vendor > rep > viewer
 */
function resolveEffectiveRole(params: {
  isPlatformAdmin: boolean;
  isVendor: boolean;
  isFieldRep: boolean;
  isDualRole: boolean;
  activeRole?: "rep" | "vendor" | null;
}): EffectiveRole {
  const { isPlatformAdmin, isVendor, isFieldRep, isDualRole, activeRole } = params;

  // Platform admins always have admin as effective role (for admin nav)
  // But they may also have vendor/rep roles - admin takes precedence for routing
  if (isPlatformAdmin) {
    return "admin";
  }

  // Dual-role users: respect their selected active_role
  if (isDualRole) {
    return activeRole === "vendor" ? "vendor" : "rep";
  }

  // Single role users
  if (isFieldRep) return "rep";
  if (isVendor) return "vendor";

  return "viewer";
}

/**
 * Check if user has any valid application role.
 * Used for gating to prevent terms loop / onboarding issues.
 */
export function hasAnyRole(flags: RoleFlags | null): boolean {
  if (!flags) return false;
  return Boolean(
    flags.is_fieldrep ||
    flags.is_vendor_admin ||
    flags.is_vendor_staff ||
    flags.is_admin ||
    flags.is_moderator ||
    flags.is_support
  );
}

/**
 * Get role label for display purposes.
 */
export function getRoleLabel(state: RoleState): string {
  if (state.isPlatformAdmin) return "Admin";
  if (state.isPlatformModerator) return "Moderator";
  if (state.isPlatformSupport) return "Support";
  if (state.isVendorAdmin) return "Vendor";
  if (state.isVendorStaff) return "Vendor Staff";
  if (state.isFieldRep) return "Field Rep";
  return "Viewer";
}
