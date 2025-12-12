import { supabase } from "@/integrations/supabase/client";

// Maximum number of reviews a rep can move to coaching
export const MAX_COACHING_REVIEWS = 3;

/**
 * Check if a rep can move a review to coaching
 * Returns false if they've already reached the max limit
 */
export async function canMoveToCoaching(repUserId: string): Promise<{
  canMove: boolean;
  currentCount: number;
  maxAllowed: number;
}> {
  const { count, error } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("reviewee_id", repUserId)
    .eq("status", "coaching");

  if (error) {
    console.error("Error checking coaching count:", error);
    return { canMove: true, currentCount: 0, maxAllowed: MAX_COACHING_REVIEWS };
  }

  const currentCount = count || 0;
  return {
    canMove: currentCount < MAX_COACHING_REVIEWS,
    currentCount,
    maxAllowed: MAX_COACHING_REVIEWS,
  };
}

/**
 * Move a review to coaching status
 */
export async function moveReviewToCoaching(
  reviewId: string,
  repUserId: string,
  coachingNote: string
): Promise<{ success: boolean; error?: string }> {
  // First check if they can move more reviews
  const { canMove, currentCount, maxAllowed } = await canMoveToCoaching(repUserId);

  if (!canMove) {
    return {
      success: false,
      error: `You've already moved the maximum number of reviews (${maxAllowed}) into Coaching. Please focus on improving your process before converting more.`,
    };
  }

  // TODO: Implement credit deduction here when billing is ready
  // Example:
  // const creditResult = await deductCoachingCredit(repUserId);
  // if (!creditResult.success) {
  //   return { success: false, error: "Insufficient coaching credits" };
  // }

  // Update the review
  const { error } = await supabase
    .from("reviews")
    .update({
      status: "coaching",
      converted_to_coaching_at: new Date().toISOString(),
      converted_to_coaching_by: repUserId,
      coaching_note: coachingNote,
    })
    .eq("id", reviewId)
    .eq("reviewee_id", repUserId) // Security: only the reviewee can move their own reviews
    .eq("status", "published"); // Can only move published reviews

  if (error) {
    console.error("Error moving review to coaching:", error);
    return { success: false, error: "Failed to move review to coaching" };
  }

  // Notify the vendor who left the review
  const { data: review } = await supabase
    .from("reviews")
    .select("reviewer_id")
    .eq("id", reviewId)
    .single();

  if (review?.reviewer_id) {
    // Get rep anonymous ID for notification
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("anonymous_id")
      .eq("user_id", repUserId)
      .maybeSingle();

    await supabase.from("notifications").insert({
      user_id: review.reviewer_id,
      type: "review_moved_to_coaching",
      ref_id: reviewId,
      title: "Your review was moved to Coaching",
      body: `${repProfile?.anonymous_id || "A field rep"} has moved your review to their Coaching / Private Feedback bucket. The review remains visible to you and ClearMarket Admins, but no longer affects their public rating.`,
    });
  }

  return { success: true };
}

/**
 * Get coaching review counts for a user
 */
export async function getReviewCounts(userId: string): Promise<{
  publicCount: number;
  coachingCount: number;
}> {
  const { data, error } = await supabase
    .from("reviews")
    .select("status")
    .eq("reviewee_id", userId)
    .eq("direction", "vendor_to_rep")
    .in("status", ["published", "coaching"]);

  if (error) {
    console.error("Error fetching review counts:", error);
    return { publicCount: 0, coachingCount: 0 };
  }

  let publicCount = 0;
  let coachingCount = 0;

  (data || []).forEach((r) => {
    if (r.status === "coaching") {
      coachingCount++;
    } else {
      publicCount++;
    }
  });

  return { publicCount, coachingCount };
}
