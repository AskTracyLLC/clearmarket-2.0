/**
 * Utility functions for Background Check validation
 */

export interface BackgroundCheckFields {
  background_check_is_active?: boolean | null;
  background_check_expires_on?: string | null;
}

/**
 * Check if a rep's background check is currently active for matching purposes.
 * A background check is active if:
 * 1. background_check_is_active is true
 * 2. Either no expiration date is set (treat as active), or the expiration date is today or in the future
 */
export function isBackgroundCheckActive(rep: BackgroundCheckFields): boolean {
  if (!rep.background_check_is_active) return false;
  
  if (!rep.background_check_expires_on) return true; // No date = treat as active
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Ignore time of day
  
  const exp = new Date(rep.background_check_expires_on);
  exp.setHours(0, 0, 0, 0); // Ignore time of day
  
  // Active if exp >= today (ignore time-of-day)
  return exp >= today;
}

/**
 * Mask all but the last 4 characters of an ID for privacy
 */
export function maskBackgroundCheckId(id: string | null | undefined): string {
  if (!id || id.length <= 4) return id || "";
  
  const last4 = id.slice(-4);
  const masked = "*".repeat(id.length - 4);
  return `${masked}${last4}`;
}
