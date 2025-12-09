import { supabase } from "@/integrations/supabase/client";

export type CommunityChannel = "community" | "network" | "announcements";

export interface CommunityPost {
  id: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  author_anonymous_id: string | null;
  author_role: string | null;
  author_community_score: number | null;
  channel: CommunityChannel;
  category: string;
  title: string;
  body: string;
  status: string;
  helpful_count: number;
  not_helpful_count: number;
  comments_count: number;
}

export interface CommunityComment {
  id: string;
  created_at: string;
  updated_at: string;
  post_id: string;
  author_id: string;
  body: string;
  status: string;
  helpful_count: number;
  not_helpful_count: number;
  author_anonymous_id?: string;
  author_role?: string;
  author_community_score?: number | null;
}

export interface CommunityVote {
  id: string;
  created_at: string;
  user_id: string;
  target_type: string;
  target_id: string;
  vote_type: string;
}

// Category configurations per channel
export const COMMUNITY_CATEGORIES = [
  { value: "question", label: "Question", color: "bg-blue-500/20 text-blue-400" },
  { value: "general_discussion", label: "General Discussion", color: "bg-purple-500/20 text-purple-400" },
  { value: "safety", label: "Safety", color: "bg-orange-500/20 text-orange-400" },
];

export const NETWORK_CATEGORIES = [
  { value: "vendor_alert", label: "Vendor Alert", color: "bg-amber-500/20 text-amber-400" },
  { value: "rep_alert", label: "Rep Alert", color: "bg-cyan-500/20 text-cyan-400" },
];

export const ANNOUNCEMENT_CATEGORIES = [
  { value: "system_news", label: "System News", color: "bg-green-500/20 text-green-400" },
  { value: "release_updates", label: "Release Updates", color: "bg-indigo-500/20 text-indigo-400" },
  { value: "faq", label: "FAQ", color: "bg-teal-500/20 text-teal-400" },
];

// Legacy export for backward compatibility
export const POST_CATEGORIES = COMMUNITY_CATEGORIES;

export const POST_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500/20 text-green-400" },
  under_review: { label: "Under Review", color: "bg-yellow-500/20 text-yellow-400" },
  locked: { label: "Locked", color: "bg-red-500/20 text-red-400" },
  archived: { label: "Archived", color: "bg-muted text-muted-foreground" },
};

export function getCategoriesForChannel(channel: CommunityChannel) {
  switch (channel) {
    case "community":
      return COMMUNITY_CATEGORIES;
    case "network":
      return NETWORK_CATEGORIES;
    case "announcements":
      return ANNOUNCEMENT_CATEGORIES;
    default:
      return COMMUNITY_CATEGORIES;
  }
}

export function getCategoryConfig(category: string, channel?: CommunityChannel) {
  const allCategories = [
    ...COMMUNITY_CATEGORIES,
    ...NETWORK_CATEGORIES,
    ...ANNOUNCEMENT_CATEGORIES,
  ];
  return allCategories.find(c => c.value === category) || { value: category, label: category, color: "bg-muted text-muted-foreground" };
}

export function getStatusConfig(status: string) {
  return POST_STATUS_CONFIG[status] || POST_STATUS_CONFIG.active;
}

export async function getAuthorInfo(userId: string): Promise<{ anonymousId: string; role: string }> {
  // Check profiles for role flags including staff roles
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_fieldrep, is_vendor_admin, is_admin, is_moderator, is_support, staff_anonymous_id")
    .eq("id", userId)
    .maybeSingle();

  // Check if user is staff (admin, moderator, or support)
  if (profile?.is_admin || profile?.is_moderator || profile?.is_support) {
    const staffRole = profile.is_admin ? "admin" : profile.is_moderator ? "moderator" : "support";
    const anonymousId = profile.staff_anonymous_id || (profile.is_admin ? "Admin" : profile.is_moderator ? "Moderator" : "Support");
    return { anonymousId, role: staffRole };
  }

  // Check rep profile
  const { data: repProfile } = await supabase
    .from("rep_profile")
    .select("anonymous_id")
    .eq("user_id", userId)
    .maybeSingle();

  // Check vendor profile
  const { data: vendorProfile } = await supabase
    .from("vendor_profile")
    .select("anonymous_id")
    .eq("user_id", userId)
    .maybeSingle();

  let role = "unknown";
  let anonymousId = "User";

  if (profile?.is_fieldrep && profile?.is_vendor_admin) {
    role = "both";
    anonymousId = repProfile?.anonymous_id || vendorProfile?.anonymous_id || "User";
  } else if (profile?.is_fieldrep) {
    role = "field_rep";
    anonymousId = repProfile?.anonymous_id || "FieldRep";
  } else if (profile?.is_vendor_admin) {
    role = "vendor";
    anonymousId = vendorProfile?.anonymous_id || "Vendor";
  }

  return { anonymousId, role };
}

export async function createCommunityPost(
  authorId: string,
  category: string,
  title: string,
  body: string,
  channel: CommunityChannel = "community"
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const { anonymousId, role } = await getAuthorInfo(authorId);

    const { data, error } = await supabase
      .from("community_posts")
      .insert({
        author_id: authorId,
        author_anonymous_id: anonymousId,
        author_role: role,
        channel,
        category,
        title,
        body,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating post:", error);
      return { success: false, error: error.message };
    }

    return { success: true, postId: data.id };
  } catch (error) {
    console.error("Error creating post:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateCommunityPost(
  postId: string,
  updates: { category?: string; title?: string; body?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("community_posts")
      .update(updates)
      .eq("id", postId);

    if (error) {
      console.error("Error updating post:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating post:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function fetchCommunityPosts(options?: {
  channel?: CommunityChannel;
  category?: string;
  authorId?: string;
  sortBy?: "newest" | "helpful" | "comments" | "author_score";
  limit?: number;
  offset?: number;
}): Promise<CommunityPost[]> {
  try {
    let query = supabase.from("community_posts").select("*");

    // Filter by channel
    if (options?.channel) {
      query = query.eq("channel", options.channel);
    }

    if (options?.category && options.category !== "all") {
      query = query.eq("category", options.category);
    }

    if (options?.authorId) {
      query = query.eq("author_id", options.authorId);
    }

    // Sort - author_score sorting handled client-side after fetching community scores
    if (options?.sortBy === "helpful") {
      query = query.order("helpful_count", { ascending: false });
    } else if (options?.sortBy === "comments") {
      query = query.order("comments_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching posts:", error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Fetch community scores for all authors
    const authorIds = [...new Set(data.map(p => p.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, community_score")
      .in("id", authorIds);

    const scoreMap: Record<string, number | null> = {};
    profiles?.forEach(p => {
      scoreMap[p.id] = p.community_score;
    });

    let posts = data.map(p => ({
      ...p,
      channel: (p.channel || "community") as CommunityChannel,
      author_community_score: scoreMap[p.author_id] ?? null,
    }));

    // Client-side sort for author_score
    if (options?.sortBy === "author_score") {
      posts = posts.sort((a, b) => {
        const scoreA = a.author_community_score ?? -Infinity;
        const scoreB = b.author_community_score ?? -Infinity;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return posts;
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
}

export async function fetchCommunityPost(postId: string): Promise<CommunityPost | null> {
  try {
    const { data, error } = await supabase
      .from("community_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (error) {
      console.error("Error fetching post:", error);
      return null;
    }

    // Fetch author's community score
    const { data: profile } = await supabase
      .from("profiles")
      .select("community_score")
      .eq("id", data.author_id)
      .maybeSingle();

    return {
      ...data,
      channel: (data.channel || "community") as CommunityChannel,
      author_community_score: profile?.community_score ?? null,
    };
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
}

export async function createCommunityComment(
  postId: string,
  authorId: string,
  body: string
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("community_comments")
      .insert({
        post_id: postId,
        author_id: authorId,
        body,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating comment:", error);
      return { success: false, error: error.message };
    }

    // Update comments_count - fetch current count first
    const { data: post, error: fetchError } = await supabase
      .from("community_posts")
      .select("comments_count")
      .eq("id", postId)
      .single();

    if (fetchError) {
      console.error("Error fetching post for comment count update:", fetchError);
    } else if (post) {
      const { error: updateError } = await supabase
        .from("community_posts")
        .update({ comments_count: (post.comments_count || 0) + 1 })
        .eq("id", postId);

      if (updateError) {
        console.error("Error updating comments_count:", updateError);
      }
    }

    return { success: true, commentId: data.id };
  } catch (error) {
    console.error("Error creating comment:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function fetchCommentsForPost(postId: string): Promise<CommunityComment[]> {
  try {
    const { data: comments, error } = await supabase
      .from("community_comments")
      .select("*")
      .eq("post_id", postId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return [];
    }

    if (!comments || comments.length === 0) return [];

    // Fetch author info in a single batch query instead of individual calls
    const authorIds = [...new Set(comments.map(c => c.author_id))];
    
    // Batch fetch all profile data needed
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, community_score, is_fieldrep, is_vendor_admin")
      .in("id", authorIds);
    
    const { data: repProfiles } = await supabase
      .from("rep_profile")
      .select("user_id, anonymous_id")
      .in("user_id", authorIds);
    
    const { data: vendorProfiles } = await supabase
      .from("vendor_profile")
      .select("user_id, anonymous_id")
      .in("user_id", authorIds);

    // Build lookup maps
    const profileMap: Record<string, { communityScore: number | null; isFieldrep: boolean; isVendorAdmin: boolean }> = {};
    profiles?.forEach(p => {
      profileMap[p.id] = {
        communityScore: p.community_score,
        isFieldrep: p.is_fieldrep || false,
        isVendorAdmin: p.is_vendor_admin || false,
      };
    });

    const repAnonMap: Record<string, string | null> = {};
    repProfiles?.forEach(rp => {
      repAnonMap[rp.user_id] = rp.anonymous_id;
    });

    const vendorAnonMap: Record<string, string | null> = {};
    vendorProfiles?.forEach(vp => {
      vendorAnonMap[vp.user_id] = vp.anonymous_id;
    });

    return comments.map(c => {
      const profile = profileMap[c.author_id];
      const repAnon = repAnonMap[c.author_id];
      const vendorAnon = vendorAnonMap[c.author_id];

      let role = "unknown";
      let anonymousId = "User";

      if (profile?.isFieldrep && profile?.isVendorAdmin) {
        role = "both";
        anonymousId = repAnon || vendorAnon || "User";
      } else if (profile?.isFieldrep) {
        role = "field_rep";
        anonymousId = repAnon || "FieldRep";
      } else if (profile?.isVendorAdmin) {
        role = "vendor";
        anonymousId = vendorAnon || "Vendor";
      }

      return {
        ...c,
        author_anonymous_id: anonymousId,
        author_role: role,
        author_community_score: profile?.communityScore ?? null,
      };
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return [];
  }
}

export async function fetchUserVotes(
  userId: string,
  targetType: "post" | "comment",
  targetIds: string[]
): Promise<Record<string, string>> {
  if (targetIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from("community_votes")
      .select("target_id, vote_type")
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .in("target_id", targetIds);

    if (error) {
      console.error("Error fetching votes:", error);
      return {};
    }

    const voteMap: Record<string, string> = {};
    data?.forEach(v => {
      voteMap[v.target_id] = v.vote_type;
    });

    return voteMap;
  } catch (error) {
    console.error("Error fetching votes:", error);
    return {};
  }
}

export async function castVote(
  userId: string,
  targetType: "post" | "comment",
  targetId: string,
  voteType: "helpful" | "not_helpful"
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user already voted
    const { data: existingVote } = await supabase
      .from("community_votes")
      .select("id, vote_type")
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .maybeSingle();

    const tableName = targetType === "post" ? "community_posts" : "community_comments";

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Remove vote (toggle off)
        await supabase.from("community_votes").delete().eq("id", existingVote.id);

        // Decrement count
        const { data: target } = await supabase
          .from(tableName)
          .select("helpful_count, not_helpful_count")
          .eq("id", targetId)
          .single();

        if (target) {
          const updates = voteType === "helpful"
            ? { helpful_count: Math.max(0, (target.helpful_count || 0) - 1) }
            : { not_helpful_count: Math.max(0, (target.not_helpful_count || 0) - 1) };

          await supabase.from(tableName).update(updates).eq("id", targetId);
        }
      } else {
        // Change vote
        await supabase
          .from("community_votes")
          .update({ vote_type: voteType })
          .eq("id", existingVote.id);

        // Adjust counts
        const { data: target } = await supabase
          .from(tableName)
          .select("helpful_count, not_helpful_count")
          .eq("id", targetId)
          .single();

        if (target) {
          const updates = voteType === "helpful"
            ? {
                helpful_count: (target.helpful_count || 0) + 1,
                not_helpful_count: Math.max(0, (target.not_helpful_count || 0) - 1),
              }
            : {
                helpful_count: Math.max(0, (target.helpful_count || 0) - 1),
                not_helpful_count: (target.not_helpful_count || 0) + 1,
              };

          await supabase.from(tableName).update(updates).eq("id", targetId);
        }
      }
    } else {
      // New vote
      const { error: voteError } = await supabase.from("community_votes").insert({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        vote_type: voteType,
      });

      if (voteError) {
        console.error("Error casting vote:", voteError);
        return { success: false, error: voteError.message };
      }

      // Increment count
      const { data: target } = await supabase
        .from(tableName)
        .select("helpful_count, not_helpful_count")
        .eq("id", targetId)
        .single();

      if (target) {
        const updates = voteType === "helpful"
          ? { helpful_count: (target.helpful_count || 0) + 1 }
          : { not_helpful_count: (target.not_helpful_count || 0) + 1 };

        await supabase.from(tableName).update(updates).eq("id", targetId);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error casting vote:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function deleteVote(
  userId: string,
  targetType: "post" | "comment",
  targetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existingVote } = await supabase
      .from("community_votes")
      .select("id, vote_type")
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .maybeSingle();

    if (!existingVote) {
      return { success: true };
    }

    await supabase.from("community_votes").delete().eq("id", existingVote.id);

    const tableName = targetType === "post" ? "community_posts" : "community_comments";

    const { data: target } = await supabase
      .from(tableName)
      .select("helpful_count, not_helpful_count")
      .eq("id", targetId)
      .single();

    if (target) {
      const updates = existingVote.vote_type === "helpful"
        ? { helpful_count: Math.max(0, (target.helpful_count || 0) - 1) }
        : { not_helpful_count: Math.max(0, (target.not_helpful_count || 0) - 1) };

      await supabase.from(tableName).update(updates).eq("id", targetId);
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting vote:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function watchPost(userId: string, postId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("community_post_watchers").insert({
      user_id: userId,
      post_id: postId,
    });

    if (error) {
      if (error.code === "23505") {
        // Already watching
        return { success: true };
      }
      console.error("Error watching post:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error watching post:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function unwatchPost(userId: string, postId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("community_post_watchers")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);

    if (error) {
      console.error("Error unwatching post:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error unwatching post:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function isWatchingPost(userId: string, postId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("community_post_watchers")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .maybeSingle();

    if (error) {
      console.error("Error checking watch status:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error checking watch status:", error);
    return false;
  }
}

export async function notifyPostWatchers(
  postId: string,
  excludeUserId: string,
  notificationType: "community_comment_on_post" | "community_post_resolved",
  title: string,
  body: string
): Promise<void> {
  try {
    const { data: watchers } = await supabase
      .from("community_post_watchers")
      .select("user_id")
      .eq("post_id", postId)
      .neq("user_id", excludeUserId);

    if (!watchers || watchers.length === 0) return;

    const notifications = watchers.map(w => ({
      user_id: w.user_id,
      type: notificationType,
      title,
      body,
      ref_id: postId,
    }));

    await supabase.from("notifications").insert(notifications);
  } catch (error) {
    console.error("Error notifying watchers:", error);
  }
}

export async function resolvePost(postId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("community_posts")
      .update({ status: "resolved" })
      .eq("id", postId);

    if (error) {
      console.error("Error resolving post:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error resolving post:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Alias for backward compatibility
export const isUserWatchingPost = isWatchingPost;

// Notify post author when someone comments
export async function notifyPostAuthorOfComment(
  postId: string,
  postAuthorId: string,
  commenterId: string,
  postTitle: string
): Promise<void> {
  // Don't notify if author is commenting on their own post
  if (postAuthorId === commenterId) return;

  try {
    await supabase.from("notifications").insert({
      user_id: postAuthorId,
      type: "community_comment_on_post",
      title: "New comment on your post",
      body: `Someone commented on your post: "${postTitle.substring(0, 50)}..."`,
      ref_id: postId,
    });
  } catch (error) {
    console.error("Error notifying post author:", error);
  }
}

// Update community post status (for moderation)
export async function updateCommunityPostStatus(
  postId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("community_posts")
      .update({ status })
      .eq("id", postId);

    if (error) {
      console.error("Error updating post status:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating post status:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
