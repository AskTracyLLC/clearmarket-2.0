import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash a token for comparison
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
    const { inviteId, token, password, termsAccepted, termsVersion } = body;

    // Validate required fields
    if (!inviteId || !token) {
      return new Response(JSON.stringify({ 
        error: "Missing invite ID or token",
        code: "MISSING_PARAMS"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ 
        error: "Password must be at least 6 characters",
        code: "INVALID_PASSWORD"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!termsAccepted) {
      return new Response(JSON.stringify({ 
        error: "You must accept the Terms of Service",
        code: "TERMS_NOT_ACCEPTED"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the invite record
    const { data: invite, error: inviteError } = await serviceClient
      .from("vendor_staff")
      .select("id, vendor_id, invited_name, invited_email, role, status, invite_token_hash, invite_token_expires_at, staff_code")
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
        error: "This invite has already been used",
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

    // Check if a user already exists with this email
    const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === invite.invited_email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      // User already exists - link them to this staff record
      userId = existingUser.id;
      console.log(`Linking existing user ${userId} to staff invite`);
    } else {
      // Create new auth user
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email: invite.invited_email,
        password: password,
        email_confirm: true, // Auto-confirm since invite was validated
        user_metadata: {
          full_name: invite.invited_name,
        },
      });

      if (createError || !newUser.user) {
        console.error("Failed to create user:", createError);
        return new Response(JSON.stringify({ 
          error: createError?.message || "Failed to create account",
          code: "CREATE_USER_FAILED"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
      console.log(`Created new user ${userId} for staff invite`);

      // Create or update profile
      const { error: profileError } = await serviceClient
        .from("profiles")
        .upsert({
          id: userId,
          full_name: invite.invited_name,
          email: invite.invited_email,
          is_vendor_admin: true, // Staff get vendor access
          active_role: "vendor",
          has_signed_terms: true,
          terms_signed_at: new Date().toISOString(),
          terms_version: termsVersion || "2025-01",
        }, {
          onConflict: "id",
        });

      if (profileError) {
        console.error("Failed to create profile:", profileError);
        // Don't fail - the user is created, profile can be fixed later
      }
    }

    // Activate the staff membership
    const { error: updateError } = await serviceClient
      .from("vendor_staff")
      .update({
        staff_user_id: userId,
        status: "active",
        accepted_at: new Date().toISOString(),
        invite_token_hash: null, // Clear token (single-use)
        invite_token_expires_at: null,
      })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Failed to activate staff membership:", updateError);
      return new Response(JSON.stringify({ 
        error: "Failed to activate your membership. Please contact support.",
        code: "ACTIVATION_FAILED"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For existing users, also update their profile for vendor access
    if (existingUser) {
      await serviceClient
        .from("profiles")
        .update({
          is_vendor_admin: true,
          active_role: "vendor",
          has_signed_terms: true,
          terms_signed_at: new Date().toISOString(),
          terms_version: termsVersion || "2025-01",
        })
        .eq("id", userId);
    }

    // Log the acceptance
    try {
      await serviceClient.rpc("log_vendor_staff_action", {
        p_vendor_id: invite.vendor_id,
        p_action_type: "vendor_staff.invite_accepted",
        p_target_staff_id: invite.id,
        p_details: {
          staff_code: invite.staff_code,
          role: invite.role,
          user_id: userId,
          existing_user: !!existingUser,
        },
      });
    } catch (logError) {
      console.error("Failed to log acceptance:", logError);
      // Don't fail the request for logging errors
    }

    console.log(`Staff invite accepted: ${invite.staff_code} -> user ${userId}`);

    return new Response(JSON.stringify({
      success: true,
      message: "Account setup complete",
      redirect: "/dashboard",
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
