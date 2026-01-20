import { supabase } from "@/integrations/supabase/client";

export type BackgroundCheckStatus = "pending" | "approved" | "rejected" | "expired";

export interface BackgroundCheck {
  id: string;
  field_rep_id: string;
  provider: string;
  check_id: string;
  expiration_date: string | null;
  screenshot_url: string;
  status: BackgroundCheckStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackgroundCheckWithRep extends BackgroundCheck {
  profiles?: {
    email: string;
    full_name: string | null;
    anonymous_id: string | null;
  } | null;
  reviewer?: {
    email: string;
    full_name: string | null;
  } | null;
}

/**
 * Fetch the current user's background check record
 */
export async function fetchMyBackgroundCheck(userId: string): Promise<BackgroundCheck | null> {
  const { data, error } = await supabase
    .from("background_checks")
    .select("*")
    .eq("field_rep_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching background check:", error);
    return null;
  }

  return data as BackgroundCheck | null;
}

/**
 * Submit or update a background check for review
 */
export async function submitBackgroundCheck(
  userId: string,
  provider: string,
  checkId: string,
  screenshotUrl: string,
  expirationDate: string | null
): Promise<{ success: boolean; error?: string; isExpired?: boolean }> {
  // Check if expiration date is in the past
  if (expirationDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expirationDate);
    exp.setHours(0, 0, 0, 0);
    
    if (exp < today) {
      return { success: false, error: "Expiration date is in the past", isExpired: true };
    }
  }

  // Check if record exists
  const existing = await fetchMyBackgroundCheck(userId);

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from("background_checks")
      .update({
        provider,
        check_id: checkId,
        expiration_date: expirationDate,
        screenshot_url: screenshotUrl,
        status: "pending",
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by_user_id: null,
        review_notes: null,
      })
      .eq("id", existing.id);

    if (error) {
      console.error("Error updating background check:", error);
      return { success: false, error: error.message };
    }
  } else {
    // Insert new record
    const { error } = await supabase
      .from("background_checks")
      .insert({
        field_rep_id: userId,
        provider,
        check_id: checkId,
        expiration_date: expirationDate,
        screenshot_url: screenshotUrl,
        status: "pending",
      });

    if (error) {
      console.error("Error inserting background check:", error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

/**
 * Fetch all background checks for admin review
 */
export async function fetchAllBackgroundChecks(
  statusFilter?: BackgroundCheckStatus
): Promise<BackgroundCheckWithRep[]> {
  let query = supabase
    .from("background_checks")
    .select(`
      *,
      profiles!background_checks_field_rep_id_fkey(full_name, anonymous_id),
      reviewer:profiles!background_checks_reviewed_by_user_id_fkey(full_name)
    `)
    .order("submitted_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching background checks:", error);
    return [];
  }

  return (data || []) as BackgroundCheckWithRep[];
}

/**
 * Approve a background check
 */
export async function approveBackgroundCheck(
  checkId: string,
  reviewerId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("background_checks")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: reviewerId,
    })
    .eq("id", checkId);

  if (error) {
    console.error("Error approving background check:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Reject a background check
 */
export async function rejectBackgroundCheck(
  checkId: string,
  reviewerId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("background_checks")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: reviewerId,
      review_notes: notes,
    })
    .eq("id", checkId);

  if (error) {
    console.error("Error rejecting background check:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Check if a background check is verified and active for vendor display
 */
export function isBackgroundCheckVerified(check: BackgroundCheck | null): boolean {
  if (!check) return false;
  if (check.status !== "approved") return false;
  
  if (check.expiration_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(check.expiration_date);
    exp.setHours(0, 0, 0, 0);
    if (exp < today) return false;
  }
  
  return true;
}

/**
 * Get status display info
 */
export function getBackgroundCheckStatusInfo(check: BackgroundCheck | null): {
  badge: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  message: string;
} {
  if (!check) {
    return {
      badge: "Not submitted",
      variant: "outline",
      message: "",
    };
  }

  // Check if approved but expired
  if (check.status === "approved" && check.expiration_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(check.expiration_date);
    exp.setHours(0, 0, 0, 0);
    if (exp < today) {
      return {
        badge: "Expired",
        variant: "warning",
        message: "Your background check on file has expired. Please upload an updated screenshot if you have renewed it.",
      };
    }
  }

  switch (check.status) {
    case "pending":
      return {
        badge: "Pending review",
        variant: "secondary",
        message: "Background check submitted – pending review by ClearMarket moderators. This won't show to vendors until it's approved.",
      };
    case "approved":
      return {
        badge: "Verified",
        variant: "success",
        message: "We've verified your background check. Vendors can filter for reps with verified checks.",
      };
    case "rejected":
      return {
        badge: "Not verified",
        variant: "destructive",
        message: "We couldn't verify your background check from the screenshot provided. Please upload a clearer image that shows your ID number and expiration date.",
      };
    case "expired":
      return {
        badge: "Expired",
        variant: "warning",
        message: "Your background check on file has expired. Please upload an updated screenshot if you have renewed it.",
      };
    default:
      return {
        badge: "Unknown",
        variant: "outline",
        message: "",
      };
  }
}
