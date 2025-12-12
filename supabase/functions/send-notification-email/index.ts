import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const ENABLE_EMAIL_NOTIFICATIONS = Deno.env.get("ENABLE_EMAIL_NOTIFICATIONS") === "true";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ClearMarket brand colors (from DMC palette)
const BRAND_COLORS = {
  background: "#0d2626",      // --cm-teal-deep dark mode bg
  surface: "#1a3333",         // --cm-surface dark
  primary: "#e07830",         // --cm-orange-primary
  primaryHover: "#d06820",
  text: "#f2f2f2",            // --cm-text dark
  textMuted: "#999999",       // --cm-text-muted
  border: "#2d4a4a",          // --cm-border dark
  teal: "#3d7a7a",            // --cm-teal-primary
};

interface EmailRequest {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  // New template-based approach
  templateKey?: string;
  placeholders?: Record<string, string>;
  ctaLabel?: string;
  ctaUrl?: string;
}

interface EmailTemplate {
  key: string;
  subject_template: string;
  body_template: string;
}

// Replace placeholders in template
function replacePlaceholders(template: string, placeholders: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

// Build ClearMarket branded HTML email
function buildBrandedEmail(
  subject: string,
  bodyContent: string,
  ctaLabel: string,
  ctaUrl: string,
  appBaseUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BRAND_COLORS.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.teal} 0%, ${BRAND_COLORS.background} 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.text}; letter-spacing: -0.5px;">
                      ClearMarket
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content card -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.surface}; padding: 40px; border-left: 1px solid ${BRAND_COLORS.border}; border-right: 1px solid ${BRAND_COLORS.border};">
              <!-- Subject/Title -->
              <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: ${BRAND_COLORS.text}; line-height: 1.3;">
                ${subject}
              </h2>
              
              <!-- Body content -->
              <div style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                ${bodyContent}
              </div>
              
              <!-- CTA Button -->
              ${ctaLabel && ctaUrl ? `
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top: 32px;">
                <tr>
                  <td style="background-color: ${BRAND_COLORS.primary}; border-radius: 8px;">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.background}; padding: 32px 40px; border: 1px solid ${BRAND_COLORS.border}; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: ${BRAND_COLORS.textMuted}; line-height: 1.5;">
                You're receiving this email because email notifications are enabled in your ClearMarket account.
              </p>
              <p style="margin: 0; font-size: 14px;">
                <a href="${appBaseUrl}/settings" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">
                  Manage notification settings →
                </a>
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

// Build plain text version
function buildPlainTextEmail(
  subject: string,
  bodyContent: string,
  ctaLabel: string,
  ctaUrl: string,
  appBaseUrl: string
): string {
  // Strip HTML tags from body content
  const plainBody = bodyContent
    .replace(/<blockquote[^>]*>/gi, '\n"')
    .replace(/<\/blockquote>/gi, '"\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong>/gi, '*')
    .replace(/<\/strong>/gi, '*')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  let text = `${subject}\n${'='.repeat(subject.length)}\n\n`;
  text += `${plainBody}\n\n`;
  
  if (ctaLabel && ctaUrl) {
    text += `${ctaLabel}: ${ctaUrl}\n\n`;
  }
  
  text += `---\n`;
  text += `You're receiving this email because email notifications are enabled in your ClearMarket account.\n`;
  text += `Manage notification settings: ${appBaseUrl}/settings\n`;
  
  return text;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: EmailRequest = await req.json();
    const { to, templateKey, placeholders, ctaLabel, ctaUrl } = body;
    let { subject, htmlBody, textBody } = body;

    console.log(`Email notification request for ${to}${templateKey ? ` using template: ${templateKey}` : ''}`);

    // Skip if emails are disabled
    if (!ENABLE_EMAIL_NOTIFICATIONS) {
      console.log("Email notifications disabled via ENABLE_EMAIL_NOTIFICATIONS env var");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "Email notifications disabled" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || supabaseUrl.replace(/\.supabase\.co$/, ".lovable.app");

    // If using template-based approach, load template from database
    if (templateKey && placeholders) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: template, error: templateError } = await supabase
        .from("email_templates")
        .select("subject_template, body_template")
        .eq("key", templateKey)
        .single();

      if (templateError || !template) {
        console.error(`Template not found: ${templateKey}`, templateError);
        return new Response(
          JSON.stringify({ ok: false, error: `Template not found: ${templateKey}` }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Add common placeholders
      const allPlaceholders = {
        ...placeholders,
        app_base_url: appBaseUrl,
        primary_cta_label: ctaLabel || "Go to ClearMarket",
        primary_cta_url: ctaUrl || `${appBaseUrl}/dashboard`,
      };

      // Replace placeholders in subject and body
      subject = replacePlaceholders(template.subject_template, allPlaceholders);
      const bodyContent = replacePlaceholders(template.body_template, allPlaceholders);

      // Build branded HTML email
      htmlBody = buildBrandedEmail(
        subject,
        bodyContent,
        ctaLabel || "Go to ClearMarket",
        ctaUrl || `${appBaseUrl}/dashboard`,
        appBaseUrl
      );

      textBody = buildPlainTextEmail(
        subject,
        bodyContent,
        ctaLabel || "Go to ClearMarket",
        ctaUrl || `${appBaseUrl}/dashboard`,
        appBaseUrl
      );
    }

    // Validate inputs
    if (!to || !subject || !htmlBody) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: to, subject, htmlBody" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClearMarket <notifications@useclearmarket.io>",
        to: [to],
        subject,
        html: htmlBody,
        text: textBody || htmlBody.replace(/<[^>]*>/g, ""),
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${emailResponse.status} ${errorText}`);
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ ok: true, data: emailData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
