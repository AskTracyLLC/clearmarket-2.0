import { supabase } from "@/integrations/supabase/client";

/**
 * Get the current credit balance for a vendor user
 */
export async function getVendorCredits(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("user_wallet")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching vendor credits:", error);
    return null;
  }

  return data?.credits ?? null;
}

/**
 * Deduct credits from a vendor's balance and log the transaction
 * Returns true if successful, false if insufficient credits or error
 */
export async function deductVendorCredits(
  userId: string,
  amount: number,
  action: string,
  metadata?: any
): Promise<{ success: boolean; error?: string }> {
  // Check current balance
  const currentBalance = await getVendorCredits(userId);

  if (currentBalance === null) {
    return { success: false, error: "Unable to fetch credit balance" };
  }

  if (currentBalance < amount) {
    return { success: false, error: "Insufficient credits" };
  }

  // Deduct credits from wallet
  const { error: walletError } = await supabase
    .from("user_wallet")
    .update({ credits: currentBalance - amount })
    .eq("user_id", userId);

  if (walletError) {
    console.error("Error updating wallet:", walletError);
    return { success: false, error: "Failed to update credit balance" };
  }

  // Log the transaction
  const { error: txError } = await supabase
    .from("vendor_credit_transactions")
    .insert({
      user_id: userId,
      amount: -amount,
      action,
      metadata: metadata || null,
    });

  if (txError) {
    console.error("Error logging transaction:", txError);
    // Note: We already deducted credits, so we don't return false here
    // In production, you'd want a transaction or rollback mechanism
  }

  return { success: true };
}

/**
 * Add credits to a vendor's balance and log the transaction
 * TODO: Wire this up to Stripe or other payment flow
 */
export async function addVendorCredits(
  userId: string,
  amount: number,
  action: string,
  metadata?: any
): Promise<{ success: boolean; error?: string }> {
  // Get current balance
  const currentBalance = await getVendorCredits(userId);

  if (currentBalance === null) {
    return { success: false, error: "Unable to fetch credit balance" };
  }

  // Add credits to wallet
  const { error: walletError } = await supabase
    .from("user_wallet")
    .update({ credits: currentBalance + amount })
    .eq("user_id", userId);

  if (walletError) {
    console.error("Error updating wallet:", walletError);
    return { success: false, error: "Failed to update credit balance" };
  }

  // Log the transaction
  const { error: txError } = await supabase
    .from("vendor_credit_transactions")
    .insert({
      user_id: userId,
      amount,
      action,
      metadata: metadata || null,
    });

  if (txError) {
    console.error("Error logging transaction:", txError);
  }

  return { success: true };
}

/**
 * Fetch transaction history for a vendor
 */
export async function getVendorTransactions(userId: string) {
  const { data, error } = await supabase
    .from("vendor_credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }

  return data || [];
}

// ===== DEPRECATED: Contact unlock feature has been removed =====
// Vendors must connect with reps to access contact details.
// These functions are kept as stubs to prevent runtime errors in any leftover code.

/**
 * @deprecated Contact unlock feature has been removed. Vendors must connect with reps to access contact details.
 */
export async function unlockRepContact(
  _vendorUserId: string,
  _repUserId: string
): Promise<{ success: boolean; error?: string; alreadyUnlocked?: boolean }> {
  console.warn("unlockRepContact is deprecated. Vendors must connect with reps to access contact details.");
  return { success: false, error: "Contact unlock feature has been removed. Please connect with this rep to access their contact details." };
}

/**
 * @deprecated Contact unlock feature has been removed.
 */
export async function checkContactUnlocked(
  _vendorUserId: string,
  _repUserId: string
): Promise<boolean> {
  console.warn("checkContactUnlocked is deprecated. Contact access is now based on connection status only.");
  return false;
}

/**
 * @deprecated Contact unlock feature has been removed.
 */
export async function checkContactUnlockedBatch(
  _vendorUserId: string,
  _repUserIds: string[]
): Promise<Record<string, boolean>> {
  console.warn("checkContactUnlockedBatch is deprecated. Contact access is now based on connection status only.");
  return {};
}
