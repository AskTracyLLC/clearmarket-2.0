import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

// Hash a token for storage
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

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

// Send staff invite email via Resend
async function sendInviteEmail(
  resend: Resend,
  toEmail: string,
  invitedName: string,
  vendorCode: string,
  staffCode: string,
  role: string,
  inviteId: string,
  inviteToken: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://clearmarket.app";
  const signupUrl = `${appBaseUrl}/signup?staffInvite=1&inviteId=${inviteId}&token=${inviteToken}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: "ClearMarket <notifications@clearmarket.app>",
      to: [toEmail],
      subject: `You've been invited to join ${vendorCode} on ClearMarket`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">ClearMarket</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">You're Invited!</h2>
              <p style="margin: 0 0 20px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                Hi ${invitedName},
              </p>
              <p style="margin: 0 0 20px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                You've been invited to join <strong style="color: #ffffff;">${vendorCode}</strong> as a team member on ClearMarket.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #262626; border-radius: 8px; margin: 25px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; color: #a3a3a3; font-size: 14px;">Your Staff Code</p>
                    <p style="margin: 0; color: #22c55e; font-size: 24px; font-weight: 700; font-family: monospace;">${staffCode}</p>
                    <p style="margin: 8px 0 0; color: #a3a3a3; font-size: 14px;">Role: <strong style="color: #ffffff;">${role}</strong></p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 25px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                Click the button below to create your account and get started:
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #22c55e; border-radius: 8px;">
                    <a href="${signupUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Create Your Account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 25px 0 0; color: #737373; font-size: 14px; line-height: 1.6;">
                This invite link is valid for 7 days. If it expires, ask your vendor to resend the invite.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #262626;">
              <p style="margin: 0; color: #525252; font-size: 12px; text-align: center;">
                ClearMarket — Connecting Field Reps & Vendors
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("Email send exception:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
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

    const body = await req.json();
    const { vendorProfileId, name, email, role, resend: isResend, staffId } = body;

    // Handle resend invite flow
    if (isResend && staffId) {
      // Fetch existing staff record
      const { data: existingStaff, error: staffError } = await serviceClient
        .from("vendor_staff")
        .select("id, vendor_id, invited_name, invited_email, staff_code, role, status")
        .eq("id", staffId)
        .single();

      if (staffError || !existingStaff) {
        return new Response(JSON.stringify({ error: "Staff record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingStaff.status !== "invited") {
        return new Response(JSON.stringify({ error: "Can only resend to pending invites" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check authorization
      const authResult = await canManageStaff(serviceClient, existingStaff.vendor_id, user.id);
      if (!authResult.allowed) {
        return new Response(JSON.stringify({ error: "Not authorized to manage staff" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get vendor code
      const { data: vp } = await serviceClient
        .from("vendor_profile")
        .select("vendor_public_code")
        .eq("id", existingStaff.vendor_id)
        .single();

      // Generate new token for resend
      const newToken = generateToken();
      const newTokenHash = await hashToken(newToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      // Update token in database
      await serviceClient
        .from("vendor_staff")
        .update({
          invite_token_hash: newTokenHash,
          invite_token_expires_at: expiresAt,
        })
        .eq("id", existingStaff.id);

      // Send the email with new token
      let emailResult: { success: boolean; error?: string; messageId?: string } = { success: false, error: "RESEND_API_KEY not configured" };
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        emailResult = await sendInviteEmail(
          resend,
          existingStaff.invited_email,
          existingStaff.invited_name,
          vp?.vendor_public_code || "Your Vendor",
          existingStaff.staff_code || "N/A",
          existingStaff.role,
          existingStaff.id,
          newToken
        );
      }

      // Log the resend action
      try {
        await serviceClient.rpc("log_vendor_staff_action", {
          p_vendor_id: existingStaff.vendor_id,
          p_action_type: "vendor_staff.invite_resent",
          p_target_staff_id: existingStaff.id,
          p_details: {
            email_sent: emailResult.success,
            email_error: emailResult.error || null,
            resent_by_code: authResult.actorCode,
          },
        });
      } catch (err) {
        console.error("Failed to log resend action:", err);
      }

      console.log(`Invite resent for ${existingStaff.staff_code}, email_sent: ${emailResult.success}`);

      return new Response(JSON.stringify({
        success: true,
        staff_code: existingStaff.staff_code,
        staff_id: existingStaff.id,
        email_sent: emailResult.success,
        email_error: emailResult.error,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Original invite flow
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

    // Generate secure invite token
    const inviteToken = generateToken();
    const inviteTokenHash = await hashToken(inviteToken);
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Insert staff record with token (trigger will generate staff_code)
    const { data: staffRecord, error: insertError } = await serviceClient
      .from("vendor_staff")
      .insert({
        vendor_id: vendorProfileId,
        invited_name: name.trim(),
        invited_email: email.trim().toLowerCase(),
        role: role || "staff",
        status: "invited",
        invited_by: user.id,
        invite_token_hash: inviteTokenHash,
        invite_token_expires_at: tokenExpiresAt,
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

    // Send invite email via Resend with secure token
    let emailResult: { success: boolean; error?: string; messageId?: string } = { success: false, error: "RESEND_API_KEY not configured" };
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      emailResult = await sendInviteEmail(
        resend,
        email.trim().toLowerCase(),
        name.trim(),
        vp.vendor_public_code,
        staffRecord.staff_code || "N/A",
        role || "staff",
        staffRecord.id,
        inviteToken
      );
    }

    console.log(`Staff invited: ${staffRecord.staff_code} by ${authResult.actorCode} (${authResult.actorRole}), audit_logged: ${auditLogged}, email_sent: ${emailResult.success}`);

    return new Response(JSON.stringify({ 
      success: true, 
      staff_code: staffRecord.staff_code,
      staff_id: staffRecord.id,
      invited_by_code: authResult.actorCode,
      invited_by_role: authResult.actorRole,
      audit_logged: auditLogged,
      audit_error: auditError,
      email_sent: emailResult.success,
      email_error: emailResult.error,
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
