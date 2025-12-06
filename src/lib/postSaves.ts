import { supabase } from "@/integrations/supabase/client";
import { CommunityChannel, CommunityPost } from "./community";

export async function isPostSaved(userId: string, postId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("post_saves")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (error) {
    console.error("Error checking if post is saved:", error);
    return false;
  }

  return !!data;
}

export async function savePost(userId: string, postId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("post_saves")
    .insert({ user_id: userId, post_id: postId });

  if (error) {
    if (error.code === "23505") {
      // Already saved (unique constraint)
      return { success: true };
    }
    console.error("Error saving post:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function unsavePost(userId: string, postId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("post_saves")
    .delete()
    .eq("user_id", userId)
    .eq("post_id", postId);

  if (error) {
    console.error("Error unsaving post:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function fetchSavedPosts(
  userId: string,
  options?: {
    channel?: CommunityChannel;
    category?: string;
  }
): Promise<CommunityPost[]> {
  try {
    // First get the saved post IDs ordered by save date
    const { data: saves, error: savesError } = await supabase
      .from("post_saves")
      .select("post_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (savesError) {
      console.error("Error fetching saved posts:", savesError);
      return [];
    }

    if (!saves || saves.length === 0) return [];

    const postIds = saves.map(s => s.post_id);

    // Fetch the actual posts
    let query = supabase
      .from("community_posts")
      .select("*")
      .in("id", postIds);

    if (options?.channel) {
      query = query.eq("channel", options.channel);
    }

    if (options?.category) {
      query = query.eq("category", options.category);
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      console.error("Error fetching saved posts data:", postsError);
      return [];
    }

    if (!posts || posts.length === 0) return [];

    // Fetch community scores for all authors
    const authorIds = [...new Set(posts.map(p => p.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, community_score")
      .in("id", authorIds);

    const scoreMap: Record<string, number | null> = {};
    profiles?.forEach(p => {
      scoreMap[p.id] = p.community_score;
    });

    // Build post map for sorting
    const postMap = new Map<string, CommunityPost>();
    posts.forEach(p => {
      postMap.set(p.id, {
        ...p,
        channel: (p.channel || "community") as CommunityChannel,
        author_community_score: scoreMap[p.author_id] ?? null,
      });
    });

    // Return in saved order (most recently saved first)
    return postIds
      .map(id => postMap.get(id))
      .filter((p): p is CommunityPost => p !== undefined);
  } catch (error) {
    console.error("Error fetching saved posts:", error);
    return [];
  }
}

export async function getSavedPostIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("post_saves")
    .select("post_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching saved post IDs:", error);
    return new Set();
  }

  return new Set(data?.map(s => s.post_id) || []);
}

export async function getSavedPostsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("post_saves")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching saved posts count:", error);
    return 0;
  }

  return count || 0;
}