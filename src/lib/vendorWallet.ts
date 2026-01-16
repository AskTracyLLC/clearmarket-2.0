/**
 * Vendor Wallet Helpers
 * 
 * Provides functions for accessing the shared vendor wallet,
 * which is owned by the vendor (not individual users).
 */

import { supabase } from "@/integrations/supabase/client";

export interface VendorWalletTransaction {
  id: string;
  vendor_id: string;
  actor_user_id: string;
  txn_type: string;
  delta: number;
  metadata: Record<string, any> | null;
  created_at: string;
}

/**
 * Resolve the vendor_id for the current user.
 * Returns vendor_profile.id if user is vendor owner OR active vendor staff.
 */
export async function resolveCurrentVendorId(userId: string): Promise<string | null> {
  // First, check if user is a vendor owner
  const { data: vendorProfile, error: vpError } = await supabase
    .from("vendor_profile")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (vpError) {
    console.error("Error checking vendor owner:", vpError);
    return null;
  }

  if (vendorProfile?.id) {
    return vendorProfile.id;
  }

  // Not an owner - check if active staff
  const { data: staffRecord, error: staffError } = await supabase
    .from("vendor_staff")
    .select("vendor_id")
    .eq("staff_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (staffError) {
    console.error("Error checking vendor staff:", staffError);
    return null;
  }

  return staffRecord?.vendor_id ?? null;
}

/**
 * Get the current balance of a vendor's wallet.
 * RLS ensures only vendor members can read this.
 */
export async function getVendorWalletBalance(vendorId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("vendor_wallet")
    .select("credits_balance")
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching vendor wallet balance:", error);
    return null;
  }

  return data?.credits_balance ?? 0;
}

/**
 * Get transaction history for a vendor's wallet.
 * RLS ensures only vendor members can read this.
 */
export async function getVendorWalletTransactions(
  vendorId: string,
  limit = 50
): Promise<VendorWalletTransaction[]> {
  const { data, error } = await supabase
    .from("vendor_wallet_transactions")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching vendor wallet transactions:", error);
    return [];
  }

  return (data ?? []) as VendorWalletTransaction[];
}

/**
 * Spend credits from the vendor wallet.
 * Calls the secure RPC function which checks:
 * 1. Caller is a vendor member
 * 2. Caller is owner/admin OR has can_spend_credits = true
 * 3. Sufficient balance exists
 * 
 * @returns success status and error message if applicable
 */
export async function spendVendorCredits(
  vendorId: string,
  amount: number,
  txnType: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("spend_vendor_credits", {
    p_vendor_id: vendorId,
    p_amount: amount,
    p_txn_type: txnType,
    p_metadata: metadata ?? null,
  });

  if (error) {
    console.error("Error spending vendor credits:", error);
    
    // Parse error message for user-friendly display
    const msg = error.message || "Unknown error";
    
    if (msg.includes("Not a member of this vendor")) {
      return { success: false, error: "Access denied. You are not a member of this vendor." };
    }
    if (msg.includes("Not authorized to spend vendor credits")) {
      return { success: false, error: "You don't have permission to spend credits. Ask a vendor admin to enable credit spending for your account." };
    }
    if (msg.includes("Insufficient credits")) {
      return { success: false, error: "Not enough credits. Purchase more on the Credits page." };
    }
    
    return { success: false, error: msg };
  }

  return { success: true };
}

/**
 * Check if the current user can spend credits for a vendor.
 * Returns true if user is owner/admin OR has can_spend_credits = true.
 */
export async function canUserSpendVendorCredits(
  userId: string,
  vendorId: string
): Promise<boolean> {
  // Check if user is vendor owner
  const { data: vendorProfile } = await supabase
    .from("vendor_profile")
    .select("id")
    .eq("id", vendorId)
    .eq("user_id", userId)
    .maybeSingle();

  if (vendorProfile) {
    return true; // Owner can always spend
  }

  // Check if user is staff with spending permission
  const { data: staffRecord } = await supabase
    .from("vendor_staff")
    .select("role, can_spend_credits")
    .eq("vendor_id", vendorId)
    .eq("staff_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!staffRecord) {
    return false;
  }

  // Admin role or explicit permission
  return staffRecord.role === "admin" || staffRecord.role === "owner" || staffRecord.can_spend_credits === true;
}
