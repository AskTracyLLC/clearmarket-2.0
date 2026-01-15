import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserPayload {
  target_user_id: string;
  reason?: string;
  debug?: boolean;
}

interface FkBlocker {
  table: string;
  column: string;
  count: number;
}

interface ErrorResponse {
  success: false;
  step: string;
  error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  };
  userId: string;
  fkBlockers?: FkBlocker[];
}

// All known FK references to auth.users or profiles that could block deletion
const FK_CANDIDATES = [
  // References to auth.users with NO ACTION (must be nulled or deleted)
  { table: "admin_users", column: "user_id", action: "delete" },
  { table: "admin_users", column: "created_by", action: "null" },
  { table: "staff_users", column: "user_id", action: "delete" },
  { table: "staff_users", column: "created_by", action: "null" },
  { table: "rep_contact_access_log", column: "actor_user_id", action: "null" },
  { table: "vendor_profile", column: "verified_by", action: "null" },
  { table: "vendor_code_reservations", column: "created_by", action: "null" },
  { table: "vendor_staff", column: "invited_by", action: "null" },
  { table: "admin_broadcasts", column: "created_by", action: "null" },
  { table: "background_checks", column: "reviewed_by_user_id", action: "null" },
  { table: "checklist_item_feedback", column: "resolved_by", action: "null" },
  { table: "help_center_articles", column: "last_updated_by", action: "null" },

  // These typically cascade, but can still block deleteUser in practice; clean explicitly
  { table: "rep_contact_info", column: "rep_user_id", action: "delete" },
  { table: "rep_profile", column: "user_id", action: "delete" },
  { table: "vendor_profile", column: "user_id", action: "delete" },

  // References to profiles (cascade should handle most, but check for edge cases)
  { table: "dual_role_access_requests", column: "reviewed_by", action: "null" },
  { table: "dual_role_access_requests", column: "gl_verified_by", action: "null" },
  { table: "review_change_requests", column: "reviewed_by", action: "null" },
  { table: "vendor_activity_events", column: "actor_user_id", action: "null" },
  { table: "vendor_activity_events", column: "vendor_owner_user_id", action: "null" },
];

// Tables where we delete rows entirely (the user owns these)
const DELETE_OWNED_TABLES = [
  { table: "connection_notes", column: "author_id" },
  { table: "connection_notes", column: "rep_id" },
  { table: "connection_notes", column: "vendor_id" },
  { table: "community_votes", column: "user_id" },
  { table: "community_post_watchers", column: "user_id" },
  { table: "admin_broadcast_recipients", column: "user_id" },
  { table: "admin_broadcast_feedback", column: "user_id" },
  { table: "post_saves", column: "user_id" },
  { table: "saved_searches", column: "user_id" },
  { table: "user_feature_flags", column: "user_id" },
  { table: "user_pinned_features", column: "user_id" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let step = "init";
  let userId = "";
  let debug = false;

  const makeErrorResponse = async (
    // deno-lint-ignore no-explicit-any
    supabaseAdmin: any | null,
    status: number,
    message: string,
    code?: string,
    details?: string,
    hint?: string
  ): Promise<Response> => {
    const errorPayload: ErrorResponse = {
      success: false,
      step,
      error: { message, code, details, hint },
      userId,
    };

    // If debug mode and we have a client, scan for remaining blockers
    if (debug && supabaseAdmin && userId) {
      errorPayload.fkBlockers = await scanFkBlockers(supabaseAdmin, userId);
    }

    console.error("Delete failed at step:", step, "Error:", message, "Blockers:", errorPayload.fkBlockers);

    return new Response(
      JSON.stringify(errorPayload),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  };

  try {
    step = "env_check";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return await makeErrorResponse(null, 500, "Missing environment variables", "ENV_ERROR");
    }

    step = "auth_header";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return await makeErrorResponse(null, 401, "Missing authorization header", "AUTH_MISSING");
    }

    step = "parse_body";
    const url = new URL(req.url);
    debug = url.searchParams.get("debug") === "1";
    
    const payload: DeleteUserPayload = await req.json();
    const { target_user_id, reason } = payload;
    debug = debug || payload.debug === true;
    userId = target_user_id || "";

    if (!target_user_id) {
      return await makeErrorResponse(null, 400, "target_user_id is required", "MISSING_PARAM");
    }

    step = "create_clients";
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    step = "get_calling_user";
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return await makeErrorResponse(supabaseAdmin, 401, "Unauthorized", "AUTH_FAILED", userError?.message);
    }

    console.log("Delete user request from:", callingUser.id, "Target:", userId, "Debug:", debug);

    step = "verify_admin";
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, is_super_admin, email")
      .eq("id", callingUser.id)
      .single();

    if (profileError || !callerProfile) {
      return await makeErrorResponse(supabaseAdmin, 403, "Failed to verify permissions", "PROFILE_ERROR", profileError?.message);
    }

    if (!callerProfile.is_admin && !callerProfile.is_super_admin) {
      return await makeErrorResponse(supabaseAdmin, 403, "Only admins can delete users", "NOT_ADMIN");
    }

    step = "get_target_profile";
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, is_admin, is_super_admin, is_vendor_admin, staff_anonymous_id")
      .eq("id", target_user_id)
      .single();

    // Also check vendor_profile for vendor_code
    const { data: vendorProfile } = await supabaseAdmin
      .from("vendor_profile")
      .select("vendor_code")
      .eq("user_id", target_user_id)
      .maybeSingle();

    step = "validate_target";
    if (targetProfile?.is_super_admin) {
      return await makeErrorResponse(supabaseAdmin, 403, "Cannot delete super admin accounts", "SUPER_ADMIN");
    }

    if (target_user_id === callingUser.id) {
      return await makeErrorResponse(supabaseAdmin, 400, "Cannot delete your own account", "SELF_DELETE");
    }

    // Build user label for audit snapshot
    const userLabel = targetProfile?.staff_anonymous_id 
      || vendorProfile?.vendor_code
      || targetProfile?.full_name 
      || targetProfile?.email 
      || `User#${target_user_id.slice(0, 8)}`;

    console.log("User label for audit snapshot:", userLabel);

    // STEP: Snapshot labels in audit tables
    step = "snapshot_actor_label";
    const { error: actorLabelError } = await supabaseAdmin
      .from("vendor_activity_events")
      .update({ actor_label: userLabel })
      .eq("actor_user_id", target_user_id)
      .is("actor_label", null);
    
    if (actorLabelError) {
      console.log("Note: Could not set actor_label:", actorLabelError.message);
    }

    step = "snapshot_owner_label";
    const { error: ownerLabelError } = await supabaseAdmin
      .from("vendor_activity_events")
      .update({ vendor_owner_label: userLabel })
      .eq("vendor_owner_user_id", target_user_id)
      .is("vendor_owner_label", null);
    
    if (ownerLabelError) {
      console.log("Note: Could not set vendor_owner_label:", ownerLabelError.message);
    }

    // STEP: Null out FK references that would block deletion
    for (const { table, column, action } of FK_CANDIDATES) {
      step = `cleanup_${table}.${column}`;
      
      if (action === "null") {
        const { error } = await supabaseAdmin
          .from(table)
          .update({ [column]: null })
          .eq(column, target_user_id);
        
        if (error) {
          console.log(`Note: Could not null ${table}.${column}:`, error.message, error.code);
        }
      } else if (action === "delete") {
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .eq(column, target_user_id);
        
        if (error) {
          console.log(`Note: Could not delete from ${table}.${column}:`, error.message, error.code);
        }
      }
    }

    // STEP: Delete owned rows
    for (const { table, column } of DELETE_OWNED_TABLES) {
      step = `delete_owned_${table}.${column}`;
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, target_user_id);
      
      if (error) {
        console.log(`Note: Could not delete from ${table}.${column}:`, error.message, error.code);
      }
    }

    // STEP: Pre-delete blocker scan (always run). If anything still references this user, do NOT attempt delete.
    step = "pre_delete_blocker_scan";
    const blockers = await scanFkBlockers(supabaseAdmin, target_user_id);

    if (blockers.length > 0) {
      console.error("FK blockers still present:", JSON.stringify(blockers));

      // Return 200 so client can read the payload (not 4xx/5xx which loses body)
      return new Response(
        JSON.stringify({
          success: false,
          step: "pre_delete_blocker_scan",
          error: {
            message: `Cannot delete user: ${blockers.length} FK reference(s) still present`,
            hint: "These tables still reference the user and must be cleaned up first",
          },
          userId: target_user_id,
          fkBlockers: blockers,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP: Delete the user from auth.users
    step = "delete_auth_user";
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);

    if (deleteError) {
      console.error("Failed to delete user:", deleteError);
      
      // Scan blockers for diagnostic info
      const postErrorBlockers = await scanFkBlockers(supabaseAdmin, target_user_id);
      
      // Return 200 so client can read the payload
      return new Response(
        JSON.stringify({
          success: false,
          step,
          error: {
            message: deleteError.message,
            code: (deleteError as any).code || "DELETE_FAILED",
            details: (deleteError as any).details,
            hint: "Check fkBlockers array for remaining FK references"
          },
          userId: target_user_id,
          fkBlockers: postErrorBlockers,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User deleted successfully:", target_user_id);

    // STEP: Log the admin action
    step = "audit_log";
    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        actor_user_id: callingUser.id,
        action_type: "user.deleted",
        action_summary: `Deleted user ${targetProfile?.email || targetProfile?.full_name || target_user_id}`,
        target_user_id: target_user_id,
        action_details: {
          deleted_email: targetProfile?.email,
          deleted_name: targetProfile?.full_name,
          deleted_label: userLabel,
          reason: reason || null,
          debug_mode: debug,
        },
        source_page: "/admin/users",
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });

    if (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User deleted successfully",
        userId: target_user_id,
        label: userLabel,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error at step:", step, error);
    
    const errObj = error as Error;
    return new Response(
      JSON.stringify({
        success: false,
        step,
        error: {
          message: errObj.message || "An unexpected error occurred",
          code: "UNEXPECTED",
          details: errObj.stack,
        },
        userId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Scan all known FK candidate tables for remaining references to the user.
 * Returns an array of {table, column, count} for any with count > 0.
 */
async function scanFkBlockers(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string
): Promise<FkBlocker[]> {
  const blockers: FkBlocker[] = [];
  
  // Comprehensive list of all tables/columns that reference auth.users or profiles
  const allCandidates = [
    // auth.users references (NO ACTION constraints - must be cleaned)
    { table: "admin_users", column: "user_id" },
    { table: "admin_users", column: "created_by" },
    { table: "staff_users", column: "user_id" },
    { table: "staff_users", column: "created_by" },
    { table: "rep_contact_access_log", column: "actor_user_id" },
    { table: "vendor_profile", column: "verified_by" },
    { table: "vendor_code_reservations", column: "created_by" },
    { table: "vendor_staff", column: "invited_by" },
    { table: "vendor_staff", column: "staff_user_id" },
    { table: "admin_broadcasts", column: "created_by" },
    { table: "background_checks", column: "reviewed_by_user_id" },
    { table: "checklist_item_feedback", column: "resolved_by" },
    { table: "help_center_articles", column: "last_updated_by" },
    { table: "vendor_client_proposals", column: "vendor_user_id" },
    { table: "vendor_proposal_shares", column: "vendor_user_id" },
    { table: "vendor_proposal_rep_rate_snapshots", column: "rep_user_id" },
    { table: "rep_contact_info", column: "rep_user_id" },
    // profiles references (should cascade, but check anyway)
    { table: "profiles", column: "id" },
    { table: "rep_profile", column: "user_id" },
    { table: "vendor_profile", column: "user_id" },
    { table: "vendor_activity_events", column: "actor_user_id" },
    { table: "vendor_activity_events", column: "vendor_owner_user_id" },
    { table: "dual_role_access_requests", column: "user_id" },
    { table: "dual_role_access_requests", column: "reviewed_by" },
    { table: "dual_role_access_requests", column: "gl_verified_by" },
  ];

  for (const { table, column } of allCandidates) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(column, userId);

      if (!error && count && count > 0) {
        blockers.push({ table, column, count });
      }
    } catch (e) {
      // Table might not exist or column name wrong - skip silently
      console.log(`Scan skip: ${table}.${column}`, (e as Error).message);
    }
  }

  return blockers;
}
