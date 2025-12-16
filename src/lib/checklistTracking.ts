import { supabase } from "@/integrations/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";

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
 * Evaluate whether an auto-tracked checklist condition is already satisfied
 * based on current database state. Used for retroactive completion.
 */
export async function evaluateAutoTrackKeyForUser(
  client: SupabaseClient,
  userId: string,
  autoTrackKey: string
): Promise<boolean> {
  try {
    switch (autoTrackKey) {
      case "profile_completed": {
        // Field Rep profile: check rep_profile has city, state, and at least one inspection type
        const { data: repProfile } = await client
          .from("rep_profile")
          .select("city, state, inspection_types")
          .eq("user_id", userId)
          .maybeSingle();
        
        if (!repProfile) return false;
        
        const hasLocation = Boolean(repProfile.city && repProfile.state);
        const hasInspectionTypes = Array.isArray(repProfile.inspection_types) && repProfile.inspection_types.length > 0;
        return hasLocation && hasInspectionTypes;
      }

      case "vendor_profile_completed": {
        // Vendor profile: check vendor_profile has company_name and state
        const { data: vendorProfile } = await client
          .from("vendor_profile")
          .select("company_name, state")
          .eq("user_id", userId)
          .maybeSingle();
        
        if (!vendorProfile) return false;
        return Boolean(vendorProfile.company_name && vendorProfile.state);
      }

      case "coverage_pricing_set": {
        // Field Rep has at least one coverage area with pricing
        const { count } = await client
          .from("rep_coverage_areas")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("base_price", "is", null);
        
        return (count ?? 0) > 0;
      }

      case "vendor_pricing_saved": {
        // Vendor has at least one coverage focus area
        const { count } = await client
          .from("vendor_coverage_focus")
          .select("*", { count: "exact", head: true })
          .eq("vendor_id", userId);
        
        return (count ?? 0) > 0;
      }

      case "first_community_post": {
        // User has posted at least one community post
        const { count } = await client
          .from("community_posts")
          .select("*", { count: "exact", head: true })
          .eq("author_id", userId);
        
        return (count ?? 0) > 0;
      }

      case "first_community_reply": {
        // User has commented on at least one community post
        const { count } = await client
          .from("community_comments")
          .select("*", { count: "exact", head: true })
          .eq("author_id", userId);
        
        return (count ?? 0) > 0;
      }

      case "first_seeking_coverage_response": {
        // Field Rep has expressed interest in at least one post
        const { count } = await client
          .from("rep_interest")
          .select("*", { count: "exact", head: true })
          .eq("rep_id", userId);
        
        return (count ?? 0) > 0;
      }

      case "first_seeking_coverage_post": {
        // Vendor has created at least one seeking coverage post
        const { count } = await client
          .from("seeking_coverage_posts")
          .select("*", { count: "exact", head: true })
          .eq("vendor_id", userId);
        
        return (count ?? 0) > 0;
      }

      case "first_agreement_accepted":
      case "first_agreement_created":
      case "first_agreement_activated": {
        // Has at least one active connection
        const { count } = await client
          .from("vendor_connections")
          .select("*", { count: "exact", head: true })
          .or(`vendor_id.eq.${userId},field_rep_id.eq.${userId}`)
          .eq("status", "connected");
        
        return (count ?? 0) > 0;
      }

      case "first_vendor_review_submitted": {
        // Field Rep has submitted at least one review of a vendor
        const { count } = await client
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("reviewer_id", userId)
          .eq("direction", "rep_to_vendor");
        
        return (count ?? 0) > 0;
      }

      case "first_rep_review_submitted": {
        // Vendor has submitted at least one review of a rep
        const { count } = await client
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("reviewer_id", userId)
          .eq("direction", "vendor_to_rep");
        
        return (count ?? 0) > 0;
      }

      case "notification_settings_saved": {
        // User has notification preferences saved
        const { data } = await client
          .from("notification_preferences")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();
        
        return Boolean(data);
      }

      case "first_route_alert_sent": {
        // Field Rep has sent at least one network alert
        const { count } = await client
          .from("rep_network_alerts")
          .select("*", { count: "exact", head: true })
          .eq("vendor_id", userId)
          .eq("status", "sent");
        
        return (count ?? 0) > 0;
      }

      // These require specific user actions that can't be retroactively determined easily
      case "password_reset":
      case "first_rep_message_sent":
      case "first_route_alert_acknowledged":
      case "vendor_calendar_updated":
      default:
        return false;
    }
  } catch (error) {
    console.error(`Error evaluating auto_track_key ${autoTrackKey}:`, error);
    return false;
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
