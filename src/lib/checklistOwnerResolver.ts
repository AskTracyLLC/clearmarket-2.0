import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Template ID for Vendor Beta Onboarding - shared between vendor owner and staff
 */
export const VENDOR_BETA_ONBOARDING_TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

/**
 * Resolves the user_id that should own the vendor onboarding checklist.
 * For vendor staff, this returns the vendor owner's user_id.
 * For everyone else, returns the same user_id.
 * 
 * This enables shared checklist progress between vendor owner and all staff.
 */
export async function resolveVendorChecklistOwnerUserId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string> {
  try {
    // Check if user is vendor staff
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_vendor_staff")
      .eq("id", authUserId)
      .single();

    if (!profile?.is_vendor_staff) {
      // Not staff, return self
      return authUserId;
    }

    // User is vendor staff - find their vendor
    const { data: staffRecord } = await supabase
      .from("vendor_staff")
      .select("vendor_id")
      .eq("staff_user_id", authUserId)
      .eq("status", "active")
      .maybeSingle();

    if (!staffRecord?.vendor_id) {
      // No active staff record found, fallback to self
      console.warn(`[checklistOwnerResolver] Staff user ${authUserId} has no active vendor_staff record`);
      return authUserId;
    }

    // Get the vendor owner's user_id from vendor_profile
    const { data: vendorProfile } = await supabase
      .from("vendor_profile")
      .select("user_id")
      .eq("id", staffRecord.vendor_id)
      .single();

    if (!vendorProfile?.user_id) {
      // Vendor profile missing user_id, fallback to self
      console.warn(`[checklistOwnerResolver] Vendor ${staffRecord.vendor_id} has no user_id`);
      return authUserId;
    }

    // Return the vendor owner's user_id
    return vendorProfile.user_id;
  } catch (error) {
    console.error("[checklistOwnerResolver] Error resolving owner:", error);
    return authUserId; // Fallback to self on any error
  }
}

/**
 * Check if a user is vendor staff
 */
export async function isVendorStaff(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_vendor_staff")
    .eq("id", userId)
    .single();

  return data?.is_vendor_staff === true;
}

/**
 * Check if a template is the shared vendor onboarding template
 */
export function isSharedVendorOnboardingTemplate(templateId: string): boolean {
  return templateId === VENDOR_BETA_ONBOARDING_TEMPLATE_ID;
}
