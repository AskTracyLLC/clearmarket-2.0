import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function for token verification
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { inviteId, token } = body;

    if (!inviteId || !token) {
      return new Response(JSON.stringify({ 
        error: "Missing invite ID or token",
        code: "MISSING_PARAMS"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the invite record
    const { data: invite, error: inviteError } = await serviceClient
      .from("vendor_staff")
      .select("id, invited_name, invited_email, status, invite_token_hash, invite_token_expires_at")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      console.error("Invite lookup error:", inviteError);
      return new Response(JSON.stringify({ 
        error: "Invalid invite link",
        code: "INVALID_INVITE"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if invite is still pending
    if (invite.status !== "invited") {
      return new Response(JSON.stringify({ 
        error: "This invite has already been used or is no longer valid",
        code: "INVITE_USED"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if token hash exists
    if (!invite.invite_token_hash) {
      return new Response(JSON.stringify({ 
        error: "This invite link is invalid. Ask the vendor to resend the invite.",
        code: "NO_TOKEN"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (invite.invite_token_expires_at) {
      const expiresAt = new Date(invite.invite_token_expires_at);
      if (expiresAt < new Date()) {
        return new Response(JSON.stringify({ 
          error: "This invite link has expired. Ask the vendor to resend the invite.",
          code: "EXPIRED"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Verify token
    const tokenHash = await hashToken(token);
    if (tokenHash !== invite.invite_token_hash) {
      return new Response(JSON.stringify({ 
        error: "Invalid invite link",
        code: "INVALID_TOKEN"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return invite details (only name and email, nothing sensitive)
    return new Response(JSON.stringify({
      success: true,
      full_name: invite.invited_name,
      email: invite.invited_email,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: "SERVER_ERROR"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
