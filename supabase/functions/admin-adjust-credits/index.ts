import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdjustCreditsPayload {
  vendor_id: string;  // Required: vendor to adjust
  amount: number;
  note: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user from the token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actorUserId = user.id;

    // Verify caller is an admin
    const { data: actorProfile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin, is_moderator, is_support, email")
      .eq("id", actorUserId)
      .single();

    if (profileError || !actorProfile) {
      console.error("Profile lookup error:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "Unable to verify permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only admins can adjust credits (or special super admin email)
    const isAdmin = actorProfile.is_admin === true || 
                    actorProfile.email?.toLowerCase() === "tracy@asktracyllc.com";
    
    if (!isAdmin) {
      console.error("Permission denied: user is not admin");
      return new Response(
        JSON.stringify({ success: false, error: "Only admins can adjust credits" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate payload
    const payload: AdjustCreditsPayload = await req.json();
    const { vendor_id, amount, note } = payload;

    // Validate vendor_id
    if (!vendor_id || typeof vendor_id !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "vendor_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify vendor exists
    const { data: vendorProfile, error: vendorError } = await supabase
      .from("vendor_profile")
      .select("id, user_id, company_name")
      .eq("id", vendor_id)
      .single();

    if (vendorError || !vendorProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "Vendor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate amount
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Amount must be a non-zero integer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate note
    const trimmedNote = (note || "").trim();
    if (!trimmedNote) {
      return new Response(
        JSON.stringify({ success: false, error: "Note is required for admin adjustments" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current vendor wallet balance
    const { data: walletData, error: walletError } = await supabase
      .from("vendor_wallet")
      .select("credits_balance")
      .eq("vendor_id", vendor_id)
      .maybeSingle();

    if (walletError) {
      console.error("Wallet lookup error:", walletError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch vendor wallet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentBalance = walletData?.credits_balance ?? 0;

    // Use add_vendor_credits RPC for the adjustment (handles positive and negative amounts)
    const { error: rpcError } = await supabase.rpc("add_vendor_credits", {
      p_vendor_id: vendor_id,
      p_amount: amount,
      p_txn_type: "admin_adjustment",
      p_actor_user_id: actorUserId,
      p_metadata: {
        note: trimmedNote,
        previous_balance: currentBalance,
      },
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to adjust vendor credits" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get new balance
    const { data: newWalletData } = await supabase
      .from("vendor_wallet")
      .select("credits_balance")
      .eq("vendor_id", vendor_id)
      .single();

    const newBalance = newWalletData?.credits_balance ?? 0;

    // Log to admin audit log
    const ipAddress = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const { error: auditError } = await supabase
      .from("admin_audit_log")
      .insert({
        actor_user_id: actorUserId,
        target_user_id: vendorProfile.user_id, // Vendor owner for reference
        action_type: "vendor_credits.adjusted",
        action_summary: `Adjusted vendor credits by ${amount > 0 ? "+" : ""}${amount} for ${vendorProfile.company_name || vendor_id}`,
        action_details: {
          vendor_id,
          amount,
          note: trimmedNote,
          previous_balance: currentBalance,
          new_balance: newBalance,
        },
        source_page: "/admin/credits",
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (auditError) {
      console.error("Audit log error:", auditError);
      // Don't fail the request
    }

    console.log(`Admin ${actorUserId} adjusted vendor credits for ${vendor_id}: ${amount > 0 ? "+" : ""}${amount} (${currentBalance} -> ${newBalance})`);

    return new Response(
      JSON.stringify({ success: true, new_balance: newBalance }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in admin-adjust-credits:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
