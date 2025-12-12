import { supabase } from "@/integrations/supabase/client";

export interface ReputationScores {
  trustScore: number;
  onTimeScore: number;
  qualityScore: number;
  communicationScore: number;
  reviewCount: number;
  kudosCount: number;
}

/**
 * Fetch comprehensive reputation stats for a rep including kudos boost
 * Communication score is boosted by vendor alert kudos (thumbs-ups)
 */
export async function fetchRepReputationScores(repUserId: string): Promise<ReputationScores> {
  // Fetch accepted reviews for this rep
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("rating_on_time, rating_quality, rating_communication")
    .eq("reviewee_id", repUserId)
    .eq("direction", "vendor_to_rep")
    .eq("workflow_status", "accepted")
    .eq("is_hidden", false)
    .eq("exclude_from_trust_score", false)
    .eq("is_feedback", false)
    .neq("status", "coaching");

  if (reviewsError) {
    console.error("Error fetching reviews:", reviewsError);
    return { trustScore: 0, onTimeScore: 0, qualityScore: 0, communicationScore: 0, reviewCount: 0, kudosCount: 0 };
  }

  // Fetch kudos count for this rep
  const { count: kudosCount, error: kudosError } = await supabase
    .from("vendor_alert_kudos")
    .select("id", { count: "exact", head: true })
    .eq("rep_id", repUserId);

  if (kudosError) {
    console.error("Error fetching kudos:", kudosError);
  }

  const K = kudosCount || 0;
  const R = reviews?.length || 0;

  // Calculate raw averages from reviews
  const onTimeRatings = (reviews || []).map(r => r.rating_on_time).filter((r): r is number => typeof r === "number");
  const qualityRatings = (reviews || []).map(r => r.rating_quality).filter((r): r is number => typeof r === "number");
  const communicationRatings = (reviews || []).map(r => r.rating_communication).filter((r): r is number => typeof r === "number");

  const onTimeScore = onTimeRatings.length > 0
    ? onTimeRatings.reduce((a, b) => a + b, 0) / onTimeRatings.length
    : 0;

  const qualityScore = qualityRatings.length > 0
    ? qualityRatings.reduce((a, b) => a + b, 0) / qualityRatings.length
    : 0;

  // Calculate weighted communication score with kudos boost
  // Each kudos is treated as a "mini review" worth 5 stars with weight 0.25
  const avgCommReviews = communicationRatings.length > 0
    ? communicationRatings.reduce((a, b) => a + b, 0) / communicationRatings.length
    : 0;

  const commReviewCount = communicationRatings.length;
  let communicationScore: number;

  if (commReviewCount === 0 && K === 0) {
    communicationScore = 0;
  } else if (commReviewCount === 0 && K > 0) {
    // Only kudos, no reviews - trend toward 5
    communicationScore = 5;
  } else {
    // Blend reviews with kudos
    // weightedCommScore = (avgCommReviews * R + 5 * 0.25 * K) / (R + 0.25 * K)
    const kudosWeight = 0.25;
    communicationScore = (avgCommReviews * commReviewCount + 5 * kudosWeight * K) / (commReviewCount + kudosWeight * K);
  }

  // Calculate overall trust score (average of all three dimensions)
  const validScores = [onTimeScore, qualityScore, communicationScore].filter(s => s > 0);
  const trustScore = validScores.length > 0
    ? validScores.reduce((a, b) => a + b, 0) / validScores.length
    : 0;

  return {
    trustScore,
    onTimeScore,
    qualityScore,
    communicationScore,
    reviewCount: R,
    kudosCount: K,
  };
}

/**
 * Toggle kudos on an alert (add or remove)
 */
export async function toggleAlertKudos(
  alertId: string,
  vendorId: string,
  repId: string
): Promise<{ success: boolean; added: boolean; error?: string }> {
  // Check if kudos already exists
  const { data: existing } = await supabase
    .from("vendor_alert_kudos")
    .select("id")
    .eq("alert_id", alertId)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (existing) {
    // Remove existing kudos
    const { error } = await supabase
      .from("vendor_alert_kudos")
      .delete()
      .eq("id", existing.id);

    if (error) {
      return { success: false, added: false, error: error.message };
    }
    return { success: true, added: false };
  } else {
    // Add new kudos
    const { error } = await supabase
      .from("vendor_alert_kudos")
      .insert({
        alert_id: alertId,
        vendor_id: vendorId,
        rep_id: repId,
      });

    if (error) {
      return { success: false, added: false, error: error.message };
    }
    return { success: true, added: true };
  }
}

/**
 * Check if a vendor has given kudos on an alert
 */
export async function hasGivenKudos(alertId: string, vendorId: string): Promise<boolean> {
  const { data } = await supabase
    .from("vendor_alert_kudos")
    .select("id")
    .eq("alert_id", alertId)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  return !!data;
}

/**
 * Get kudos count for an alert
 */
export async function getAlertKudosCount(alertId: string): Promise<number> {
  const { count } = await supabase
    .from("vendor_alert_kudos")
    .select("id", { count: "exact", head: true })
    .eq("alert_id", alertId);

  return count || 0;
}
