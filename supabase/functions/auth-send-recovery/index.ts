import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generic success message - never reveals whether email exists
const GENERIC_SUCCESS = {
  ok: true,
  message: "If an account exists for this email, you'll receive a reset link shortly."
};

// Basic email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Hash IP for privacy (simple hash, not cryptographic - for logging only)
async function hashIp(ip: string): Promise<string> {
  const salt = "clearmarket_recovery_salt_2024";
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}

// Build ClearMarket branded email HTML
function buildEmailHtml(recoveryLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your ClearMarket password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #24282D; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #24282D;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #1a1d21; border-radius: 12px;">
          <tr>
            <td style="padding: 40px 32px; text-align: center;">
              <!-- Header -->
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">
                ClearMarket
              </h1>
              <p style="color: #9ca3af; font-size: 14px; margin: 0 0 32px 0;">
                Password Reset Request
              </p>
              
              <!-- Main content -->
              <p style="color: #e5e7eb; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">
                We received a request to reset your password. Click the button below to set a new password.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #D1532C;">
                    <a href="${recoveryLink}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; line-height: 20px; margin: 0 0 24px 0;">
                This link will expire in 1 hour for security reasons.
              </p>
              
              <!-- Fallback link -->
              <p style="color: #6b7280; font-size: 12px; line-height: 18px; margin: 0; word-break: break-all;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${recoveryLink}" style="color: #D1532C; text-decoration: underline;">${recoveryLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #374151; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; line-height: 18px; margin: 0;">
                If you didn't request this password reset, you can safely ignore this email.
                Your password will remain unchanged.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0 0;">
                Need help? Contact us at <a href="mailto:hello@useclearmarket.io" style="color: #D1532C;">hello@useclearmarket.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Build plain text fallback
function buildEmailText(recoveryLink: string): string {
  return `
Reset your ClearMarket password

We received a request to reset your password.

Click the link below to set a new password:
${recoveryLink}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

Need help? Contact us at hello@useclearmarket.io

- The ClearMarket Team
  `.trim();
}

// Send email via Resend API directly using fetch
async function sendEmailViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ id?: string; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClearMarket <hello@useclearmarket.io>",
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.message || `HTTP ${response.status}` };
    }
    
    return { id: data.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "unknown_fetch_error";
    return { error: errorMessage };
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get environment variables
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const baseUrl = Deno.env.get("SITE_URL") ?? Deno.env.get("APP_BASE_URL");

  // Create Supabase client with service role
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

  // Extract request metadata for logging
  const userAgent = req.headers.get("user-agent") || null;
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || null;
  let ipHash: string | null = null;
  if (clientIp) {
    try {
      ipHash = await hashIp(clientIp);
    } catch {
      // Ignore hash errors
    }
  }

  // Helper to log attempt
  async function logAttempt(
    email: string,
    status: "queued" | "sent" | "failed" | "rate_limited",
    extras: { provider_message_id?: string; error_text?: string } = {}
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("auth_recovery_email_attempts")
        .insert({
          email,
          request_ip_hash: ipHash,
          user_agent: userAgent,
          status,
          provider: "resend",
          provider_message_id: extras.provider_message_id || null,
          error_text: extras.error_text || null,
        })
        .select("id")
        .single();
      
      if (error) {
        console.error("Failed to log attempt:", error.message);
        return null;
      }
      return data?.id || null;
    } catch (err) {
      console.error("Exception logging attempt:", err);
      return null;
    }
  }

  // Helper to update existing log row
  async function updateAttempt(
    id: string,
    updates: { status?: string; provider_message_id?: string; error_text?: string }
  ): Promise<void> {
    try {
      await supabase
        .from("auth_recovery_email_attempts")
        .update(updates)
        .eq("id", id);
    } catch (err) {
      console.error("Exception updating attempt:", err);
    }
  }

  try {
    // Parse request body
    let body: { email?: string; redirectTo?: string };
    try {
      body = await req.json();
    } catch {
      await logAttempt("unknown", "failed", { error_text: "invalid_json" });
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const email = body.email?.trim() || "";
    const redirectTo = body.redirectTo || `${baseUrl}/auth/update-password`;

    // Step 1: Validate email format
    if (!email || !isValidEmail(email)) {
      await logAttempt(email || "empty", "failed", { error_text: "invalid_email" });
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Step 2: Check if base URL is configured
    if (!baseUrl) {
      await logAttempt(email, "failed", { error_text: "missing_base_url_config" });
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Step 3: Rate limiting - count attempts in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("auth_recovery_email_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email_normalized", normalizedEmail)
      .gte("created_at", tenMinutesAgo);

    if (countError) {
      console.error("Rate limit check error:", countError.message);
    }

    if ((count ?? 0) >= 3) {
      await logAttempt(email, "rate_limited", { error_text: "exceeded_3_attempts_in_10_min" });
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Step 4: Log queued attempt
    const attemptId = await logAttempt(email, "queued");

    // Step 5: Generate recovery link via Supabase Admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      // User may not exist, or other error - still return success (no enumeration)
      console.log("generateLink result:", linkError.message);
      if (attemptId) {
        await updateAttempt(attemptId, { 
          status: "failed", 
          error_text: `generateLink: ${linkError.message}` 
        });
      }
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Extract the action_link from the response
    const recoveryLink = linkData?.properties?.action_link;
    if (!recoveryLink) {
      if (attemptId) {
        await updateAttempt(attemptId, { 
          status: "failed", 
          error_text: "no_action_link_returned" 
        });
      }
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Step 6: Send email via Resend
    if (!resendApiKey) {
      if (attemptId) {
        await updateAttempt(attemptId, { 
          status: "failed", 
          error_text: "missing_resend_api_key" 
        });
      }
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailResult = await sendEmailViaResend(
      resendApiKey,
      email, // Use original email, not normalized
      "Reset your ClearMarket password",
      buildEmailHtml(recoveryLink),
      buildEmailText(recoveryLink)
    );

    // Step 7: Update log with result
    if (emailResult.id) {
      if (attemptId) {
        await updateAttempt(attemptId, {
          status: "sent",
          provider_message_id: emailResult.id,
        });
      }
      console.log("Password reset email sent successfully:", emailResult.id);
    } else {
      console.error("Resend error:", emailResult.error);
      if (attemptId) {
        await updateAttempt(attemptId, {
          status: "failed",
          error_text: `resend: ${emailResult.error}`,
        });
      }
      // Still return success to not leak information
    }

    return new Response(JSON.stringify(GENERIC_SUCCESS), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";
    console.error("Unhandled error in auth-send-recovery:", errorMessage);
    
    // Log the error but still return generic success
    await logAttempt("unknown", "failed", { error_text: `unhandled: ${errorMessage}` });
    
    return new Response(JSON.stringify(GENERIC_SUCCESS), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
