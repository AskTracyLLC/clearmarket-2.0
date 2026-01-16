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

interface CoverageArea {
  state_name: string;
  state_code: string;
  county_name: string | null;
}

// Group coverage areas by state for display
function groupCoverageByState(areas: CoverageArea[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  
  for (const area of areas) {
    const stateKey = area.state_name || area.state_code;
    if (!grouped.has(stateKey)) {
      grouped.set(stateKey, []);
    }
    if (area.county_name) {
      grouped.get(stateKey)!.push(area.county_name);
    }
  }
  
  return grouped;
}

// Format a YYYY-MM-DD date as "MMMM Do, YYYY" (e.g., "December 12th, 2025")
function formatRouteDate(dateStr: string): string {
  try {
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return dateStr;

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const getOrdinal = (n: number) => {
      const rem10 = n % 10;
      const rem100 = n % 100;
      if (rem10 === 1 && rem100 !== 11) return `${n}st`;
      if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
      if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
      return `${n}th`;
    };

    return `${monthNames[month - 1]} ${getOrdinal(day)}, ${year}`;
  } catch {
    return dateStr;
  }
}

// Format a YYYY-MM-DD date as "DOW - MM/DD/YY" (e.g., "Fri - 01/16/26")
function formatRouteDateShortWithDow(dateStr: string): string {
  try {
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return dateStr;

    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dow = dowNames[dayOfWeek];

    // Format as MM/DD/YY with leading zeros
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const yy = String(year).slice(-2);

    return `${dow} - ${mm}/${dd}/${yy}`;
  } catch {
    return dateStr;
  }
}

// US state name to 2-letter code mapping
const STATE_NAME_TO_CODE: Record<string, string> = {
  "alabama": "AL",
  "alaska": "AK",
  "arizona": "AZ",
  "arkansas": "AR",
  "california": "CA",
  "colorado": "CO",
  "connecticut": "CT",
  "delaware": "DE",
  "florida": "FL",
  "georgia": "GA",
  "hawaii": "HI",
  "idaho": "ID",
  "illinois": "IL",
  "indiana": "IN",
  "iowa": "IA",
  "kansas": "KS",
  "kentucky": "KY",
  "louisiana": "LA",
  "maine": "ME",
  "maryland": "MD",
  "massachusetts": "MA",
  "michigan": "MI",
  "minnesota": "MN",
  "mississippi": "MS",
  "missouri": "MO",
  "montana": "MT",
  "nebraska": "NE",
  "nevada": "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  "ohio": "OH",
  "oklahoma": "OK",
  "oregon": "OR",
  "pennsylvania": "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  "tennessee": "TN",
  "texas": "TX",
  "utah": "UT",
  "vermont": "VT",
  "virginia": "VA",
  "washington": "WA",
  "west virginia": "WV",
  "wisconsin": "WI",
  "wyoming": "WY",
  "district of columbia": "DC",
};

// Convert state name or code to 2-letter code
function toStateCode(input: string): string {
  const trimmed = input.trim();
  // If already a 2-letter uppercase code, return as-is
  if (/^[A-Z]{2}$/.test(trimmed)) {
    return trimmed;
  }
  // Look up the state name (case-insensitive)
  const code = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
  return code || trimmed;
}

// Parse route_state into an array of 2-letter state codes
function parseStateCodes(routeState: unknown): string[] {
  let rawValues: string[] = [];

  if (Array.isArray(routeState)) {
    rawValues = routeState.map(v => String(v).trim()).filter(Boolean);
  } else if (typeof routeState === "string") {
    // Handle comma-separated string
    rawValues = routeState.split(",").map(v => v.trim()).filter(Boolean);
  }

  // Convert each to 2-letter code and dedupe
  const codes = rawValues.map(toStateCode);
  return [...new Set(codes)];
}

// Render coverage snapshot HTML section
function renderCoverageSnapshotHtml(repName: string, areas: CoverageArea[]): string {
  if (areas.length === 0) {
    return "";
  }

  const grouped = groupCoverageByState(areas);
  
  let coverageListHtml = "";
  for (const [stateName, counties] of grouped) {
    if (counties.length === 0) {
      // No specific counties = statewide
      coverageListHtml += `<li style="margin-bottom: 6px; color: ${BRAND_COLORS.text};">${stateName} — <em>Statewide</em></li>`;
    } else {
      coverageListHtml += `<li style="margin-bottom: 6px; color: ${BRAND_COLORS.text};">${stateName} — ${counties.join(", ")}</li>`;
    }
  }

  return `
    <!-- Coverage Snapshot -->
    <tr>
      <td style="background-color: ${BRAND_COLORS.background}; padding: 24px 40px; border: 1px solid ${BRAND_COLORS.border}; border-top: none;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.primary};">
          Coverage Snapshot with ${repName}
        </p>
        <p style="margin: 0 0 12px 0; font-size: 13px; color: ${BRAND_COLORS.textMuted};">
          These are the areas this rep currently covers for your company:
        </p>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
          ${coverageListHtml}
        </ul>
      </td>
    </tr>
  `;
}

// Render coverage snapshot plain text section
function renderCoverageSnapshotPlainText(repName: string, areas: CoverageArea[]): string {
  if (areas.length === 0) {
    return "";
  }

  const grouped = groupCoverageByState(areas);
  
  let lines: string[] = [];
  lines.push(`\n---\n`);
  lines.push(`Coverage Snapshot with ${repName}`);
  lines.push(`These are the areas this rep currently covers for your company:\n`);
  
  for (const [stateName, counties] of grouped) {
    if (counties.length === 0) {
      lines.push(`• ${stateName} — Statewide`);
    } else {
      lines.push(`• ${stateName} — ${counties.join(", ")}`);
    }
  }

  return lines.join("\n");
}

// Build ClearMarket branded HTML email for external vendors (no coverage snapshot for off-platform)
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
              <hr style="border: none; border-top: 1px solid ${BRAND_COLORS.border}; margin: 0 0 24px 0;" />
              <p style="margin: 0 0 16px 0; font-size: 15px; color: ${BRAND_COLORS.text}; line-height: 1.5;">
                Want easier access to reliable field reps? Join us on ClearMarket to view coverage, post requests, and grow your vendor network.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background-color: ${BRAND_COLORS.primary}; border-radius: 8px;">
                    <a href="${appBaseUrl}/signup?role=vendor" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Create your free vendor profile
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0 0; font-size: 13px; color: ${BRAND_COLORS.textMuted};">
                <a href="${appBaseUrl}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">useclearmarket.io</a>
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

// Build ClearMarket branded HTML email for ClearMarket vendors (with coverage snapshot)
function buildClearMarketVendorEmail(
  repName: string,
  alertTitle: string,
  alertBody: string,
  appBaseUrl: string,
  coverageAreas: CoverageArea[]
): string {
  const coverageSnapshotHtml = renderCoverageSnapshotHtml(repName, coverageAreas);

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
          
          ${coverageSnapshotHtml}
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND_COLORS.background}; padding: 24px 40px; border: 1px solid ${BRAND_COLORS.border}; border-top: ${coverageSnapshotHtml ? "none" : "1px solid " + BRAND_COLORS.border}; border-radius: 0 0 12px 12px;">
              <hr style="border: none; border-top: 1px solid ${BRAND_COLORS.border}; margin: 0 0 16px 0;" />
              <p style="margin: 0; font-size: 13px; color: ${BRAND_COLORS.textMuted};">
                View and manage your network at <a href="${appBaseUrl}/dashboard" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">useclearmarket.io</a>
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

Want easier access to reliable field reps? Join us on ClearMarket to view coverage, post requests, and grow your vendor network.

Create your free vendor profile at ${appBaseUrl}/signup?role=vendor
  `.trim();
}

// Build plain text version for ClearMarket vendors (with coverage snapshot)
function buildClearMarketVendorPlainText(
  repName: string,
  alertTitle: string,
  alertBody: string,
  appBaseUrl: string,
  coverageAreas: CoverageArea[]
): string {
  const coverageSnapshotText = renderCoverageSnapshotPlainText(repName, coverageAreas);

  return `
From: ${repName} via ClearMarket

${alertTitle}
${'='.repeat(alertTitle.length)}

${alertBody}
${coverageSnapshotText}

---

View and manage your network at ${appBaseUrl}/dashboard
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
      .select("id, anonymous_id, business_name")
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

    // Get manual vendor contacts (off-platform) - exclude converted ones
    const { data: manualContacts } = await supabase
      .from("rep_vendor_contacts")
      .select("id, email, contact_name, company_name")
      .eq("rep_user_id", repUserId)
      .eq("is_active", true)
      .eq("is_converted_to_vendor", false);

    const manualContactEmails = manualContacts?.map(c => c.email) || [];

    console.log(`Processing alert: ${connectedVendorIds.length} ClearMarket vendors, ${manualContactEmails.length} manual contacts`);

    // Prepare alert message with placeholder substitution for planned routes
    let alertMessage: string = alert.message || "";
    if (
      alert.alert_type === "planned_route" &&
      alert.route_date &&
      alert.route_state &&
      Array.isArray(alert.route_counties) &&
      alert.route_counties.length > 0
    ) {
      const formattedDate = formatRouteDate(alert.route_date as string);
      const countiesList = (alert.route_counties as string[]).join(", ");
      alertMessage = alertMessage
        .replace(/\{DATE\}/g, formattedDate)
        .replace(/\{STATE\}/g, alert.route_state as string)
        .replace(/\{COUNTIES\}/g, countiesList);
    }

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
      case "planned_route":
        if (alert.route_date) {
          const shortDate = formatRouteDateShortWithDow(alert.route_date as string);
          const stateCodes = parseStateCodes(alert.route_state);
          if (stateCodes.length > 0) {
            alertTitle = `${repName} (${stateCodes.join(", ")}) Route Update for ${shortDate}`;
          } else {
            alertTitle = `${repName} Route Update for ${shortDate}`;
          }
        } else {
          alertTitle = `${repName} Route Update`;
        }
        break;
    }

    const emailSubject = alert.alert_type === "planned_route"
      ? alertTitle
      : `${alertTitle} from ${repName}`;

    // Create in-app notifications for ClearMarket vendors
    for (const vendorId of connectedVendorIds) {
      await supabase.from("notifications").insert({
        user_id: vendorId,
        type: "vendor_alert",
        title: `${repProfile?.anonymous_id || "A Field Rep"} has shared an update`,
        body: `${alertMessage.substring(0, 200) || ""}`,
        ref_id: alert.id,
      });
    }

    // Send personalized emails to ClearMarket vendors with coverage snapshots
    let emailsSent = 0;
    let emailsFailed = 0;

    if (ENABLE_EMAIL_NOTIFICATIONS && resendApiKey && connectedVendorIds.length > 0) {
      // Get vendor emails
      const { data: vendorProfiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", connectedVendorIds);

      for (const vendor of vendorProfiles || []) {
        // Get coverage for this specific rep↔vendor relationship
        const { data: coverageData } = await supabase
          .from("territory_assignments")
          .select("state_name, state_code, county_name")
          .eq("rep_id", repUserId)
          .eq("vendor_id", vendor.id)
          .eq("status", "active");

        const coverageAreas: CoverageArea[] = coverageData || [];

        const htmlBody = buildClearMarketVendorEmail(repName, alertTitle, alertMessage, appBaseUrl, coverageAreas);
        const textBody = buildClearMarketVendorPlainText(repName, alertTitle, alertMessage, appBaseUrl, coverageAreas);

        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "ClearMarket <notifications@useclearmarket.io>",
              to: [vendor.email],
              subject: emailSubject,
              html: htmlBody,
              text: textBody,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error(`Resend API error for vendor ${vendor.id}:`, errorText);
            emailsFailed++;
          } else {
            emailsSent++;
            console.log(`Email sent to ClearMarket vendor ${vendor.id} with ${coverageAreas.length} coverage areas`);
          }
        } catch (emailError: any) {
          console.error(`Error sending email to vendor ${vendor.id}:`, emailError);
          emailsFailed++;
        }
      }
    }

    // Send emails to manual vendor contacts (no coverage snapshot - they're off-platform)
    if (ENABLE_EMAIL_NOTIFICATIONS && resendApiKey && manualContactEmails.length > 0) {
      const htmlBody = buildExternalVendorEmail(repName, alertTitle, alertMessage, appBaseUrl);
      const textBody = buildExternalVendorPlainText(repName, alertTitle, alertMessage, appBaseUrl);

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
            subject: emailSubject,
            html: htmlBody,
            text: textBody,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error("Resend API error for manual contacts:", errorText);
          emailsFailed += manualContactEmails.length;
        } else {
          emailsSent += manualContactEmails.length;
          console.log(`Emails sent to ${manualContactEmails.length} manual contacts via BCC`);
        }
      } catch (emailError: any) {
        console.error("Error sending emails to manual contacts:", emailError);
        emailsFailed += manualContactEmails.length;
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
        totalRecipients: connectedVendorIds.length + manualContactEmails.length,
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
