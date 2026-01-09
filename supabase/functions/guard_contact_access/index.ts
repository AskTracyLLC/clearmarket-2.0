import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * guard_contact_access
 * 
 * Rate-limits + logs contact access, then optionally returns contact email.
 * Prevents network-level scraping by only returning email via this function.
 * 
 * Request body:
 *   repUserId: string
 *   accessType: "view_contact" | "unlock_contact" | "export_contact"
 *   includeContact?: boolean  // if true and allowed, return { email } in response
 * 
 * Response:
 *   { allowed: true, contact?: { email?: string } }
 *   { allowed: false, reason: "RATE_LIMIT" | "NO_ACCESS" | "NOT_VENDOR" | ... }
 */

interface RequestBody {
  repUserId: string;
  accessType: "view_contact" | "unlock_contact" | "export_contact";
  includeContact?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "NOT_AUTHENTICATED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT for auth validation
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Create service role client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "NOT_AUTHENTICATED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { repUserId, accessType, includeContact } = body;

    if (!repUserId || !accessType) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "MISSING_PARAMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vendorUserId = user.id;

    // 1) Check if caller is a vendor
    const { data: viewerProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_vendor_admin, is_vendor_staff, is_admin")
      .eq("id", vendorUserId)
      .maybeSingle();

    const isVendor = viewerProfile?.is_vendor_admin || viewerProfile?.is_vendor_staff || false;
    const isAdmin = viewerProfile?.is_admin || false;

    if (!isVendor && !isAdmin) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "NOT_VENDOR" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Check if connected OR unlocked
    const [connectionResult, unlockResult] = await Promise.all([
      supabaseAdmin
        .from("vendor_connections")
        .select("id")
        .eq("vendor_id", vendorUserId)
        .eq("field_rep_id", repUserId)
        .eq("status", "connected")
        .maybeSingle(),
      supabaseAdmin
        .from("rep_contact_unlocks")
        .select("id")
        .eq("vendor_user_id", vendorUserId)
        .eq("rep_user_id", repUserId)
        .maybeSingle(),
    ]);

    const isConnected = Boolean(connectionResult.data?.id);
    const isUnlocked = Boolean(unlockResult.data?.id);

    // Admins can always view, but for normal vendors require connection or unlock
    if (!isAdmin && !isConnected && !isUnlocked) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "NO_ACCESS" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Call log_rep_contact_access RPC (handles rate limiting + logging)
    const { data: logResult, error: logError } = await supabaseAdmin.rpc(
      "log_rep_contact_access",
      {
        p_vendor_user_id: vendorUserId,
        p_rep_user_id: repUserId,
        p_access_type: accessType,
        p_source: "public_profile_dialog",
        p_metadata: { includeContact },
      }
    );

    if (logError) {
      console.error("log_rep_contact_access error:", logError);
      return new Response(
        JSON.stringify({ allowed: false, reason: "LOG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if rate limited
    if (logResult && !logResult.allowed) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "RATE_LIMIT" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) If includeContact, fetch email from profiles (service role)
    let contact: { email?: string | null } | null = null;
    if (includeContact) {
      const { data: repProfile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", repUserId)
        .maybeSingle();

      contact = { email: repProfile?.email || null };
    }

    return new Response(
      JSON.stringify({ allowed: true, contact }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("guard_contact_access error:", error);
    return new Response(
      JSON.stringify({ allowed: false, reason: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
