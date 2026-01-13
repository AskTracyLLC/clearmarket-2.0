import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ClearMarket brand colors
const BRAND_COLORS = {
  background: "#0d2626",
  surface: "#1a3333",
  primary: "#e07830",
  text: "#f2f2f2",
  textMuted: "#999999",
  border: "#2d4a4a",
  teal: "#3d7a7a",
};

interface DemoRequestPayload {
  fromEmail: string;
  company?: string;
  message: string;
  source?: string;
}

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Build branded HTML email for internal notification
function buildInternalNotificationEmail(
  fromEmail: string,
  company: string | undefined,
  message: string,
  timestamp: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interested in ClearMarket Demo</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BRAND_COLORS.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.teal} 0%, ${BRAND_COLORS.background} 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.text}; letter-spacing: -0.5px;">
                ClearMarket
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.surface}; padding: 40px; border-left: 1px solid ${BRAND_COLORS.border}; border-right: 1px solid ${BRAND_COLORS.border};">
              <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: ${BRAND_COLORS.text}; line-height: 1.3;">
                New Demo Access Request
              </h2>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
                    <strong style="color: ${BRAND_COLORS.primary};">Email:</strong>
                    <span style="color: ${BRAND_COLORS.text}; margin-left: 12px;">${fromEmail}</span>
                  </td>
                </tr>
                ${company ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
                    <strong style="color: ${BRAND_COLORS.primary};">Company / Role:</strong>
                    <span style="color: ${BRAND_COLORS.text}; margin-left: 12px;">${company}</span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
                    <strong style="color: ${BRAND_COLORS.primary};">Submitted:</strong>
                    <span style="color: ${BRAND_COLORS.text}; margin-left: 12px;">${timestamp}</span>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: ${BRAND_COLORS.background}; padding: 20px; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.primary};">
                <strong style="color: ${BRAND_COLORS.primary}; display: block; margin-bottom: 12px;">Message:</strong>
                <p style="margin: 0; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.background}; padding: 24px 40px; border: 1px solid ${BRAND_COLORS.border}; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.textMuted};">
                Submitted from Demo Access page
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

// Build branded HTML email for user confirmation
function buildUserConfirmationEmail(
  company: string | undefined,
  message: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We received your ClearMarket demo request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BRAND_COLORS.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.teal} 0%, ${BRAND_COLORS.background} 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.text}; letter-spacing: -0.5px;">
                ClearMarket
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.surface}; padding: 40px; border-left: 1px solid ${BRAND_COLORS.border}; border-right: 1px solid ${BRAND_COLORS.border};">
              <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: ${BRAND_COLORS.text}; line-height: 1.3;">
                Thanks for your interest!
              </h2>
              
              <p style="margin: 0 0 20px 0; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                We've received your request for demo access to ClearMarket. Our team will review your request and get back to you shortly with access details.
              </p>
              
              <p style="margin: 0 0 24px 0; color: ${BRAND_COLORS.textMuted}; font-size: 14px;">
                Here's a copy of what you submitted:
              </p>
              
              ${company ? `
              <p style="margin: 0 0 12px 0; color: ${BRAND_COLORS.text}; font-size: 14px;">
                <strong style="color: ${BRAND_COLORS.primary};">Company / Role:</strong> ${company}
              </p>
              ` : ''}
              
              <div style="background-color: ${BRAND_COLORS.background}; padding: 20px; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.primary};">
                <strong style="color: ${BRAND_COLORS.primary}; display: block; margin-bottom: 12px;">Your message:</strong>
                <p style="margin: 0; color: ${BRAND_COLORS.text}; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.background}; padding: 24px 40px; border: 1px solid ${BRAND_COLORS.border}; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.textMuted};">
                Questions? Reply to this email and we'll be happy to help.
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: DemoRequestPayload = await req.json();
    const { fromEmail, company, message, source } = payload;

    console.log("Demo request received:", { fromEmail, company, source });

    // Validate email
    if (!fromEmail || !isValidEmail(fromEmail)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate message length
    if (!message || message.trim().length < 10) {
      return new Response(
        JSON.stringify({ ok: false, error: "Message must be at least 10 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const timestamp = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Send email to internal team
    const internalEmailHtml = buildInternalNotificationEmail(fromEmail, company, message, timestamp);
    
    const internalEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClearMarket <hello@useclearmarket.io>",
        to: ["hello@useclearmarket.io"],
        bcc: ["tracy@asktracyllc.com"],
        reply_to: fromEmail,
        subject: "Interested in ClearMarket Demo",
        html: internalEmailHtml,
      }),
    });

    if (!internalEmailResponse.ok) {
      const errorText = await internalEmailResponse.text();
      console.error("Failed to send internal email:", errorText);
      throw new Error(`Failed to send request: ${internalEmailResponse.status}`);
    }

    console.log("Internal email sent successfully");

    // Send confirmation email to user
    const userConfirmationHtml = buildUserConfirmationEmail(company, message);
    
    const userEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClearMarket <hello@useclearmarket.io>",
        to: [fromEmail],
        subject: "We received your ClearMarket demo request",
        html: userConfirmationHtml,
      }),
    });

    if (!userEmailResponse.ok) {
      const errorText = await userEmailResponse.text();
      console.error("Failed to send user confirmation:", errorText);
      // Don't fail the whole request if confirmation fails
    } else {
      console.log("User confirmation email sent successfully");
    }

    return new Response(
      JSON.stringify({ ok: true, message: "Request sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-demo-request:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || "Failed to send request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
