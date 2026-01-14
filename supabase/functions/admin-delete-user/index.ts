import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserPayload {
  target_user_id: string;
  reason?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      console.error("Failed to get calling user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Delete user request from:", callingUser.id);

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is an admin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, is_super_admin, email")
      .eq("id", callingUser.id)
      .single();

    if (profileError || !callerProfile) {
      console.error("Failed to get caller profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!callerProfile.is_admin && !callerProfile.is_super_admin) {
      console.error("Caller is not an admin:", callingUser.id);
      return new Response(
        JSON.stringify({ error: "Only admins can delete users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const payload: DeleteUserPayload = await req.json();
    const { target_user_id, reason } = payload;

    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: "target_user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Attempting to delete user:", target_user_id);

    // Get target user info for logging before deletion
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, is_admin, is_super_admin, is_vendor_admin, staff_anonymous_id, vendor_code")
      .eq("id", target_user_id)
      .single();

    // Prevent deleting super admins
    if (targetProfile?.is_super_admin) {
      console.error("Cannot delete super admin");
      return new Response(
        JSON.stringify({ error: "Cannot delete super admin accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-deletion
    if (target_user_id === callingUser.id) {
      console.error("Cannot delete self");
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a label for audit snapshot before deletion
    const userLabel = targetProfile?.staff_anonymous_id 
      || targetProfile?.vendor_code 
      || targetProfile?.full_name 
      || targetProfile?.email 
      || `User#${target_user_id.slice(0, 8)}`;

    console.log("User label for audit snapshot:", userLabel);

    // STEP 1: Update audit tables with snapshot labels BEFORE nulling user IDs
    // This preserves "who did what" after the user is deleted
    const { error: actorLabelError } = await supabaseAdmin
      .from("vendor_activity_events")
      .update({ actor_label: userLabel })
      .eq("actor_user_id", target_user_id)
      .is("actor_label", null);
    
    if (actorLabelError) {
      console.log("Note: Could not set actor_label:", actorLabelError.message);
    }

    const { error: ownerLabelError } = await supabaseAdmin
      .from("vendor_activity_events")
      .update({ vendor_owner_label: userLabel })
      .eq("vendor_owner_user_id", target_user_id)
      .is("vendor_owner_label", null);
    
    if (ownerLabelError) {
      console.log("Note: Could not set vendor_owner_label:", ownerLabelError.message);
    }

    // STEP 2: Null out FK references that block deletion (NO ACTION constraints)
    const nullOutTables = [
      { table: "admin_users", column: "created_by" },
      { table: "rep_contact_access_log", column: "actor_user_id" },
      { table: "vendor_profile", column: "verified_by" },
      { table: "staff_users", column: "created_by" },
      { table: "vendor_code_reservations", column: "created_by" },
      { table: "vendor_staff", column: "invited_by" },
      { table: "admin_broadcasts", column: "created_by" },
      { table: "background_checks", column: "reviewed_by_user_id" },
      { table: "checklist_item_feedback", column: "resolved_by" },
      { table: "help_center_articles", column: "last_updated_by" },
    ];

    for (const { table, column } of nullOutTables) {
      const { error: nullError } = await supabaseAdmin
        .from(table)
        .update({ [column]: null })
        .eq(column, target_user_id);
      
      if (nullError) {
        console.log(`Note: Could not null ${table}.${column}:`, nullError.message);
      }
    }

    // STEP 3: Delete rows from admin_users if this user is listed there
    const { error: adminUserDeleteError } = await supabaseAdmin
      .from("admin_users")
      .delete()
      .eq("user_id", target_user_id);
    
    if (adminUserDeleteError) {
      console.log("Note: Could not delete from admin_users:", adminUserDeleteError.message);
    }

    // STEP 4: Delete rows from staff_users if this user is listed there  
    const { error: staffUserDeleteError } = await supabaseAdmin
      .from("staff_users")
      .delete()
      .eq("user_id", target_user_id);
    
    if (staffUserDeleteError) {
      console.log("Note: Could not delete from staff_users:", staffUserDeleteError.message);
    }

    // STEP 5: Clean up tables that should NOT preserve history (delete rows)
    const deleteFromTables = [
      { table: "connection_notes", column: "author_id" },
      { table: "connection_notes", column: "rep_id" },
      { table: "connection_notes", column: "vendor_id" },
      { table: "community_votes", column: "user_id" },
      { table: "community_post_watchers", column: "user_id" },
      { table: "admin_broadcast_recipients", column: "user_id" },
      { table: "admin_broadcast_feedback", column: "user_id" },
    ];

    for (const { table, column } of deleteFromTables) {
      const { error: cleanupError } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, target_user_id);
      
      if (cleanupError) {
        console.log(`Note: Could not clean ${table}.${column}:`, cleanupError.message);
      }
    }

    // STEP 3: Delete the user from auth.users
    // FKs with ON DELETE SET NULL will automatically null out vendor_activity_events references
    // FKs with ON DELETE CASCADE will remove profiles row
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);

    if (deleteError) {
      console.error("Failed to delete user:", deleteError);
      return new Response(
        JSON.stringify({ 
          error: `Failed to delete user: ${deleteError.message}`,
          hint: "There may be additional FK constraints blocking deletion. Check database logs."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User deleted successfully:", target_user_id);

    // Log the admin action
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
          reason: reason || null,
        },
        source_page: "/admin/users",
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });

    if (auditError) {
      console.error("Failed to log audit action:", auditError);
      // Don't fail the request if audit logging fails
    }

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
