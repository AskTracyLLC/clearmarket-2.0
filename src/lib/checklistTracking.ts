import { supabase } from "@/integrations/supabase/client";

/**
 * Track a checklist event by auto_track_key
 * Call this when user completes actions that should auto-complete checklist items
 */
export async function trackChecklistEvent(userId: string, autoTrackKey: string): Promise<void> {
  try {
    await supabase.rpc("complete_checklist_item_by_key", {
      p_user_id: userId,
      p_auto_track_key: autoTrackKey,
    });
  } catch (error) {
    console.error("Error tracking checklist event:", error);
  }
}

/**
 * Named checklist event helpers for cleaner imports
 * Usage: import { checklist } from "@/lib/checklistTracking";
 *        checklist.passwordReset(userId);
 */
export const checklist = {
  // Field Rep events
  passwordReset: (userId: string) => trackChecklistEvent(userId, "password_reset"),
  profileCompleted: (userId: string) => trackChecklistEvent(userId, "profile_completed"),
  coveragePricingSet: (userId: string) => trackChecklistEvent(userId, "coverage_pricing_set"),
  firstCommunityPost: (userId: string) => trackChecklistEvent(userId, "first_community_post"),
  firstCommunityReply: (userId: string) => trackChecklistEvent(userId, "first_community_reply"),
  firstSeekingCoverageResponse: (userId: string) => trackChecklistEvent(userId, "first_seeking_coverage_response"),
  firstRouteAlertSent: (userId: string) => trackChecklistEvent(userId, "first_route_alert_sent"),
  firstAgreementAccepted: (userId: string) => trackChecklistEvent(userId, "first_agreement_accepted"),
  firstVendorReviewSubmitted: (userId: string) => trackChecklistEvent(userId, "first_vendor_review_submitted"),
  notificationSettingsSaved: (userId: string) => trackChecklistEvent(userId, "notification_settings_saved"),
  
  // Vendor events
  vendorProfileCompleted: (userId: string) => trackChecklistEvent(userId, "vendor_profile_completed"),
  firstSeekingCoveragePost: (userId: string) => trackChecklistEvent(userId, "first_seeking_coverage_post"),
  firstRepMessageSent: (userId: string) => trackChecklistEvent(userId, "first_rep_message_sent"),
  firstAgreementCreated: (userId: string) => trackChecklistEvent(userId, "first_agreement_created"),
  firstAgreementActivated: (userId: string) => trackChecklistEvent(userId, "first_agreement_activated"),
  vendorPricingSaved: (userId: string) => trackChecklistEvent(userId, "vendor_pricing_saved"),
  firstRepReviewSubmitted: (userId: string) => trackChecklistEvent(userId, "first_rep_review_submitted"),
  firstRouteAlertAcknowledged: (userId: string) => trackChecklistEvent(userId, "first_route_alert_acknowledged"),
  vendorCalendarUpdated: (userId: string) => trackChecklistEvent(userId, "vendor_calendar_updated"),
};

/**
 * Auto-track keys for reference:
 * 
 * Field Rep:
 * - password_reset
 * - profile_completed
 * - coverage_pricing_set
 * - first_community_post
 * - first_community_reply
 * - first_seeking_coverage_response
 * - first_route_alert_sent
 * - first_agreement_accepted
 * - first_vendor_review_submitted
 * - notification_settings_saved
 * 
 * Vendor:
 * - vendor_profile_completed
 * - first_seeking_coverage_post
 * - first_rep_message_sent
 * - first_agreement_created
 * - first_agreement_activated
 * - vendor_pricing_saved
 * - first_rep_review_submitted
 * - first_route_alert_acknowledged
 * - vendor_calendar_updated
 */
