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

/**
 * Unlock a field rep's contact info for a vendor (costs 1 credit)
 * Returns true if successful, false if insufficient credits or error
 */
export async function unlockRepContact(
  vendorUserId: string,
  repUserId: string
): Promise<{ success: boolean; error?: string; alreadyUnlocked?: boolean }> {
  try {
    const { data, error } = await supabase.rpc("unlock_rep_contact", {
      p_vendor_user_id: vendorUserId,
      p_rep_user_id: repUserId,
    });

    if (error) {
      if (error.message?.includes("INSUFFICIENT_CREDITS")) {
        return { success: false, error: "Insufficient credits" };
      }
      if (error.message?.includes("WALLET_NOT_FOUND")) {
        return { success: false, error: "Wallet not found" };
      }
      console.error("Error unlocking rep contact:", error);
      return { success: false, error: "Failed to unlock contact" };
    }

    const result = data as { success: boolean; already_unlocked: boolean } | null;

    return {
      success: true,
      alreadyUnlocked: result?.already_unlocked ?? false,
    };
  } catch (error) {
    console.error("Unexpected error unlocking rep contact:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Check if a vendor has unlocked a rep's contact info
 */
export async function checkContactUnlocked(
  vendorUserId: string,
  repUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("rep_contact_unlocks")
    .select("id")
    .eq("vendor_user_id", vendorUserId)
    .eq("rep_user_id", repUserId)
    .maybeSingle();

  if (error) {
    console.error("Error checking unlock status:", error);
    return false;
  }

  return !!data;
}

/**
 * Batch check if contact is unlocked for multiple reps
 * Returns a map of repUserId -> isUnlocked
 */
export async function checkContactUnlockedBatch(
  vendorUserId: string,
  repUserIds: string[]
): Promise<Record<string, boolean>> {
  if (repUserIds.length === 0) return {};

  const { data, error } = await supabase
    .from("rep_contact_unlocks")
    .select("rep_user_id")
    .eq("vendor_user_id", vendorUserId)
    .in("rep_user_id", repUserIds);

  if (error) {
    console.error("Error batch checking unlock status:", error);
    return {};
  }

  const unlockedMap: Record<string, boolean> = {};
  repUserIds.forEach((id) => {
    unlockedMap[id] = false;
  });

  (data || []).forEach((row) => {
    unlockedMap[row.rep_user_id] = true;
  });

  return unlockedMap;
}
