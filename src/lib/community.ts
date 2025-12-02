import { supabase } from "@/integrations/supabase/client";

export interface CommunityPost {
  id: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  author_anonymous_id: string | null;
  author_role: string | null;
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
}

export interface CommunityVote {
  id: string;
  created_at: string;
  user_id: string;
  target_type: string;
  target_id: string;
  vote_type: string;
}

export const POST_CATEGORIES = [
  { value: "question", label: "Question", color: "bg-blue-500/20 text-blue-400" },
  { value: "warning", label: "Warning", color: "bg-orange-500/20 text-orange-400" },
  { value: "experience", label: "Experience", color: "bg-green-500/20 text-green-400" },
  { value: "info", label: "Info", color: "bg-purple-500/20 text-purple-400" },
];

export const POST_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500/20 text-green-400" },
  under_review: { label: "Under Review", color: "bg-yellow-500/20 text-yellow-400" },
  locked: { label: "Locked", color: "bg-red-500/20 text-red-400" },
  archived: { label: "Archived", color: "bg-muted text-muted-foreground" },
};

export function getCategoryConfig(category: string) {
  return POST_CATEGORIES.find(c => c.value === category) || POST_CATEGORIES[0];
}

export function getStatusConfig(status: string) {
  return POST_STATUS_CONFIG[status] || POST_STATUS_CONFIG.active;
}

export async function getAuthorInfo(userId: string): Promise<{ anonymousId: string; role: string }> {
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

  // Check profiles for role flags
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_fieldrep, is_vendor_admin")
    .eq("id", userId)
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
  body: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const { anonymousId, role } = await getAuthorInfo(authorId);

    const { data, error } = await supabase
      .from("community_posts")
      .insert({
        author_id: authorId,
        author_anonymous_id: anonymousId,
        author_role: role,
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
  category?: string;
  authorId?: string;
  sortBy?: "newest" | "helpful" | "comments";
  limit?: number;
  offset?: number;
}): Promise<CommunityPost[]> {
  try {
    let query = supabase.from("community_posts").select("*");

    if (options?.category && options.category !== "all") {
      query = query.eq("category", options.category);
    }

    if (options?.authorId) {
      query = query.eq("author_id", options.authorId);
    }

    // Sort
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

    return data || [];
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

    return data;
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

    // Update via direct increment
    const { data: post } = await supabase
      .from("community_posts")
      .select("comments_count")
      .eq("id", postId)
      .single();

    if (post) {
      await supabase
        .from("community_posts")
        .update({ comments_count: (post.comments_count || 0) + 1 })
        .eq("id", postId);
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

    // Fetch author info for each comment
    const authorIds = [...new Set(comments.map(c => c.author_id))];
    const authorInfoMap: Record<string, { anonymousId: string; role: string }> = {};

    for (const authorId of authorIds) {
      authorInfoMap[authorId] = await getAuthorInfo(authorId);
    }

    return comments.map(c => ({
      ...c,
      author_anonymous_id: authorInfoMap[c.author_id]?.anonymousId || "User",
      author_role: authorInfoMap[c.author_id]?.role || "unknown",
    }));
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
      const { error } = await supabase.from("community_votes").insert({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        vote_type: voteType,
      });

      if (error) {
        console.error("Error casting vote:", error);
        return { success: false, error: error.message };
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

// Notification for new comment on your post
export async function notifyPostAuthorOfComment(postAuthorId: string, postId: string, postTitle: string) {
  try {
    await supabase.from("notifications").insert({
      user_id: postAuthorId,
      type: "community_comment_on_post",
      title: "New comment on your post",
      body: `Someone commented on "${postTitle}"`,
      ref_id: postId,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}
