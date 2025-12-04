import { supabase } from "@/integrations/supabase/client";

export type AdminActionType =
  | "user.deactivated"
  | "user.reactivated"
  | "user.role_updated"
  | "staff.invited"
  | "staff.invite_resent"
  | "staff.role_changed"
  | "user.blocked"
  | "user.unblocked"
  | "review.hidden"
  | "review.restored"
  | "report.resolved"
  | "credits.adjusted"
  | "support.reply_added";

export interface AdminAuditPayload {
  actionType: AdminActionType;
  actionSummary: string;
  targetUserId?: string;
  actionDetails?: Record<string, any>;
  sourcePage?: string;
}

/**
 * Logs an admin action to the audit log via edge function.
 * This is a fire-and-forget operation that won't block the UI.
 */
export async function logAdminAction(
  actorUserId: string,
  payload: AdminAuditPayload
): Promise<void> {
  const { actionType, actionSummary, targetUserId, actionDetails, sourcePage } = payload;

  try {
    const { error } = await supabase.functions.invoke("admin-audit-log", {
      body: {
        actor_user_id: actorUserId,
        target_user_id: targetUserId ?? null,
        action_type: actionType,
        action_summary: actionSummary,
        action_details: actionDetails ?? null,
        source_page: sourcePage ?? null,
      },
    });

    if (error) {
      console.error("Failed to log admin action:", { error, payload });
    }
  } catch (err) {
    // Non-blocking - just log the error
    console.error("Failed to log admin action:", { err, payload });
  }
}
