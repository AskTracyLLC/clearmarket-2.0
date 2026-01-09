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
  alertId?: string;
  processScheduled?: boolean;
}

// Build ClearMarket branded HTML email for staff
function buildStaffNotificationEmail(
  vendorName: string,
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
              <p style="margin: 8px 0 0 0; font-size: 14px; color: ${BRAND_COLORS.textMuted};">
                Notification for ${vendorName}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.surface}; padding: 40px; border-left: 1px solid ${BRAND_COLORS.border}; border-right: 1px solid ${BRAND_COLORS.border};">
              
              <!-- From line -->
              <p style="margin: 0 0 8px 0; font-size: 14px; color: ${BRAND_COLORS.textMuted};">
                From: <strong style="color: ${BRAND_COLORS.text};">${repName}</strong>
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
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.background}; padding: 24px 40px; border: 1px solid ${BRAND_COLORS.border}; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 13px; color: ${BRAND_COLORS.textMuted};">
                This notification was sent via <a href="${appBaseUrl}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">ClearMarket</a>
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

// Get staff emails that should receive notifications for a specific state
async function getStaffRecipientsForAlert(
  supabase: any,
  vendorProfileId: string,
  stateCode: string | null,
  alertType: "network_alert" | "direct_message"
): Promise<string[]> {
  // Get all active staff for this vendor
  const { data: staffEmails, error } = await supabase
    .from("vendor_staff_emails")
    .select(`
      id,
      email,
      receive_network_alerts,
      receive_direct_messages,
      applies_to_all_states
    `)
    .eq("vendor_profile_id", vendorProfileId)
    .eq("is_active", true);

  if (error || !staffEmails || staffEmails.length === 0) {
    return [];
  }

  // Filter by notification type preference
  const typeFiltered = staffEmails.filter((staff: any) => {
    if (alertType === "network_alert") return staff.receive_network_alerts;
    if (alertType === "direct_message") return staff.receive_direct_messages;
    return false;
  });

  if (typeFiltered.length === 0) return [];

  // If no state specified (non-state-specific notification), include all matching staff
  if (!stateCode) {
    return typeFiltered.map((s: any) => s.email);
  }

  // Filter by state coverage
  const result: string[] = [];
  
  for (const staff of typeFiltered) {
    if (staff.applies_to_all_states) {
      // Staff handles all states
      result.push(staff.email);
    } else {
      // Check if staff has specific coverage for this state
      const { data: stateCoverage } = await supabase
        .from("vendor_staff_state_coverage")
        .select("state_code")
        .eq("vendor_staff_email_id", staff.id)
        .eq("state_code", stateCode)
        .maybeSingle();

      if (stateCoverage) {
        result.push(staff.email);
      }
    }
  }

  return result;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || supabaseUrl.replace(/\.supabase\.co$/, ".lovable.app");

    const body: SendAlertRequest = await req.json().catch(() => ({}));
    const { alertId, processScheduled } = body;

    console.log("send-vendor-network-alerts called:", { alertId, processScheduled });

    let alertsToProcess: any[] = [];

    if (alertId) {
      // Send a specific alert immediately
      const { data: alert, error } = await supabase
        .from("rep_network_alerts")
        .select("*")
        .eq("id", alertId)
        .single();

      if (error || !alert) {
        console.error("Alert not found:", alertId, error);
        return new Response(
          JSON.stringify({ error: "Alert not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (alert.status === "sent") {
        return new Response(
          JSON.stringify({ error: "Alert already sent" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      alertsToProcess = [alert];
    } else if (processScheduled) {
      // Process all scheduled alerts that are due
      const { data: dueAlerts, error } = await supabase
        .from("rep_network_alerts")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_at", new Date().toISOString());

      if (error) {
        console.error("Error fetching scheduled alerts:", error);
        throw error;
      }

      alertsToProcess = dueAlerts || [];
      console.log(`Found ${alertsToProcess.length} scheduled alerts to process`);
    } else {
      return new Response(
        JSON.stringify({ error: "Must provide alertId or processScheduled=true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const alert of alertsToProcess) {
      try {
        // Mark as sending
        await supabase
          .from("rep_network_alerts")
          .update({ status: "sending" })
          .eq("id", alert.id);

        // Get vendor info for notification title
        const { data: vendorProfile } = await supabase
          .from("vendor_profile")
          .select("id, company_name, anonymous_id")
          .eq("user_id", alert.vendor_id)
          .single();

        const vendorName = vendorProfile?.company_name || vendorProfile?.anonymous_id || "A Vendor";

        // Get rep info
        const { data: repProfile } = await supabase
          .from("rep_profile")
          .select("anonymous_id, business_name")
          .eq("user_id", alert.vendor_id)
          .single();

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", alert.vendor_id)
          .single();

        const repName = repProfile?.business_name || profile?.full_name || repProfile?.anonymous_id || "A Field Rep";

        // Get connected reps
        const { data: connections, error: connectionsError } = await supabase
          .from("vendor_connections")
          .select("field_rep_id")
          .eq("vendor_id", alert.vendor_id)
          .eq("status", "connected");

        if (connectionsError) throw connectionsError;

        let repIds = connections?.map(c => c.field_rep_id) || [];

        // Determine state code for state-specific routing
        let alertStateCode: string | null = null;
        if (alert.target_scope === "by_state" && alert.target_state_codes?.length > 0) {
          // Get rep coverage areas for these states
          const { data: coverageAreas } = await supabase
            .from("rep_coverage_areas")
            .select("user_id, state_code")
            .in("user_id", repIds)
            .in("state_code", alert.target_state_codes);

          const repsInStates = new Set(coverageAreas?.map(c => c.user_id) || []);
          repIds = repIds.filter(id => repsInStates.has(id));

          // Use first state code for staff routing
          alertStateCode = alert.target_state_codes[0] || null;
        }

        console.log(`Alert ${alert.id}: sending to ${repIds.length} connected reps`);

        // Create in-app notifications for each connected rep
        for (const repId of repIds) {
          await supabase.from("notifications").insert({
            user_id: repId,
            type: "vendor_network_alert",
            title: `Network alert from ${vendorName}`,
            body: `${alert.title}: ${alert.body.substring(0, 150)}${alert.body.length > 150 ? '...' : ''}`,
            ref_id: alert.id,
          });
        }

        // Get emails from connected reps for deduplication
        const connectedEmails = new Set<string>();
        if (repIds.length > 0) {
          const { data: repProfiles } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", repIds);
          
          repProfiles?.forEach(p => {
            if (p.email) connectedEmails.add(p.email.toLowerCase().trim());
          });
        }

        // Get active offline rep contacts for this vendor
        const { data: offlineContacts } = await supabase
          .from("vendor_offline_rep_contacts")
          .select("id, rep_name, email, phone")
          .eq("vendor_id", alert.vendor_id)
          .eq("status", "active");

        // Filter offline contacts: must have email, not duplicate
        const offlineEmails: string[] = [];
        offlineContacts?.forEach(c => {
          if (c.email && c.email.trim() !== "") {
            const emailNorm = c.email.toLowerCase().trim();
            if (!connectedEmails.has(emailNorm)) {
              offlineEmails.push(c.email);
              connectedEmails.add(emailNorm); // prevent duplicates within offline list too
            }
          }
        });

        console.log(`Alert ${alert.id}: ${offlineEmails.length} offline contacts to email`);

        // Send email to offline contacts
        let offlineEmailsSent = 0;
        if (offlineEmails.length > 0 && ENABLE_EMAIL_NOTIFICATIONS && resendApiKey) {
          const htmlBody = buildStaffNotificationEmail(
            vendorName,
            vendorName, // From vendor
            alert.title,
            alert.body,
            appBaseUrl
          );

          try {
            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "ClearMarket <notifications@useclearmarket.io>",
                to: ["notifications@useclearmarket.io"],
                bcc: offlineEmails,
                subject: `${alert.title} - Network Alert from ${vendorName}`,
                html: htmlBody,
              }),
            });

            if (emailResponse.ok) {
              offlineEmailsSent = offlineEmails.length;
              console.log(`Offline emails sent successfully for alert ${alert.id}`);
            } else {
              const errText = await emailResponse.text();
              console.error(`Resend API error for offline emails:`, errText);
            }
          } catch (emailErr: any) {
            console.error(`Error sending offline emails:`, emailErr);
          }
        }

        // Get staff email recipients for this vendor
        let staffEmailsSent = 0;
        if (vendorProfile?.id && ENABLE_EMAIL_NOTIFICATIONS && resendApiKey) {
          const staffEmails = await getStaffRecipientsForAlert(
            supabase,
            vendorProfile.id,
            alertStateCode,
            "network_alert"
          );

          if (staffEmails.length > 0) {
            console.log(`Sending email to ${staffEmails.length} staff recipients for alert ${alert.id}`);

            const htmlBody = buildStaffNotificationEmail(
              vendorName,
              repName,
              alert.title,
              alert.body,
              appBaseUrl
            );

            try {
              const emailResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "ClearMarket <notifications@useclearmarket.io>",
                  to: ["notifications@useclearmarket.io"],
                  bcc: staffEmails,
                  subject: `${alert.title} - Network Alert`,
                  html: htmlBody,
                }),
              });

              if (emailResponse.ok) {
                staffEmailsSent = staffEmails.length;
                console.log(`Staff emails sent successfully for alert ${alert.id}`);
              } else {
                const errText = await emailResponse.text();
                console.error(`Resend API error for alert ${alert.id}:`, errText);
              }
            } catch (emailErr: any) {
              console.error(`Error sending staff emails for alert ${alert.id}:`, emailErr);
            }
          }
        }

        // Mark as sent
        const totalRecipients = repIds.length + offlineEmailsSent;
        await supabase
          .from("rep_network_alerts")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            recipient_count: totalRecipients,
          })
          .eq("id", alert.id);

        results.push({ 
          alertId: alert.id, 
          status: "sent", 
          recipientCount: totalRecipients,
          connectedReps: repIds.length,
          offlineEmailsSent,
          staffEmailsSent 
        });
        console.log(`Alert ${alert.id} sent to ${repIds.length} connected reps, ${offlineEmailsSent} offline, ${staffEmailsSent} staff emails`);

      } catch (alertError: any) {
        console.error(`Error processing alert ${alert.id}:`, alertError);
        
        // Mark as failed
        await supabase
          .from("rep_network_alerts")
          .update({
            status: "failed",
            error_message: alertError.message || "Unknown error",
          })
          .eq("id", alert.id);

        results.push({ alertId: alert.id, status: "failed", error: alertError.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-vendor-network-alerts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
