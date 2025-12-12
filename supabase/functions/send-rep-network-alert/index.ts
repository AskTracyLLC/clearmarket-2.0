import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const ENABLE_EMAIL_NOTIFICATIONS = Deno.env.get("ENABLE_EMAIL_NOTIFICATIONS") === "true";

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

interface SendAlertRequest {
  alertId: string;
  repUserId: string;
}

// Build ClearMarket branded HTML email for external vendors
function buildExternalVendorEmail(
  repName: string,
  alertTitle: string,
  alertBody: string,
  appBaseUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${alertTitle}</title>
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
              
              <!-- From line -->
              <p style="margin: 0 0 8px 0; font-size: 14px; color: ${BRAND_COLORS.textMuted};">
                From: <strong style="color: ${BRAND_COLORS.text};">${repName}</strong> via ClearMarket
              </p>
              
              <!-- Subject/Title -->
              <h2 style="margin: 0 0 24px 0; font-size: 22px; font-weight: 600; color: ${BRAND_COLORS.text}; line-height: 1.3;">
                ${alertTitle}
              </h2>
              
              <!-- Body content -->
              <div style="color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">
                ${alertBody}
              </div>
              
            </td>
          </tr>
          
          <!-- CTA Footer for non-users -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.background}; padding: 32px 40px; border: 1px solid ${BRAND_COLORS.border}; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: ${BRAND_COLORS.text}; font-weight: 600;">
                Like what you see?
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: ${BRAND_COLORS.textMuted}; line-height: 1.5;">
                ClearMarket helps vendors organize their inspector network, track coverage, and stay on top of communication.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background-color: ${BRAND_COLORS.primary}; border-radius: 8px;">
                    <a href="${appBaseUrl}/signup?role=vendor" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Create a Free Vendor Profile
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0 0; font-size: 13px; color: ${BRAND_COLORS.textMuted};">
                Manage your Field Reps in one place at <a href="${appBaseUrl}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">useclearmarket.io</a>
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

// Build plain text version for external vendors
function buildExternalVendorPlainText(
  repName: string,
  alertTitle: string,
  alertBody: string,
  appBaseUrl: string
): string {
  return `
From: ${repName} via ClearMarket

${alertTitle}
${'='.repeat(alertTitle.length)}

${alertBody}

---

Like what you see?
ClearMarket helps vendors organize their inspector network, track coverage, and stay on top of communication.

Create a free vendor profile at ${appBaseUrl}/signup?role=vendor
Manage your Field Reps in one place at ${appBaseUrl}
  `.trim();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || supabaseUrl.replace(/\.supabase\.co$/, ".lovable.app");

    const body: SendAlertRequest = await req.json();
    const { alertId, repUserId } = body;

    console.log("send-rep-network-alert called:", { alertId, repUserId });

    if (!alertId || !repUserId) {
      return new Response(
        JSON.stringify({ error: "Missing alertId or repUserId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the alert
    const { data: alert, error: alertError } = await supabase
      .from("vendor_alerts")
      .select("*")
      .eq("id", alertId)
      .single();

    if (alertError || !alert) {
      console.error("Alert not found:", alertId, alertError);
      return new Response(
        JSON.stringify({ error: "Alert not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get rep profile for name
    const { data: repProfile } = await supabase
      .from("rep_profile")
      .select("anonymous_id, business_name")
      .eq("user_id", repUserId)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", repUserId)
      .single();

    const repName = repProfile?.business_name || profile?.full_name || repProfile?.anonymous_id || "A Field Rep";

    // Get connected ClearMarket vendors
    const { data: connections } = await supabase
      .from("vendor_connections")
      .select("vendor_id")
      .eq("field_rep_id", repUserId)
      .eq("status", "connected");

    const connectedVendorIds = connections?.map(c => c.vendor_id) || [];

    // Get manual vendor contacts (off-platform)
    const { data: manualContacts } = await supabase
      .from("rep_vendor_contacts")
      .select("id, email, contact_name, company_name")
      .eq("rep_user_id", repUserId)
      .eq("is_active", true);

    const manualContactEmails = manualContacts?.map(c => c.email) || [];

    console.log(`Processing alert: ${connectedVendorIds.length} ClearMarket vendors, ${manualContactEmails.length} manual contacts`);

    // Create in-app notifications for ClearMarket vendors
    for (const vendorId of connectedVendorIds) {
      await supabase.from("notifications").insert({
        user_id: vendorId,
        type: "vendor_alert",
        title: `${repProfile?.anonymous_id || "A Field Rep"} has shared an update`,
        body: `${alert.message?.substring(0, 200) || ""}`,
        ref_id: alert.id,
      });
    }

    // Send emails to manual vendor contacts
    let emailsSent = 0;
    let emailsFailed = 0;

    if (ENABLE_EMAIL_NOTIFICATIONS && resendApiKey && manualContactEmails.length > 0) {
      // Determine alert title based on type
      let alertTitle = "Network Alert";
      switch (alert.alert_type) {
        case "time_off_start":
          alertTitle = "Time Off Notice";
          break;
        case "emergency":
          alertTitle = "Emergency Alert";
          break;
        case "availability":
          alertTitle = "Availability Update";
          break;
        case "scheduled":
          alertTitle = "Scheduled Alert";
          break;
      }

      const htmlBody = buildExternalVendorEmail(repName, alertTitle, alert.message, appBaseUrl);
      const textBody = buildExternalVendorPlainText(repName, alertTitle, alert.message, appBaseUrl);

      // Send emails using BCC for privacy
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ClearMarket <notifications@useclearmarket.io>",
            to: ["notifications@useclearmarket.io"], // Use a placeholder for "to"
            bcc: manualContactEmails, // All recipients in BCC
            subject: `${alertTitle} from ${repName}`,
            html: htmlBody,
            text: textBody,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error("Resend API error:", errorText);
          emailsFailed = manualContactEmails.length;
        } else {
          emailsSent = manualContactEmails.length;
          console.log(`Emails sent to ${emailsSent} manual contacts via BCC`);
        }
      } catch (emailError: any) {
        console.error("Error sending emails:", emailError);
        emailsFailed = manualContactEmails.length;
      }
    } else if (manualContactEmails.length > 0) {
      console.log("Email notifications disabled or no API key, skipping manual contact emails");
    }

    return new Response(
      JSON.stringify({
        success: true,
        inAppNotifications: connectedVendorIds.length,
        emailsSent,
        emailsFailed,
        totalRecipients: connectedVendorIds.length + emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-rep-network-alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
