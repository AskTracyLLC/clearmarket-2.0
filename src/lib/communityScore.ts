import { supabase } from "@/integrations/supabase/client";

export interface CommunityScoreData {
  communityScore: number;
  excludeFromReputation?: boolean;
}

/**
 * Fetch community scores for a list of user IDs
 */
export async function fetchCommunityScoresForUsers(
  userIds: string[]
): Promise<Record<string, CommunityScoreData>> {
  if (userIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, community_score")
      .in("id", userIds);

    if (error) {
      console.error("Error fetching community scores:", error);
      return {};
    }

    const scoreMap: Record<string, CommunityScoreData> = {};
    data?.forEach((profile) => {
      scoreMap[profile.id] = {
        communityScore: profile.community_score ?? 0,
      };
    });

    return scoreMap;
  } catch (error) {
    console.error("Error fetching community scores:", error);
    return {};
  }
}

/**
 * Format community score for display
 */
export function formatCommunityScore(score: number): string {
  if (score >= 0) {
    return `+${score}`;
  }
  return `${score}`;
}
