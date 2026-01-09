import { supabase } from "@/integrations/supabase/client";

export type AdminActionType =
  | "user.deactivated"
  | "user.reactivated"
  | "user.role_updated"
  | "user.message_sent"
  | "staff.invited"
  | "staff.invite_resent"
  | "staff.role_changed"
  | "staff.disabled"
  | "staff.enabled"
  | "user.blocked"
  | "user.unblocked"
  | "review.hidden"
  | "review.restored"
  | "report.resolved"
  | "credits.adjusted"
  | "support.reply_added"
  | "vendor_staff.invited"
  | "vendor_staff.role_changed"
  | "vendor_staff.disabled"
  | "vendor_staff.enabled";

export interface AdminAuditPayload {
  actionType: AdminActionType;
  actionSummary: string;
  targetUserId?: string;
  actionDetails?: Record<string, unknown>;
  sourcePage?: string;
  actorRole?: string;
  actorCode?: string;
}

/**
 * Logs an admin action to the audit log via edge function.
 * This is a fire-and-forget operation that won't block the UI.
 */
export async function logAdminAction(
  actorUserId: string,
  payload: AdminAuditPayload
): Promise<void> {
  const { 
    actionType, 
    actionSummary, 
    targetUserId, 
    actionDetails, 
    sourcePage,
    actorRole,
    actorCode
  } = payload;

  try {
    const { error } = await supabase.functions.invoke("admin-audit-log", {
      body: {
        actor_user_id: actorUserId,
        target_user_id: targetUserId ?? null,
        action_type: actionType,
        action_summary: actionSummary,
        action_details: actionDetails ?? null,
        source_page: sourcePage ?? null,
        actor_role: actorRole ?? null,
        actor_code: actorCode ?? null,
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
