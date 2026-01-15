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
  mode?: "safe" | "purge_test";
}

interface FkBlocker {
  schema_name: string;
  table_name: string;
  column_name: string;
  constraint_name: string;
  on_delete: string;
  match_count: number;
}

interface LegacyBlocker {
  table: string;
  column: string;
  count: number;
  on_delete?: string;
}

interface DebugInfo {
  profileExistsBefore: boolean;
  authUserExistsBefore: boolean;
  profileFkBlockersBefore: FkBlocker[];
  authFkBlockersBefore: FkBlocker[];
  profileExistsAfterCleanup: boolean;
  profileFkBlockersAfterCleanup: FkBlocker[];
  authFkBlockersAfterCleanup: FkBlocker[];
  profileExistsAfterDelete?: boolean;
  authUserExistsAfterDelete?: boolean;
  deleteAuthErrorRaw?: Record<string, unknown>;
  hardProfileBlockers?: FkBlocker[];
  hardAuthBlockers?: FkBlocker[];
  softProfileRefs?: FkBlocker[];
  softAuthRefs?: FkBlocker[];
  purgeReport?: PurgeReport;
}

interface PurgeReport {
  deletedRows: { schema: string; table: string; column: string; rowsDeleted: number }[];
  nulledRows: { schema: string; table: string; column: string; rowsNulled: number }[];
  skipped: { schema: string; table: string; column: string; reason: string }[];
  remainingBlockers: FkBlocker[];
}

// Hard blockers = will prevent deletion, must be resolved first
const HARD_BLOCKER_ACTIONS = new Set(["NO ACTION", "RESTRICT", "SET DEFAULT"]);

// Soft refs = will be handled automatically by Postgres on delete
const SOFT_REF_ACTIONS = new Set(["CASCADE", "SET NULL"]);

// Tables that should preserve history (SET NULL instead of DELETE) in purge mode
const PRESERVE_TABLES = new Set([
  "vendor_activity_events",
  "admin_audit_log",
]);

// Tables where we delete rows entirely (the user owns these) - for safe mode cleanup
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

// Known FK references to null out in safe mode (audit/reference columns)
const FK_NULL_CANDIDATES = [
  { table: "admin_users", column: "created_by" },
  { table: "staff_users", column: "created_by" },
  { table: "rep_contact_access_log", column: "actor_user_id" },
  { table: "vendor_profile", column: "verified_by" },
  { table: "vendor_code_reservations", column: "created_by" },
  { table: "vendor_staff", column: "invited_by" },
  { table: "admin_broadcasts", column: "created_by" },
  { table: "background_checks", column: "reviewed_by_user_id" },
  { table: "checklist_item_feedback", column: "resolved_by" },
  { table: "help_center_articles", column: "last_updated_by" },
  { table: "dual_role_access_requests", column: "reviewed_by" },
  { table: "dual_role_access_requests", column: "gl_verified_by" },
  { table: "review_change_requests", column: "reviewed_by" },
  { table: "vendor_activity_events", column: "actor_user_id" },
  { table: "vendor_activity_events", column: "vendor_owner_user_id" },
];

// User-owned rows to delete in safe mode (before profile deletion)
const FK_DELETE_CANDIDATES = [
  { table: "admin_users", column: "user_id" },
  { table: "staff_users", column: "user_id" },
  { table: "vendor_staff", column: "staff_user_id" },
  { table: "rep_contact_info", column: "rep_user_id" },
  { table: "rep_profile", column: "user_id" },
  { table: "vendor_profile", column: "user_id" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let step = "init";
  let userId = "";
  let debug = false;
  const debugInfo: DebugInfo = {
    profileExistsBefore: false,
    authUserExistsBefore: false,
    profileFkBlockersBefore: [],
    authFkBlockersBefore: [],
    profileExistsAfterCleanup: false,
    profileFkBlockersAfterCleanup: [],
    authFkBlockersAfterCleanup: [],
  };

  const makeErrorResponse = (
    status: number,
    message: string,
    code?: string,
    details?: string,
    hint?: string
  ): Response => {
    const errorPayload = {
      success: false,
      step,
      error: { message, code, details, hint },
      userId,
      debug: debug ? debugInfo : undefined,
    };

    console.error("Delete failed at step:", step, "Error:", message);

    const responseStatus = status === 401 || status === 403 ? status : 200;

    return new Response(JSON.stringify(errorPayload), {
      status: responseStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    step = "env_check";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return makeErrorResponse(500, "Missing environment variables", "ENV_ERROR");
    }

    step = "auth_header";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return makeErrorResponse(401, "Missing authorization header", "AUTH_MISSING");
    }

    step = "parse_body";
    const url = new URL(req.url);
    debug = url.searchParams.get("debug") === "1";
    
    const payload: DeleteUserPayload = await req.json();
    const { target_user_id, reason, mode = "safe" } = payload;
    debug = debug || payload.debug === true;
    userId = target_user_id || "";

    if (!target_user_id) {
      return makeErrorResponse(400, "target_user_id is required", "MISSING_PARAM");
    }

    console.log("Delete user request - Target:", userId, "Mode:", mode, "Debug:", debug);

    step = "create_clients";
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    step = "get_calling_user";
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      return makeErrorResponse(401, "Unauthorized", "AUTH_FAILED", userError?.message);
    }

    step = "verify_admin";
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, is_super_admin, email")
      .eq("id", callingUser.id)
      .single();

    if (profileError || !callerProfile) {
      return makeErrorResponse(403, "Failed to verify permissions", "PROFILE_ERROR", profileError?.message);
    }

    if (!callerProfile.is_admin && !callerProfile.is_super_admin) {
      return makeErrorResponse(403, "Only admins can delete users", "NOT_ADMIN");
    }

    // =============================================
    // STEP: Gather initial state (BEFORE cleanup)
    // =============================================
    step = "gather_initial_state";

    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
    debugInfo.authUserExistsBefore = !!authUserData?.user;

    const { data: profileCheck } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", target_user_id)
      .maybeSingle();
    debugInfo.profileExistsBefore = !!profileCheck;

    // Call dynamic FK blocker RPCs
    const { data: profileBlockersBefore } = await supabaseAdmin.rpc("get_profile_fk_blockers", {
      p_profile_id: target_user_id,
    });
    debugInfo.profileFkBlockersBefore = profileBlockersBefore || [];

    const { data: authBlockersBefore } = await supabaseAdmin.rpc("get_auth_user_fk_blockers", {
      p_user_id: target_user_id,
    });
    debugInfo.authFkBlockersBefore = authBlockersBefore || [];

    console.log("Initial state:", {
      authExists: debugInfo.authUserExistsBefore,
      profileExists: debugInfo.profileExistsBefore,
      profileBlockers: debugInfo.profileFkBlockersBefore.length,
      authBlockers: debugInfo.authFkBlockersBefore.length,
    });

    step = "get_target_profile";
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, is_admin, is_super_admin, is_vendor_admin, staff_anonymous_id")
      .eq("id", target_user_id)
      .maybeSingle();

    const { data: vendorProfile } = await supabaseAdmin
      .from("vendor_profile")
      .select("vendor_code")
      .eq("user_id", target_user_id)
      .maybeSingle();

    step = "validate_target";
    if (targetProfile?.is_super_admin) {
      return makeErrorResponse(403, "Cannot delete super admin accounts", "SUPER_ADMIN");
    }

    if (target_user_id === callingUser.id) {
      return makeErrorResponse(400, "Cannot delete your own account", "SELF_DELETE");
    }

    const userLabel = targetProfile?.staff_anonymous_id 
      || vendorProfile?.vendor_code
      || targetProfile?.full_name 
      || targetProfile?.email 
      || `User#${target_user_id.slice(0, 8)}`;

    console.log("User label for audit snapshot:", userLabel);

    // =============================================
    // STEP: Perform cleanup based on mode
    // =============================================
    if (mode === "purge_test") {
      step = "purge_test_mode";
      debugInfo.purgeReport = await performPurgeTestMode(supabaseAdmin, target_user_id, debugInfo);
    } else {
      step = "safe_mode_cleanup";
      await performSafeModeCleanup(supabaseAdmin, target_user_id, userLabel);
    }

    // =============================================
    // STEP: Gather state AFTER cleanup
    // =============================================
    step = "gather_post_cleanup_state";

    const { data: profileCheckAfter } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", target_user_id)
      .maybeSingle();
    debugInfo.profileExistsAfterCleanup = !!profileCheckAfter;

    const { data: profileBlockersAfter } = await supabaseAdmin.rpc("get_profile_fk_blockers", {
      p_profile_id: target_user_id,
    });
    debugInfo.profileFkBlockersAfterCleanup = profileBlockersAfter || [];

    const { data: authBlockersAfter } = await supabaseAdmin.rpc("get_auth_user_fk_blockers", {
      p_user_id: target_user_id,
    });
    debugInfo.authFkBlockersAfterCleanup = authBlockersAfter || [];

    console.log("Post-cleanup state:", {
      profileExists: debugInfo.profileExistsAfterCleanup,
      profileBlockers: debugInfo.profileFkBlockersAfterCleanup.length,
      authBlockers: debugInfo.authFkBlockersAfterCleanup.length,
    });

    // =============================================
    // STEP: Classify blockers into HARD vs SOFT
    // =============================================
    step = "classify_blockers";

    // Filter out profiles.id from profile blockers (that's the row we're deleting)
    const profileBlockersFiltered = debugInfo.profileFkBlockersAfterCleanup.filter(
      (b) => !(b.table_name === "profiles" && b.column_name === "id")
    );

    // Hard blockers = NO ACTION, RESTRICT, SET DEFAULT - these WILL prevent deletion
    const hardProfileBlockers = profileBlockersFiltered.filter(
      (b) => HARD_BLOCKER_ACTIONS.has(b.on_delete)
    );
    const hardAuthBlockers = debugInfo.authFkBlockersAfterCleanup.filter(
      (b) => HARD_BLOCKER_ACTIONS.has(b.on_delete) && !(b.table_name === "profiles" && b.column_name === "id")
    );

    // Soft refs = CASCADE, SET NULL - these will auto-resolve on delete
    const softProfileRefs = profileBlockersFiltered.filter(
      (b) => SOFT_REF_ACTIONS.has(b.on_delete)
    );
    const softAuthRefs = debugInfo.authFkBlockersAfterCleanup.filter(
      (b) => SOFT_REF_ACTIONS.has(b.on_delete) && !(b.table_name === "profiles" && b.column_name === "id")
    );

    debugInfo.hardProfileBlockers = hardProfileBlockers;
    debugInfo.hardAuthBlockers = hardAuthBlockers;
    debugInfo.softProfileRefs = softProfileRefs;
    debugInfo.softAuthRefs = softAuthRefs;

    console.log("Blocker classification:", {
      hardProfile: hardProfileBlockers.length,
      hardAuth: hardAuthBlockers.length,
      softProfile: softProfileRefs.length,
      softAuth: softAuthRefs.length,
    });

    // =============================================
    // STEP: Pre-delete blocker check (ONLY hard blockers)
    // =============================================
    step = "pre_delete_blocker_check";

    if (hardProfileBlockers.length > 0 || hardAuthBlockers.length > 0) {
      console.error("HARD FK blockers still present:", {
        profile: hardProfileBlockers,
        auth: hardAuthBlockers,
      });

      return new Response(
        JSON.stringify({
          success: false,
          step: "pre_delete_blocker_check",
          error: {
            message: `Cannot delete user: ${hardProfileBlockers.length + hardAuthBlockers.length} hard FK blocker(s) exist`,
            hint: "These tables use NO ACTION/RESTRICT and must be cleaned up manually first",
          },
          userId: target_user_id,
          fkBlockers: hardProfileBlockers.map(blockerToLegacy),
          authFkBlockers: hardAuthBlockers.map(blockerToLegacy),
          softRefs: {
            profile: softProfileRefs.map(blockerToLegacy),
            auth: softAuthRefs.map(blockerToLegacy),
            message: "These will cascade automatically on profile deletion",
          },
          debug: debug ? debugInfo : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log soft refs for transparency (they will auto-resolve)
    if (softProfileRefs.length > 0 || softAuthRefs.length > 0) {
      console.log("Soft refs will cascade/null on delete:", {
        profile: softProfileRefs.map((b) => `${b.table_name}.${b.column_name}(${b.match_count})`),
        auth: softAuthRefs.map((b) => `${b.table_name}.${b.column_name}(${b.match_count})`),
      });
    }

    // =============================================
    // STEP: Delete profiles row FIRST (triggers CASCADE cleanup)
    // =============================================
    step = "delete_profile";
    
    if (debugInfo.profileExistsAfterCleanup) {
      const { error: profileDeleteError } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", target_user_id);

      if (profileDeleteError) {
        console.error("Failed to delete profile:", profileDeleteError);
        
        debugInfo.deleteAuthErrorRaw = {
          message: profileDeleteError.message,
          code: (profileDeleteError as any).code,
          details: (profileDeleteError as any).details,
          hint: (profileDeleteError as any).hint,
        };

        // Re-scan blockers
        const { data: profileBlockersFinal } = await supabaseAdmin.rpc("get_profile_fk_blockers", {
          p_profile_id: target_user_id,
        });

        return new Response(
          JSON.stringify({
            success: false,
            step,
            error: {
              message: profileDeleteError.message,
              code: (profileDeleteError as any).code || "PROFILE_DELETE_FAILED",
              details: (profileDeleteError as any).details,
              hint: "Profile deletion failed - check remaining blockers",
            },
            userId: target_user_id,
            fkBlockers: (profileBlockersFinal || []).map(blockerToLegacy),
            debug: debug ? debugInfo : undefined,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Profile deleted successfully, cascade cleanup triggered");
    }

    // =============================================
    // STEP: Delete the user from auth.users
    // =============================================
    step = "delete_auth_user";
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);

    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      
      debugInfo.deleteAuthErrorRaw = {
        message: deleteError.message,
        name: deleteError.name,
        status: (deleteError as any).status,
        code: (deleteError as any).code,
        details: (deleteError as any).details,
        hint: (deleteError as any).hint,
        stack: deleteError.stack,
      };

      // Re-scan blockers after failure
      const { data: authBlockersFinal } = await supabaseAdmin.rpc("get_auth_user_fk_blockers", {
        p_user_id: target_user_id,
      });

      const { data: authUserAfterFail } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
      debugInfo.authUserExistsAfterDelete = !!authUserAfterFail?.user;

      const { data: profileAfterFail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", target_user_id)
        .maybeSingle();
      debugInfo.profileExistsAfterDelete = !!profileAfterFail;

      return new Response(
        JSON.stringify({
          success: false,
          step,
          error: {
            message: deleteError.message,
            code: (deleteError as any).code || "AUTH_DELETE_FAILED",
            details: (deleteError as any).details,
            hint: "Check debug.deleteAuthErrorRaw for full error details",
          },
          userId: target_user_id,
          authFkBlockers: (authBlockersFinal || []).map(blockerToLegacy),
          debug: debug ? debugInfo : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Auth user deleted successfully:", target_user_id);

    // =============================================
    // STEP: Log the admin action
    // =============================================
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
          mode,
          debug_mode: debug,
          soft_refs_cascaded: {
            profile: softProfileRefs.length,
            auth: softAuthRefs.length,
          },
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
        softRefsCascaded: {
          profile: softProfileRefs.length,
          auth: softAuthRefs.length,
        },
        debug: debug ? debugInfo : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error at step:", step, error);

    const errObj = error as any;

    return new Response(
      JSON.stringify({
        success: false,
        step,
        error: {
          message: errObj?.message || String(errObj) || "An unexpected error occurred",
          code: errObj?.code || "UNEXPECTED",
          details: errObj?.details || errObj?.stack || null,
          hint: errObj?.hint || null,
        },
        userId,
        debug: debug ? debugInfo : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Convert new FkBlocker format to legacy format for backwards compatibility
 */
function blockerToLegacy(b: FkBlocker): LegacyBlocker {
  return {
    table: b.table_name,
    column: b.column_name,
    count: b.match_count,
    on_delete: b.on_delete,
  };
}

/**
 * Safe mode cleanup - uses known FK candidate lists
 */
async function performSafeModeCleanup(
  supabaseAdmin: any,
  targetUserId: string,
  userLabel: string
): Promise<void> {
  // Snapshot labels in audit tables
  await supabaseAdmin
    .from("vendor_activity_events")
    .update({ actor_label: userLabel })
    .eq("actor_user_id", targetUserId)
    .is("actor_label", null);

  await supabaseAdmin
    .from("vendor_activity_events")
    .update({ vendor_owner_label: userLabel })
    .eq("vendor_owner_user_id", targetUserId)
    .is("vendor_owner_label", null);

  // Null out FK references
  for (const { table, column } of FK_NULL_CANDIDATES) {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ [column]: null })
      .eq(column, targetUserId);
    
    if (error) {
      console.log(`Note: Could not null ${table}.${column}:`, error.message);
    }
  }

  // Delete owned rows
  for (const { table, column } of DELETE_OWNED_TABLES) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq(column, targetUserId);
    
    if (error) {
      console.log(`Note: Could not delete from ${table}.${column}:`, error.message);
    }
  }

  // Delete user-owned FK references (not profile - that's deleted separately)
  for (const { table, column } of FK_DELETE_CANDIDATES) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq(column, targetUserId);
    
    if (error) {
      console.log(`Note: Could not delete from ${table}.${column}:`, error.message);
    }
  }
}

/**
 * Purge test mode - aggressively delete all FK references discovered dynamically
 */
async function performPurgeTestMode(
  supabaseAdmin: any,
  targetUserId: string,
  debugInfo: DebugInfo
): Promise<PurgeReport> {
  const report: PurgeReport = {
    deletedRows: [],
    nulledRows: [],
    skipped: [],
    remainingBlockers: [],
  };

  const allBlockers = [
    ...debugInfo.profileFkBlockersBefore,
    ...debugInfo.authFkBlockersBefore,
  ];

  const seen = new Set<string>();
  const uniqueBlockers = allBlockers.filter((b) => {
    const key = `${b.schema_name}.${b.table_name}.${b.column_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const blocker of uniqueBlockers) {
    const { schema_name, table_name, column_name, on_delete } = blocker;

    // Skip CASCADE refs - they'll auto-delete
    if (on_delete === "CASCADE") {
      report.skipped.push({
        schema: schema_name,
        table: table_name,
        column: column_name,
        reason: "ON DELETE CASCADE - will auto-delete",
      });
      continue;
    }

    // For preserve tables, SET NULL
    if (PRESERVE_TABLES.has(table_name)) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table_name)
          .update({ [column_name]: null })
          .eq(column_name, targetUserId)
          .select("id");

        if (error) {
          report.skipped.push({
            schema: schema_name,
            table: table_name,
            column: column_name,
            reason: `SET NULL failed: ${error.message}`,
          });
        } else {
          report.nulledRows.push({
            schema: schema_name,
            table: table_name,
            column: column_name,
            rowsNulled: data?.length || 0,
          });
        }
      } catch (e: any) {
        report.skipped.push({
          schema: schema_name,
          table: table_name,
          column: column_name,
          reason: `SET NULL exception: ${e.message}`,
        });
      }
      continue;
    }

    // For other tables, delete the rows
    try {
      const { data, error } = await supabaseAdmin
        .from(table_name)
        .delete()
        .eq(column_name, targetUserId)
        .select("id");

      if (error) {
        report.skipped.push({
          schema: schema_name,
          table: table_name,
          column: column_name,
          reason: `DELETE failed: ${error.message}`,
        });
      } else {
        report.deletedRows.push({
          schema: schema_name,
          table: table_name,
          column: column_name,
          rowsDeleted: data?.length || 0,
        });
      }
    } catch (e: any) {
      report.skipped.push({
        schema: schema_name,
        table: table_name,
        column: column_name,
        reason: `DELETE exception: ${e.message}`,
      });
    }
  }

  // Re-scan for remaining blockers
  const { data: remainingProfile } = await supabaseAdmin.rpc("get_profile_fk_blockers", {
    p_profile_id: targetUserId,
  });
  const { data: remainingAuth } = await supabaseAdmin.rpc("get_auth_user_fk_blockers", {
    p_user_id: targetUserId,
  });

  report.remainingBlockers = [...(remainingProfile || []), ...(remainingAuth || [])];

  return report;
}
