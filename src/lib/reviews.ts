import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch Trust Scores for multiple users
 * @param userIds Array of user IDs to fetch scores for
 * @returns Map of userId to { average, count }
 */
export async function fetchTrustScoresForUsers(
  userIds: string[]
): Promise<Record<string, { average: number; count: number }>> {
  if (userIds.length === 0) return {};

  const { data, error } = await supabase
    .from("reviews")
    .select(`
      reviewee_id,
      rating_on_time,
      rating_quality,
      rating_communication
    `)
    .in("reviewee_id", userIds);

  if (error) {
    console.error("Error fetching trust scores", error);
    return {};
  }

  const scores: Record<string, { sum: number; count: number }> = {};

  for (const row of data || []) {
    const key = row.reviewee_id;
    const ratings = [
      row.rating_on_time,
      row.rating_quality,
      row.rating_communication,
    ].filter((r) => typeof r === "number");

    if (ratings.length === 0) continue;

    const total = ratings.reduce((a, b) => a + b, 0);
    const avg = total / ratings.length;

    if (!scores[key]) {
      scores[key] = { sum: 0, count: 0 };
    }

    scores[key].sum += avg;
    scores[key].count += 1;
  }

  const result: Record<string, { average: number; count: number }> = {};
  for (const [userId, { sum, count }] of Object.entries(scores)) {
    result[userId] = {
      average: count > 0 ? sum / count : 0,
      count,
    };
  }

  return result;
}
