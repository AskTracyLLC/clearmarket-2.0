import { supabase } from "@/integrations/supabase/client";

/**
 * Helper to get or create a conversation between two users.
 * Conversations are stored with participants in sorted order to ensure uniqueness.
 */
export async function getOrCreateConversation(
  currentUserId: string,
  otherUserId: string
): Promise<{ id: string; error?: string }> {
  try {
    // Sort participant IDs to maintain consistency with unique constraint
    const [p1, p2] = [currentUserId, otherUserId].sort();

    // Check if conversation already exists
    const { data: existing, error: fetchError } = await supabase
      .from("conversations")
      .select("id")
      .eq("participant_one", p1)
      .eq("participant_two", p2)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching conversation:", fetchError);
      return { id: "", error: "Failed to fetch conversation" };
    }

    // Return existing conversation if found
    if (existing) {
      return { id: existing.id };
    }

    // Create new conversation
    const { data: newConversation, error: insertError } = await supabase
      .from("conversations")
      .insert({
        participant_one: p1,
        participant_two: p2,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error creating conversation:", insertError);
      return { id: "", error: "Failed to create conversation" };
    }

    return { id: newConversation.id };
  } catch (error) {
    console.error("Unexpected error in getOrCreateConversation:", error);
    return { id: "", error: "An unexpected error occurred" };
  }
}

/**
 * Helper to get the display name for a user (anonymous ID or fallback to name).
 */
export async function getUserDisplayName(userId: string): Promise<string> {
  try {
    // Try to get rep profile anonymous ID
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("anonymous_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (repProfile?.anonymous_id) {
      return repProfile.anonymous_id;
    }

    // Try to get vendor profile anonymous ID
    const { data: vendorProfile } = await supabase
      .from("vendor_profile")
      .select("anonymous_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (vendorProfile?.anonymous_id) {
      return vendorProfile.anonymous_id;
    }

    // Fallback to profile full name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.full_name) {
      const names = profile.full_name.split(" ");
      if (names.length > 1) {
        return `${names[0]} ${names[names.length - 1].charAt(0)}.`;
      }
      return profile.full_name;
    }

    return "User";
  } catch (error) {
    console.error("Error getting user display name:", error);
    return "User";
  }
}
