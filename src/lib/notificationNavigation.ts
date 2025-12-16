/**
 * Helper functions for notification navigation and target URLs
 */

import { supabase } from "@/integrations/supabase/client";

export interface NotificationTargetInfo {
  url: string;
  canNavigate: boolean;
}

/**
 * Get the target URL for a notification based on its type and ref_id
 */
export async function getNotificationTargetUrl(
  type: string,
  refId: string | null,
  userId: string,
  isRep: boolean,
  isVendor: boolean
): Promise<NotificationTargetInfo> {
  switch (type) {
    case "message":
    case "new_message": {
      if (refId) {
        // ref_id could be message ID, try to get conversation
        const { data: message } = await supabase
          .from("messages")
          .select("conversation_id")
          .eq("id", refId)
          .maybeSingle();
        
        if (message?.conversation_id) {
          return { url: `/messages/${message.conversation_id}`, canNavigate: true };
        }
      }
      return { url: "/messages", canNavigate: true };
    }

    case "admin_message": {
      if (refId) {
        return { url: `/messages/${refId}`, canNavigate: true };
      }
      return { url: "/messages", canNavigate: true };
    }

    case "announcement": {
      if (refId) {
        return { url: `/community/${refId}`, canNavigate: true };
      }
      return { url: "/community?tab=announcements", canNavigate: true };
    }

    case "community_comment_on_post":
    case "community_post_resolved": {
      if (refId) {
        return { url: `/community/${refId}`, canNavigate: true };
      }
      return { url: "/community", canNavigate: true };
    }

    case "connection_request":
    case "connection_accepted":
    case "connection_declined": {
      return { url: "/messages", canNavigate: true };
    }

    case "review":
    case "review_received":
    case "review_reminder": {
      if (isRep) {
        return { url: "/rep/reviews", canNavigate: true };
      }
      if (isVendor) {
        return { url: "/vendor/reviews", canNavigate: true };
      }
      return { url: "/dashboard", canNavigate: true };
    }

    case "new_coverage_opportunity":
    case "seeking_coverage_interest": {
      return { url: "/rep/find-work", canNavigate: true };
    }

    case "working_terms_request": {
      if (refId) {
        return { url: `/rep/working-terms-request/${refId}`, canNavigate: true };
      }
      return { url: isRep ? "/rep/my-vendors" : "/vendor/my-reps", canNavigate: true };
    }

    case "working_terms_submitted": {
      if (refId) {
        return { url: `/vendor/working-terms-review/${refId}`, canNavigate: true };
      }
      return { url: "/vendor/my-reps", canNavigate: true };
    }

    case "working_terms_confirmed": {
      return { url: isRep ? "/rep/my-vendors" : "/vendor/my-reps", canNavigate: true };
    }

    case "territory_assignment":
    case "territory_assignment_pending": {
      if (refId) {
        // Get conversation from assignment
        const { data: assignment } = await supabase
          .from("territory_assignments")
          .select("conversation_id")
          .eq("id", refId)
          .maybeSingle();
        
        if (assignment?.conversation_id) {
          return { url: `/messages/${assignment.conversation_id}`, canNavigate: true };
        }
      }
      return { url: "/messages", canNavigate: true };
    }

    case "territory_assignment_accepted":
    case "territory_assignment_declined": {
      return { url: isRep ? "/rep/my-vendors" : "/vendor/my-reps", canNavigate: true };
    }

    case "vendor_network_alert": {
      return { url: "/rep/my-vendors", canNavigate: true };
    }

    case "vendor_alert": {
      return { url: "/vendor/my-reps", canNavigate: true };
    }

    case "checklist_assigned": {
      return { url: "/dashboard", canNavigate: true };
    }

    default: {
      // For unknown types, don't navigate
      return { url: "", canNavigate: false };
    }
  }
}

/**
 * Synchronous version that returns a best-guess URL without async lookups
 * Use this for initial render, then optionally fetch async for accuracy
 */
export function getNotificationTargetUrlSync(
  type: string,
  refId: string | null,
  isRep: boolean,
  isVendor: boolean
): NotificationTargetInfo {
  switch (type) {
    case "message":
    case "new_message":
      return { url: "/messages", canNavigate: true };

    case "admin_message":
      return { url: refId ? `/messages/${refId}` : "/messages", canNavigate: true };

    case "announcement":
      return { url: refId ? `/community/${refId}` : "/community?tab=announcements", canNavigate: true };

    case "community_comment_on_post":
    case "community_post_resolved":
      return { url: refId ? `/community/${refId}` : "/community", canNavigate: true };

    case "connection_request":
    case "connection_accepted":
    case "connection_declined":
      return { url: "/messages", canNavigate: true };

    case "review":
    case "review_received":
    case "review_reminder":
      return { url: isRep ? "/rep/reviews" : isVendor ? "/vendor/reviews" : "/dashboard", canNavigate: true };

    case "new_coverage_opportunity":
    case "seeking_coverage_interest":
      return { url: "/rep/find-work", canNavigate: true };

    case "working_terms_request":
      return { url: refId ? `/rep/working-terms-request/${refId}` : "/dashboard", canNavigate: !!refId };

    case "working_terms_submitted":
      return { url: refId ? `/vendor/working-terms-review/${refId}` : "/vendor/my-reps", canNavigate: true };

    case "working_terms_confirmed":
      return { url: isRep ? "/rep/my-vendors" : "/vendor/my-reps", canNavigate: true };

    case "territory_assignment":
    case "territory_assignment_pending":
      return { url: "/messages", canNavigate: true };

    case "territory_assignment_accepted":
    case "territory_assignment_declined":
      return { url: isRep ? "/rep/my-vendors" : "/vendor/my-reps", canNavigate: true };

    case "vendor_network_alert":
      return { url: "/rep/my-vendors", canNavigate: true };

    case "vendor_alert":
      return { url: "/vendor/my-reps", canNavigate: true };

    case "checklist_assigned":
      return { url: "/dashboard", canNavigate: true };

    default:
      return { url: "", canNavigate: false };
  }
}
