// Staff Permissions System
// Centralized permission management for admin/staff features

export type StaffRole = 'admin' | 'moderator' | 'support' | 'none';

export interface StaffPermissions {
  // High-level areas
  canViewAdminDashboard: boolean;

  // User management
  canViewUsersAdmin: boolean;
  canEditUsersAdmin: boolean;        // deactivate/reactivate users, send reset links
  canViewStaffAdmin: boolean;        // /admin/staff
  canEditStaffAdmin: boolean;        // create staff, change roles
  canViewInvitesAdmin: boolean;      // /admin/invites
  canEditInvitesAdmin: boolean;

  // Moderation & safety
  canViewModeration: boolean;        // /admin/moderation
  canEditModeration: boolean;        // resolve reports, hide reviews, etc.
  canModerateCommunity: boolean;     // lock posts, change post status

  // Support & help
  canViewSupportQueue: boolean;      // /admin/support
  canReplySupportTickets: boolean;
  canEditHelpCenter: boolean;        // create/edit support articles

  // Billing/credits (for now just view)
  canViewCreditsAdmin: boolean;
  canAdjustCreditsAdmin: boolean;    // keep false for non-admins for now
}

export const STAFF_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  admin: {
    canViewAdminDashboard: true,
    canViewUsersAdmin: true,
    canEditUsersAdmin: true,
    canViewStaffAdmin: true,
    canEditStaffAdmin: true,
    canViewInvitesAdmin: true,
    canEditInvitesAdmin: true,
    canViewModeration: true,
    canEditModeration: true,
    canModerateCommunity: true,
    canViewSupportQueue: true,
    canReplySupportTickets: true,
    canEditHelpCenter: true,
    canViewCreditsAdmin: true,
    canAdjustCreditsAdmin: true,
  },
  moderator: {
    canViewAdminDashboard: true,
    canViewUsersAdmin: true,
    canEditUsersAdmin: false,
    canViewStaffAdmin: false,
    canEditStaffAdmin: false,
    canViewInvitesAdmin: false,
    canEditInvitesAdmin: false,
    canViewModeration: true,
    canEditModeration: true,
    canModerateCommunity: true,
    canViewSupportQueue: false,
    canReplySupportTickets: false,
    canEditHelpCenter: false,
    canViewCreditsAdmin: false,
    canAdjustCreditsAdmin: false,
  },
  support: {
    canViewAdminDashboard: true,
    canViewUsersAdmin: true,
    canEditUsersAdmin: false,
    canViewStaffAdmin: false,
    canEditStaffAdmin: false,
    canViewInvitesAdmin: false,
    canEditInvitesAdmin: false,
    canViewModeration: false,
    canEditModeration: false,
    canModerateCommunity: false,
    canViewSupportQueue: true,
    canReplySupportTickets: true,
    canEditHelpCenter: true,
    canViewCreditsAdmin: false,
    canAdjustCreditsAdmin: false,
  },
  none: {
    canViewAdminDashboard: false,
    canViewUsersAdmin: false,
    canEditUsersAdmin: false,
    canViewStaffAdmin: false,
    canEditStaffAdmin: false,
    canViewInvitesAdmin: false,
    canEditInvitesAdmin: false,
    canViewModeration: false,
    canEditModeration: false,
    canModerateCommunity: false,
    canViewSupportQueue: false,
    canReplySupportTickets: false,
    canEditHelpCenter: false,
    canViewCreditsAdmin: false,
    canAdjustCreditsAdmin: false,
  },
};

export interface ProfileForRoleCheck {
  is_admin?: boolean;
  is_moderator?: boolean;
  is_support?: boolean;
  is_super_admin?: boolean;
  email?: string | null;
}

export function getRoleFromProfile(profile: ProfileForRoleCheck | null): StaffRole {
  if (!profile) return "none";
  
  // Super admin safeguard – Tracy always has full rights
  if (profile?.email && profile.email.toLowerCase() === "tracy@asktracyllc.com") {
    return "admin";
  }
  if (profile?.is_admin) return "admin";
  if (profile?.is_moderator) return "moderator";
  if (profile?.is_support) return "support";
  return "none";
}

export function getPermissionsForProfile(profile: ProfileForRoleCheck | null): StaffPermissions {
  const role = getRoleFromProfile(profile);
  return STAFF_PERMISSIONS[role];
}

// Check if user has super admin privileges (for staff management)
export function isSuperAdminFromProfile(profile: ProfileForRoleCheck | null): boolean {
  if (!profile) return false;
  
  // Tracy always has super admin rights
  if (profile?.email && profile.email.toLowerCase() === "tracy@asktracyllc.com") {
    return true;
  }
  
  return profile?.is_super_admin === true;
}
