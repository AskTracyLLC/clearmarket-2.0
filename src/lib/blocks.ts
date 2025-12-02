import { supabase } from "@/integrations/supabase/client";

/**
 * Block a user
 */
export async function blockUser(blockedUserId: string, reason?: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "You must be logged in to block users" };
  }

  if (user.id === blockedUserId) {
    return { error: "You cannot block yourself" };
  }

  const { error } = await supabase
    .from("user_blocks")
    .insert({
      blocker_user_id: user.id,
      blocked_user_id: blockedUserId,
      reason: reason || null,
    });

  if (error) {
    // Check for duplicate
    if (error.code === "23505") {
      return { error: "User is already blocked" };
    }
    console.error("Error blocking user:", error);
    return { error: "Failed to block user" };
  }

  return {};
}

/**
 * Unblock a user
 */
export async function unblockUser(blockedUserId: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "You must be logged in to unblock users" };
  }

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_user_id", user.id)
    .eq("blocked_user_id", blockedUserId);

  if (error) {
    console.error("Error unblocking user:", error);
    return { error: "Failed to unblock user" };
  }

  return {};
}

/**
 * Check if current user has blocked a specific user
 */
export async function isUserBlocked(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;

  const { data, error } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_user_id", user.id)
    .eq("blocked_user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error checking block status:", error);
    return false;
  }

  return !!data;
}

/**
 * Check if either user has blocked the other (bidirectional check)
 */
export async function areUsersBlocked(userId1: string, userId2: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("id")
    .or(`and(blocker_user_id.eq.${userId1},blocked_user_id.eq.${userId2}),and(blocker_user_id.eq.${userId2},blocked_user_id.eq.${userId1})`)
    .maybeSingle();

  if (error) {
    console.error("Error checking bidirectional block:", error);
    return false;
  }

  return !!data;
}

/**
 * Check bidirectional block status between current user and another user
 * Returns { hasBlocked, isBlocked, anyBlock }
 */
export async function checkBidirectionalBlockStatus(targetUserId: string): Promise<{
  hasBlocked: boolean;
  isBlocked: boolean;
  anyBlock: boolean;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user || user.id === targetUserId) {
    return { hasBlocked: false, isBlocked: false, anyBlock: false };
  }

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_user_id, blocked_user_id")
    .or(
      `and(blocker_user_id.eq.${user.id},blocked_user_id.eq.${targetUserId}),and(blocker_user_id.eq.${targetUserId},blocked_user_id.eq.${user.id})`
    );

  if (error) {
    console.error("Error checking bidirectional block status:", error);
    return { hasBlocked: false, isBlocked: false, anyBlock: false };
  }

  let hasBlocked = false;
  let isBlocked = false;

  for (const row of data || []) {
    if (row.blocker_user_id === user.id && row.blocked_user_id === targetUserId) {
      hasBlocked = true;
    }
    if (row.blocker_user_id === targetUserId && row.blocked_user_id === user.id) {
      isBlocked = true;
    }
  }

  return { hasBlocked, isBlocked, anyBlock: hasBlocked || isBlocked };
}

/**
 * Fetch all user IDs that the current user has blocked
 */
export async function fetchBlockedUserIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_user_id")
    .eq("blocker_user_id", user.id);

  if (error) {
    console.error("Error fetching blocked users:", error);
    return [];
  }

  return (data || []).map(row => row.blocked_user_id);
}
