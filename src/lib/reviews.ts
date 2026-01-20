import { supabase } from "@/integrations/supabase/client";
import { getReviewSettings } from "./reviewSettings";

/**
 * Fetch Trust Scores for multiple users
 * Excludes reviews marked as feedback (is_feedback = true)
 * Excludes reviews with status = 'coaching'
 * Only includes reviews with workflow_status = 'accepted'
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
      status,
      workflow_status
    `)
    .in("reviewee_id", userIds)
    .eq("exclude_from_trust_score", false)
    .eq("is_hidden", false)
    .eq("is_feedback", false) // Exclude feedback reviews from scoring
    .neq("status", "coaching") // Exclude coaching reviews from scoring
    .eq("workflow_status", "accepted"); // Only include accepted reviews

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
    // Get reviewee display name from profiles (canonical source)
    const { data: profileData } = await supabase
      .from("profiles")
      .select("anonymous_id")
      .eq("id", revieweeId)
      .maybeSingle();

    await supabase.from("notifications").insert({
      user_id: review.reviewer_id,
      type: "review_marked_feedback",
      ref_id: reviewId,
      title: "Your review was marked as Feedback",
      body: `${profileData?.anonymous_id || "A field rep"} has chosen to treat your review as Feedback in order to improve. The review remains visible but will not count toward their score.`,
    });
  }

  return { success: true };
}

/**
 * Accept a review - it will now count toward Trust Score
 */
export async function acceptReview(
  reviewId: string,
  revieweeId: string,
  spotlight: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("reviews")
    .update({
      workflow_status: "accepted",
      accepted_at: new Date().toISOString(),
      is_spotlighted: spotlight,
    })
    .eq("id", reviewId)
    .eq("reviewee_id", revieweeId)
    .eq("workflow_status", "pending");

  if (error) {
    console.error("Error accepting review:", error);
    return { success: false, error: "Failed to accept review" };
  }

  return { success: true };
}

/**
 * Dispute a review - it will be flagged for admin review
 */
export async function disputeReview(
  reviewId: string,
  revieweeId: string,
  reason: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("reviews")
    .update({
      workflow_status: "disputed",
      disputed_at: new Date().toISOString(),
      dispute_reason: reason,
      dispute_note: note,
    })
    .eq("id", reviewId)
    .eq("reviewee_id", revieweeId)
    .eq("workflow_status", "pending");

  if (error) {
    console.error("Error disputing review:", error);
    return { success: false, error: "Failed to dispute review" };
  }

  return { success: true };
}

/**
 * Toggle spotlight status on an accepted review
 */
export async function toggleReviewSpotlight(
  reviewId: string,
  revieweeId: string
): Promise<{ success: boolean; isSpotlighted?: boolean; error?: string }> {
  // First get current spotlight status
  const { data: review, error: fetchError } = await supabase
    .from("reviews")
    .select("is_spotlighted")
    .eq("id", reviewId)
    .eq("reviewee_id", revieweeId)
    .eq("workflow_status", "accepted")
    .single();

  if (fetchError || !review) {
    return { success: false, error: "Review not found or not accepted" };
  }

  const newSpotlight = !review.is_spotlighted;

  const { error } = await supabase
    .from("reviews")
    .update({ is_spotlighted: newSpotlight })
    .eq("id", reviewId)
    .eq("reviewee_id", revieweeId);

  if (error) {
    console.error("Error toggling spotlight:", error);
    return { success: false, error: "Failed to update spotlight" };
  }

  return { success: true, isSpotlighted: newSpotlight };
}

/**
 * Get review counts by workflow status for a user
 */
export async function getReviewWorkflowCounts(
  revieweeId: string
): Promise<{ pending: number; accepted: number; disputed: number; coaching: number }> {
  const { data, error } = await supabase
    .from("reviews")
    .select("workflow_status, status")
    .eq("reviewee_id", revieweeId)
    .eq("direction", "vendor_to_rep");

  if (error) {
    console.error("Error fetching review counts:", error);
    return { pending: 0, accepted: 0, disputed: 0, coaching: 0 };
  }

  const counts = {
    pending: 0,
    accepted: 0,
    disputed: 0,
    coaching: 0,
  };

  for (const review of data || []) {
    if (review.status === "coaching") {
      counts.coaching++;
    } else if (review.workflow_status === "pending") {
      counts.pending++;
    } else if (review.workflow_status === "accepted") {
      counts.accepted++;
    } else if (review.workflow_status === "disputed") {
      counts.disputed++;
    }
  }

  return counts;
}
