import { supabase } from "@/integrations/supabase/client";
import { getReviewSettings } from "./reviewSettings";

/**
 * Fetch Trust Scores for multiple users
 * Excludes reviews marked as feedback (is_feedback = true)
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
      rating_communication,
      exclude_from_trust_score,
      is_hidden,
      is_feedback,
      status
    `)
    .in("reviewee_id", userIds)
    .eq("exclude_from_trust_score", false)
    .eq("is_hidden", false)
    .eq("is_feedback", false) // Exclude feedback reviews from scoring
    .neq("status", "coaching"); // Exclude coaching reviews from scoring

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

/**
 * Check if a user can post a new review to another user
 * Returns true if no existing review OR last review is older than the configured min days
 * OR if the waiting period is disabled by admin
 */
export async function canPostReview(
  reviewerId: string,
  revieweeId: string
): Promise<{ canPost: boolean; daysRemaining: number | null; nextReviewDate: Date | null; minDays: number; enforceWaitingPeriod: boolean }> {
  // Fetch dynamic settings
  const settings = await getReviewSettings();
  const minDays = settings.min_days_between_reviews;
  const enforceWaitingPeriod = settings.enforce_waiting_period;

  // If waiting period is disabled, always allow posting
  if (!enforceWaitingPeriod) {
    return { canPost: true, daysRemaining: null, nextReviewDate: null, minDays, enforceWaitingPeriod };
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("created_at")
    .eq("reviewer_id", reviewerId)
    .eq("reviewee_id", revieweeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error checking review eligibility:", error);
    return { canPost: true, daysRemaining: null, nextReviewDate: null, minDays, enforceWaitingPeriod };
  }

  if (!data) {
    return { canPost: true, daysRemaining: null, nextReviewDate: null, minDays, enforceWaitingPeriod };
  }

  const lastReviewDate = new Date(data.created_at);
  const nextReviewDate = new Date(lastReviewDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + minDays);
  
  const now = new Date();
  const daysSinceLastReview = Math.floor(
    (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastReview >= minDays) {
    return { canPost: true, daysRemaining: null, nextReviewDate: null, minDays, enforceWaitingPeriod };
  }

  return { canPost: false, daysRemaining: minDays - daysSinceLastReview, nextReviewDate, minDays, enforceWaitingPeriod };
}

/**
 * Check if a user can mark another review as feedback
 * Returns true if no feedback marked in the last N days (configured by admin)
 * OR if the waiting period is disabled by admin
 */
export async function canMarkFeedback(
  revieweeId: string
): Promise<{ canMark: boolean; daysRemaining: number | null; nextAvailableDate: Date | null; minDays: number; enforceWaitingPeriod: boolean }> {
  // Fetch dynamic settings
  const settings = await getReviewSettings();
  const minDays = settings.min_days_between_reviews;
  const enforceWaitingPeriod = settings.enforce_waiting_period;

  // If waiting period is disabled, always allow marking
  if (!enforceWaitingPeriod) {
    return { canMark: true, daysRemaining: null, nextAvailableDate: null, minDays, enforceWaitingPeriod };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minDays);

  const { data, error } = await supabase
    .from("reviews")
    .select("feedback_marked_at")
    .eq("reviewee_id", revieweeId)
    .eq("is_feedback", true)
    .gte("feedback_marked_at", cutoffDate.toISOString())
    .order("feedback_marked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error checking feedback eligibility:", error);
    return { canMark: true, daysRemaining: null, nextAvailableDate: null, minDays, enforceWaitingPeriod };
  }

  if (!data || !data.feedback_marked_at) {
    return { canMark: true, daysRemaining: null, nextAvailableDate: null, minDays, enforceWaitingPeriod };
  }

  const lastFeedbackDate = new Date(data.feedback_marked_at);
  const nextAvailableDate = new Date(lastFeedbackDate);
  nextAvailableDate.setDate(nextAvailableDate.getDate() + minDays);
  
  const now = new Date();
  const daysRemaining = Math.ceil(
    (nextAvailableDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining <= 0) {
    return { canMark: true, daysRemaining: null, nextAvailableDate: null, minDays, enforceWaitingPeriod };
  }

  return { canMark: false, daysRemaining, nextAvailableDate, minDays, enforceWaitingPeriod };
}

/**
 * Mark a review as feedback (one-time reset per 30 days)
 */
export async function markReviewAsFeedback(
  reviewId: string,
  revieweeId: string
): Promise<{ success: boolean; error?: string }> {
  // First check if user can mark feedback
  const { canMark, daysRemaining, minDays } = await canMarkFeedback(revieweeId);
  
  if (!canMark) {
    return { 
      success: false, 
      error: `You've already marked a review as feedback in the last ${minDays} days. Try again in ${daysRemaining} days.` 
    };
  }

  // Mark the review as feedback
  const { data: review, error: updateError } = await supabase
    .from("reviews")
    .update({
      is_feedback: true,
      feedback_marked_at: new Date().toISOString(),
      feedback_marked_by_user_id: revieweeId,
    })
    .eq("id", reviewId)
    .eq("reviewee_id", revieweeId) // Security: only reviewee can mark
    .eq("is_feedback", false) // Prevent double marking
    .select("reviewer_id")
    .single();

  if (updateError) {
    console.error("Error marking review as feedback:", updateError);
    return { success: false, error: "Failed to mark review as feedback" };
  }

  // Notify the reviewer that their review was marked as feedback
  if (review?.reviewer_id) {
    // Get reviewee display name
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("anonymous_id")
      .eq("user_id", revieweeId)
      .maybeSingle();

    await supabase.from("notifications").insert({
      user_id: review.reviewer_id,
      type: "review_marked_feedback",
      ref_id: reviewId,
      title: "Your review was marked as Feedback",
      body: `${repProfile?.anonymous_id || "A field rep"} has chosen to treat your review as Feedback in order to improve. The review remains visible but will not count toward their score.`,
    });
  }

  return { success: true };
}
