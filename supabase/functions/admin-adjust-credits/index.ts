import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdjustCreditsPayload {
  target_user_id: string;
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
    const { target_user_id, amount, note } = payload;

    // Validate target_user_id
    if (!target_user_id || typeof target_user_id !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "target_user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target user exists
    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", target_user_id)
      .single();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "Target user not found" }),
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

    // Get current balance (or 0 if no wallet exists)
    const { data: walletData, error: walletError } = await supabase
      .from("user_wallet")
      .select("credits")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (walletError) {
      console.error("Wallet lookup error:", walletError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch wallet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentBalance = walletData?.credits ?? 0;
    let newBalance = currentBalance + amount;

    // Clamp to 0 if going negative
    if (newBalance < 0) {
      newBalance = 0;
    }

    // Update or insert wallet
    if (walletData) {
      const { error: updateError } = await supabase
        .from("user_wallet")
        .update({ credits: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", target_user_id);

      if (updateError) {
        console.error("Wallet update error:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update wallet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("user_wallet")
        .insert({ user_id: target_user_id, credits: newBalance });

      if (insertError) {
        console.error("Wallet insert error:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create wallet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Log transaction
    const { error: txError } = await supabase
      .from("vendor_credit_transactions")
      .insert({
        user_id: target_user_id,
        amount: amount,
        action: "admin_adjustment",
        metadata: {
          note: trimmedNote,
          adjusted_by: actorUserId,
          previous_balance: currentBalance,
          new_balance: newBalance,
        },
      });

    if (txError) {
      console.error("Transaction log error:", txError);
      // Don't fail the request, but log the error
    }

    // Log to admin audit log
    const ipAddress = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const { error: auditError } = await supabase
      .from("admin_audit_log")
      .insert({
        actor_user_id: actorUserId,
        target_user_id: target_user_id,
        action_type: "credits.adjusted",
        action_summary: `Adjusted credits by ${amount > 0 ? "+" : ""}${amount} for ${targetProfile.email || targetProfile.full_name || target_user_id}`,
        action_details: {
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

    console.log(`Admin ${actorUserId} adjusted credits for ${target_user_id}: ${amount > 0 ? "+" : ""}${amount} (${currentBalance} -> ${newBalance})`);

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
