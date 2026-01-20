import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch a user's email via the admin_get_profile_email RPC.
 * This function is audited - every call creates a log entry with the reason.
 *
 * @param profileId - The target user's profile ID
 * @param reason - A meaningful reason for accessing the email (min 10 characters)
 * @returns The email address or null if not found
 * @throws Error if the caller is not an admin or the reason is too short
 */
export async function getProfileEmailAsAdmin(
  profileId: string,
  reason: string
): Promise<string | null> {
  if (!reason || reason.trim().length < 10) {
    throw new Error("Reason must be at least 10 characters");
  }

  const { data, error } = await supabase.rpc("admin_get_profile_email", {
    p_target_profile_id: profileId,
    p_reason: reason.trim(),
  });

  if (error) {
    console.error("[adminEmailAccess] Failed to fetch email:", error.message);
    throw error;
  }

  return data as string | null;
}
