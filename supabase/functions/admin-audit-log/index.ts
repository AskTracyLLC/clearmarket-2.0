import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuditLogPayload {
  actor_user_id: string;
  target_user_id?: string | null;
  action_type: string;
  action_summary: string;
  action_details?: Record<string, unknown> | null;
  source_page?: string | null;
  actor_role?: string | null;
  actor_code?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get authorization header to validate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const payload: AuditLogPayload = await req.json();
    
    const { 
      actor_user_id, 
      target_user_id, 
      action_type, 
      action_summary, 
      action_details, 
      source_page,
      actor_role,
      actor_code
    } = payload;

    if (!actor_user_id || !action_type || !action_summary) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: actor_user_id, action_type, action_summary" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that actor is a staff user (admin, moderator, or support)
    const { data: actorProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, is_moderator, is_support, staff_role")
      .eq("id", actor_user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching actor profile:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to validate actor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!actorProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "Actor profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileData = actorProfile as { 
      is_admin?: boolean; 
      is_moderator?: boolean; 
      is_support?: boolean;
      staff_role?: string | null;
    };
    const isStaff = profileData.is_admin || profileData.is_moderator || profileData.is_support;
    if (!isStaff) {
      return new Response(
        JSON.stringify({ success: false, error: "Actor is not a staff member" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Derive actor_role and actor_code if not provided
    let finalActorRole = actor_role;
    let finalActorCode = actor_code;

    if (!finalActorRole) {
      if (profileData.is_admin) {
        finalActorRole = "admin";
      } else if (profileData.is_moderator) {
        finalActorRole = "moderator";
      } else if (profileData.is_support) {
        finalActorRole = "support";
      } else {
        finalActorRole = "staff";
      }
    }

    if (!finalActorCode) {
      // Use staff_role as code if available, otherwise use role
      finalActorCode = profileData.staff_role?.toUpperCase() || finalActorRole?.toUpperCase() || "ADMIN";
    }

    // Extract IP and User Agent from headers
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                      req.headers.get("x-real-ip") || 
                      null;
    const userAgent = req.headers.get("user-agent") || null;

    // Insert audit log entry using service role (bypasses RLS)
    const { error: insertError } = await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        actor_user_id,
        target_user_id: target_user_id || null,
        action_type,
        action_summary,
        action_details: action_details || null,
        source_page: source_page || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        actor_role: finalActorRole,
        actor_code: finalActorCode,
      });

    if (insertError) {
      console.error("Error inserting audit log:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to insert audit log" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Audit log created: ${action_type} by ${actor_user_id} (${finalActorCode})`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-audit-log function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
