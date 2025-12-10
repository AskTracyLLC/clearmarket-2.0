import { supabase } from "@/integrations/supabase/client";

export type ConversationOrigin = {
  type: "seeking_coverage";
  postId: string;
} | null;

/**
 * Helper to get or create a conversation between two users.
 * Conversations are stored with participants in sorted order to ensure uniqueness.
 */
export async function getOrCreateConversation(
  currentUserId: string,
  otherUserId: string,
  origin: ConversationOrigin = null
): Promise<{ id: string; error?: string }> {
  try {
    // Sort participant IDs to maintain consistency with unique constraint
    const [p1, p2] = [currentUserId, otherUserId].sort();

    // Check if conversation already exists for this specific post (or no post if origin is null)
    let query = supabase
      .from("conversations")
      .select("id, origin_type, origin_post_id, rep_interest_id")
      .eq("participant_one", p1)
      .eq("participant_two", p2);

    // If we have an origin post, look for conversation with that specific post
    if (origin?.type === "seeking_coverage") {
      query = query.eq("origin_post_id", origin.postId);
    } else {
      // If no origin, look for conversations without an origin_post_id
      query = query.is("origin_post_id", null);
    }

    const { data: existing, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error("Error fetching conversation:", fetchError);
      return { id: "", error: "Failed to fetch conversation" };
    }

    // If conversation exists, return it
    if (existing) {
      return { id: existing.id };
    }

    // Create new conversation, attaching origin if provided
    const payload: any = {
      participant_one: p1,
      participant_two: p2,
    };

    if (origin?.type === "seeking_coverage") {
      payload.origin_type = "seeking_coverage";
      payload.origin_post_id = origin.postId;

      // Fetch the Seeking Coverage post to snapshot its title
      const { data: post } = await supabase
        .from("seeking_coverage_posts")
        .select("title")
        .eq("id", origin.postId)
        .maybeSingle();

      if (post?.title) {
        payload.post_title_snapshot = post.title;
      }

      // Find the rep_interest row for this conversation
      // Determine which participant is the rep by getting their rep_profile.id
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, is_fieldrep")
        .in("id", [currentUserId, otherUserId]);

      const repUserId = profiles?.find(p => p.is_fieldrep)?.id;

      if (repUserId) {
        // Get the rep_profile.id for this user
        const { data: repProfile } = await supabase
          .from("rep_profile")
          .select("id")
          .eq("user_id", repUserId)
          .maybeSingle();

        if (repProfile) {
          const { data: interest } = await supabase
            .from("rep_interest")
            .select("id")
            .eq("post_id", origin.postId)
            .eq("rep_id", repProfile.id)
            .maybeSingle();

          if (interest) {
            payload.rep_interest_id = interest.id;
          }
        }
      }
    }

    const { data: newConversation, error: insertError } = await supabase
      .from("conversations")
      .insert(payload)
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
    // First check if user is staff/admin with staff_anonymous_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_admin, is_moderator, is_support, staff_anonymous_id")
      .eq("id", userId)
      .maybeSingle();

    // If staff member with staff_anonymous_id, use that
    if (profile?.staff_anonymous_id && (profile.is_admin || profile.is_moderator || profile.is_support)) {
      return profile.staff_anonymous_id;
    }

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
