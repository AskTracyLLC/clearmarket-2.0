import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const betaMode = Deno.env.get("BETA_MODE") === "true";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { code, userId } = await req.json();

    console.log(`[validate-invite-code] Beta mode: ${betaMode}, Code: ${code}, User: ${userId}`);

    // If beta mode is off, skip validation
    if (!betaMode) {
      console.log("[validate-invite-code] Beta mode disabled, skipping validation");
      
      // Still record the code if provided
      if (code && userId) {
        await supabase
          .from("profiles")
          .update({ used_invite_code: code })
          .eq("id", userId);
      }
      
      return new Response(
        JSON.stringify({ success: true, message: "Beta mode disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Beta mode is on - validate the code if provided
    if (!code) {
      // No code provided - allow signup to proceed but log it
      // The client-side beta mode check should have caught this,
      // so if we're here, client beta mode is likely off
      console.log("[validate-invite-code] No code provided, allowing signup (client beta mode may be off)");
      return new Response(
        JSON.stringify({ success: true, message: "No invite code provided, proceeding without validation" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize code to uppercase for case-insensitive matching
    const normalizedCode = code.toUpperCase().trim();

    // Look up the invite code
    const { data: inviteCode, error: lookupError } = await supabase
      .from("beta_invite_codes")
      .select("*")
      .eq("code", normalizedCode)
      .eq("is_active", true)
      .single();

    if (lookupError || !inviteCode) {
      console.log(`[validate-invite-code] Invalid code: ${code}`, lookupError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired invite code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
      console.log(`[validate-invite-code] Code expired: ${code}`);
      return new Response(
        JSON.stringify({ success: false, error: "This invite code has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if max uses reached
    if (inviteCode.used_count >= inviteCode.max_uses) {
      console.log(`[validate-invite-code] Code maxed out: ${code}`);
      return new Response(
        JSON.stringify({ success: false, error: "This invite code has reached its maximum uses" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment used_count
    const newUsedCount = inviteCode.used_count + 1;
    const shouldDeactivate = newUsedCount >= inviteCode.max_uses;

    const { error: updateError } = await supabase
      .from("beta_invite_codes")
      .update({
        used_count: newUsedCount,
        is_active: shouldDeactivate ? false : true,
      })
      .eq("id", inviteCode.id);

    if (updateError) {
      console.error("[validate-invite-code] Failed to update invite code:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to process invite code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user's profile with the used code (store normalized version)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ used_invite_code: normalizedCode })
      .eq("id", userId);

    if (profileError) {
      console.error("[validate-invite-code] Failed to update profile:", profileError);
      // Non-fatal, continue
    }

    console.log(`[validate-invite-code] Successfully validated code ${code} for user ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Invite code validated successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[validate-invite-code] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
