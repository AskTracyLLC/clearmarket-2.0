import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check if user is owner or admin staff for this vendor
async function canManageStaff(
  serviceClient: SupabaseClient,
  vendorProfileId: string,
  userId: string
): Promise<{ allowed: boolean; isOwner: boolean; actorCode: string | null; actorRole: string }> {
  // Check if owner
  const { data: vp } = await serviceClient
    .from("vendor_profile")
    .select("user_id, vendor_public_code")
    .eq("id", vendorProfileId)
    .single();

  if (vp?.user_id === userId) {
    return {
      allowed: true,
      isOwner: true,
      actorCode: vp.vendor_public_code ? `${vp.vendor_public_code}_OWNER` : "OWNER",
      actorRole: "vendor_owner",
    };
  }

  // Check if admin staff
  const { data: staffRecord } = await serviceClient
    .from("vendor_staff")
    .select("id, staff_code, role, status")
    .eq("vendor_id", vendorProfileId)
    .eq("staff_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (staffRecord && staffRecord.role === "admin") {
    return {
      allowed: true,
      isOwner: false,
      actorCode: staffRecord.staff_code || "STAFF_ADMIN",
      actorRole: "vendor_staff",
    };
  }

  return { allowed: false, isOwner: false, actorCode: null, actorRole: "unknown" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { vendorProfileId, name, email, role } = await req.json();

    if (!vendorProfileId || !name || !email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch vendor profile and verify status
    const { data: vp, error: vpError } = await serviceClient
      .from("vendor_profile")
      .select("id, user_id, vendor_verification_status, vendor_public_code")
      .eq("id", vendorProfileId)
      .single();

    if (vpError || !vp) {
      return new Response(JSON.stringify({ error: "Vendor profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller can manage staff (owner or admin staff)
    const authResult = await canManageStaff(serviceClient, vendorProfileId, user.id);
    if (!authResult.allowed) {
      return new Response(JSON.stringify({ error: "Not authorized to manage staff" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (vp.vendor_verification_status !== "verified") {
      return new Response(JSON.stringify({ error: "Vendor must be verified to invite staff" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!vp.vendor_public_code) {
      return new Response(JSON.stringify({ error: "Vendor must have a public code assigned" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert staff record (trigger will generate staff_code)
    const { data: staffRecord, error: insertError } = await serviceClient
      .from("vendor_staff")
      .insert({
        vendor_id: vendorProfileId,
        invited_name: name.trim(),
        invited_email: email.trim().toLowerCase(),
        role: role || "staff",
        status: "invited",
        invited_by: user.id,
      })
      .select("id, staff_code")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ error: "This email has already been invited" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    // Log the invite action IMMEDIATELY after insert (before any email attempt)
    // This ensures the audit trail exists even if email fails
    let auditLogged = false;
    let auditError: string | null = null;
    try {
      await serviceClient.rpc("log_vendor_staff_action", {
        p_vendor_id: vendorProfileId,
        p_action_type: "vendor_staff.invited",
        p_target_staff_id: staffRecord.id,
        p_details: {
          invited_email: email.trim().toLowerCase(),
          invited_role: role || "staff",
          invited_by_code: authResult.actorCode,
        },
      });
      auditLogged = true;
    } catch (err) {
      console.error("Failed to log invite action:", err);
      auditError = err instanceof Error ? err.message : "Unknown audit error";
    }

    console.log(`Staff invited: ${staffRecord.staff_code} by ${authResult.actorCode} (${authResult.actorRole}), audit_logged: ${auditLogged}`);

    // TODO: Send invite email via Supabase Auth admin invite or custom email
    // Email sending would go here - if it fails, audit is already logged

    return new Response(JSON.stringify({ 
      success: true, 
      staff_code: staffRecord.staff_code,
      staff_id: staffRecord.id,
      invited_by_code: authResult.actorCode,
      invited_by_role: authResult.actorRole,
      audit_logged: auditLogged,
      audit_error: auditError,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
