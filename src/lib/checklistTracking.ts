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
