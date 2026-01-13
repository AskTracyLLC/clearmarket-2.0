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
 * Helper to get the display name for a user (respects connection status for privacy).
 * For non-connected reps, shows FieldRep#X; for connected reps or vendors, shows real name.
 * 
 * @param userId - The user ID to get display name for
 * @param viewerId - The ID of the user viewing (optional, for connection check)
 * @param viewerIsVendor - Whether the viewer is a vendor (optional, for connection check)
 */
export async function getUserDisplayName(
  userId: string, 
  viewerId?: string, 
  viewerIsVendor?: boolean
): Promise<string> {
  try {
    // First check if user is staff/admin with staff_anonymous_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_admin, is_moderator, is_support, staff_anonymous_id, is_fieldrep, is_vendor_admin")
      .eq("id", userId)
      .maybeSingle();

    // If staff member with staff_anonymous_id, use that
    if (profile?.staff_anonymous_id && (profile.is_admin || profile.is_moderator || profile.is_support)) {
      return profile.staff_anonymous_id;
    }

    // Check if the target user is a rep
    const isTargetRep = profile?.is_fieldrep ?? false;
    const isTargetVendor = profile?.is_vendor_admin ?? false;

    // Get rep profile anonymous ID (needed for fallback)
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("anonymous_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Get vendor profile anonymous ID
    const { data: vendorProfile } = await supabase
      .from("vendor_profile")
      .select("anonymous_id, company_name")
      .eq("user_id", userId)
      .maybeSingle();

    // If viewer is a vendor looking at a rep, check connection status
    if (viewerId && viewerIsVendor && isTargetRep) {
      const { data: connection } = await supabase
        .from("vendor_connections")
        .select("status")
        .eq("vendor_id", viewerId)
        .eq("field_rep_id", userId)
        .eq("status", "connected")
        .maybeSingle();

      // If NOT connected, show rep anonymous ID only
      if (!connection) {
        if (repProfile?.anonymous_id) {
          return repProfile.anonymous_id;
        }
        // Last resort fallback
        return `FieldRep#${userId.slice(-6).toUpperCase()}`;
      }
      // If connected, fall through to show real name
    }

    // If viewer is a rep looking at a vendor, check connection status
    if (viewerId && !viewerIsVendor && isTargetVendor) {
      const { data: connection } = await supabase
        .from("vendor_connections")
        .select("status")
        .eq("vendor_id", userId)
        .eq("field_rep_id", viewerId)
        .eq("status", "connected")
        .maybeSingle();

      // If NOT connected, show vendor anonymous ID or company name
      if (!connection) {
        if (vendorProfile?.company_name) {
          return vendorProfile.company_name;
        }
        if (vendorProfile?.anonymous_id) {
          return vendorProfile.anonymous_id;
        }
        return `Vendor#${userId.slice(-6).toUpperCase()}`;
      }
      // If connected, fall through to show real name
    }

    // Connected or same-role viewing: show real name
    // Priority: full_name > company_name > anonymous_id
    if (profile?.full_name) {
      const names = profile.full_name.split(" ");
      if (names.length > 1) {
        return `${names[0]} ${names[names.length - 1].charAt(0)}.`;
      }
      return profile.full_name;
    }

    // Fallback to company name for vendors
    if (vendorProfile?.company_name) {
      return vendorProfile.company_name;
    }

    // Fallback to anonymous ID
    if (repProfile?.anonymous_id) {
      return repProfile.anonymous_id;
    }
    if (vendorProfile?.anonymous_id) {
      return vendorProfile.anonymous_id;
    }

    return "User";
  } catch (error) {
    console.error("Error getting user display name:", error);
    return "User";
  }
}

/**
 * Batch fetch display names for multiple users, respecting connection status.
 * 
 * @param userIds - Array of user IDs to get names for
 * @param viewerId - The viewer's user ID
 * @param viewerIsVendor - Whether the viewer is a vendor
 */
export async function batchGetUserDisplayNames(
  userIds: string[],
  viewerId: string,
  viewerIsVendor: boolean
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const uniqueIds = [...new Set(userIds)];
  const names: Record<string, string> = {};

  try {
    // Fetch all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, is_admin, is_moderator, is_support, staff_anonymous_id, is_fieldrep, is_vendor_admin")
      .in("id", uniqueIds);

    // Fetch all rep profiles
    const { data: repProfiles } = await supabase
      .from("rep_profile")
      .select("user_id, anonymous_id")
      .in("user_id", uniqueIds);

    // Fetch all vendor profiles
    const { data: vendorProfiles } = await supabase
      .from("vendor_profile")
      .select("user_id, anonymous_id, company_name")
      .in("user_id", uniqueIds);

    // Fetch connections between viewer and all these users
    let connections: { vendor_id: string; field_rep_id: string; status: string }[] = [];
    if (viewerIsVendor) {
      // Viewer is vendor, check connections to reps
      const { data } = await supabase
        .from("vendor_connections")
        .select("vendor_id, field_rep_id, status")
        .eq("vendor_id", viewerId)
        .in("field_rep_id", uniqueIds)
        .eq("status", "connected");
      connections = data || [];
    } else {
      // Viewer is rep, check connections to vendors
      const { data } = await supabase
        .from("vendor_connections")
        .select("vendor_id, field_rep_id, status")
        .eq("field_rep_id", viewerId)
        .in("vendor_id", uniqueIds)
        .eq("status", "connected");
      connections = data || [];
    }

    // Build connection set for quick lookup
    const connectedIds = new Set(
      connections.map(c => viewerIsVendor ? c.field_rep_id : c.vendor_id)
    );

    // Build maps
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const repMap = new Map((repProfiles || []).map(r => [r.user_id, r]));
    const vendorMap = new Map((vendorProfiles || []).map(v => [v.user_id, v]));

    for (const id of uniqueIds) {
      const profile = profileMap.get(id);
      const rep = repMap.get(id);
      const vendor = vendorMap.get(id);

      // Staff with staff_anonymous_id
      if (profile?.staff_anonymous_id && (profile.is_admin || profile.is_moderator || profile.is_support)) {
        names[id] = profile.staff_anonymous_id;
        continue;
      }

      const isRep = profile?.is_fieldrep ?? false;
      const isVendorUser = profile?.is_vendor_admin ?? false;
      const isConnected = connectedIds.has(id);

      // Vendor viewing a non-connected rep → show anonymous ID
      if (viewerIsVendor && isRep && !isConnected) {
        if (rep?.anonymous_id) {
          names[id] = rep.anonymous_id;
        } else {
          names[id] = `FieldRep#${id.slice(-6).toUpperCase()}`;
        }
        continue;
      }

      // Rep viewing a non-connected vendor → show company name or anonymous ID
      if (!viewerIsVendor && isVendorUser && !isConnected) {
        if (vendor?.company_name) {
          names[id] = vendor.company_name;
        } else if (vendor?.anonymous_id) {
          names[id] = vendor.anonymous_id;
        } else {
          names[id] = `Vendor#${id.slice(-6).toUpperCase()}`;
        }
        continue;
      }

      // Connected or same-role: show real name
      if (profile?.full_name) {
        const nameParts = profile.full_name.split(" ");
        if (nameParts.length > 1) {
          names[id] = `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`;
        } else {
          names[id] = profile.full_name;
        }
        continue;
      }

      // Fallbacks
      if (vendor?.company_name) {
        names[id] = vendor.company_name;
      } else if (rep?.anonymous_id) {
        names[id] = rep.anonymous_id;
      } else if (vendor?.anonymous_id) {
        names[id] = vendor.anonymous_id;
      } else {
        names[id] = "User";
      }
    }

    return names;
  } catch (error) {
    console.error("Error batch fetching user display names:", error);
    // Return empty map on error
    return {};
  }
}
