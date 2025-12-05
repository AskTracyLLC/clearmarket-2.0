import { supabase } from "@/integrations/supabase/client";

/**
 * Build welcome email HTML using ClearMarket 2.0 color scheme
 * 
 * COLOR SCHEME CHANGE: Using project's primary orange (#f97316) instead of blue
 * BULLET CHANGE: First "What's Next?" bullet updated to coverage areas text
 */
function buildWelcomeEmailHTML(
  anonymousId: string,
  role: "rep" | "vendor",
  baseUrl: string
): string {
  const roleLabel = role === "rep" ? "Field Rep" : "Vendor";
  const dashboardUrl = `${baseUrl}/dashboard`;
  const profileUrl = role === "rep" ? `${baseUrl}/rep/profile` : `${baseUrl}/vendor/profile`;
  
  // ClearMarket 2.0 colors (from index.css) - converted from HSL
  // Primary: hsl(25 95% 53%) = #f97316 (orange)
  // Background: hsl(220 13% 9%) = #14161a (dark charcoal)
  // Card: hsl(220 13% 12%) = #1a1d23
  // Foreground: hsl(0 0% 95%) = #f2f2f2
  // Muted foreground: hsl(0 0% 60%) = #999999
  // Border: hsl(220 13% 20%) = #2d3139
  
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ClearMarket</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #14161a;
        color: #f2f2f2;
      }
      .wrapper {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      /* COLOR CHANGE: Using project's primary orange instead of blue */
      .header {
        background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
        color: #ffffff;
        padding: 40px 30px;
        text-align: center;
        border-radius: 12px 12px 0 0;
      }
      .header h1 {
        font-size: 28px;
        font-weight: bold;
        margin: 0 0 8px 0;
      }
      .header .subheading {
        font-size: 16px;
        opacity: 0.95;
        margin: 0;
      }
      .content {
        background: #1a1d23;
        padding: 30px;
        border: 1px solid #2d3139;
        border-top: none;
        border-radius: 0 0 12px 12px;
      }
      .thank-you {
        font-size: 18px;
        color: #f2f2f2;
        margin-bottom: 24px;
      }
      .section-title {
        font-size: 20px;
        font-weight: 600;
        color: #f2f2f2;
        margin: 24px 0 16px 0;
      }
      .bullet-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .bullet-list li {
        position: relative;
        padding-left: 24px;
        margin-bottom: 12px;
        color: #999999;
      }
      .bullet-list li::before {
        content: "•";
        position: absolute;
        left: 0;
        color: #f97316;
        font-weight: bold;
      }
      /* COLOR CHANGE: CTA button uses project's primary orange */
      .cta-button {
        display: inline-block;
        background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
        color: #ffffff !important;
        padding: 14px 28px;
        text-decoration: none;
        border-radius: 8px;
        margin: 24px 0;
        font-weight: 600;
        font-size: 16px;
      }
      .cta-button:hover {
        opacity: 0.9;
      }
      .footer {
        text-align: center;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #2d3139;
        color: #999999;
        font-size: 14px;
      }
      .footer a {
        color: #f97316;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="header">
        <h1>Welcome to ClearMarket!</h1>
        <p class="subheading">You're ${anonymousId} in our community</p>
      </div>
      <div class="content">
        <p class="thank-you">Thank you for joining as a ${roleLabel}!</p>
        
        <p style="color: #999999; margin-bottom: 20px;">
          We're excited to have you as part of the ClearMarket network. You're joining a community of professionals 
          dedicated to transparent, reputation-based connections in the field inspection industry.
        </p>
        
        <h2 class="section-title">What's Next?</h2>
        <ul class="bullet-list">
          <!-- BULLET CHANGE: Updated first bullet to coverage areas text -->
          <li>Complete your coverage areas to be among the first to be matched for work when we onboard Vendors.</li>
          <li>Get early access to new features and platform improvements as we grow.</li>
          <li>${role === "rep" 
            ? "Connect with verified vendors looking for reliable field reps in your area." 
            : "Connect with experienced field reps ready to take on work in your coverage areas."}</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${profileUrl}" class="cta-button">Complete Your Profile</a>
        </div>
        
        <p style="color: #999999; font-size: 14px; margin-top: 24px;">
          Have questions? Visit our <a href="${baseUrl}/help" style="color: #f97316;">Help Center</a> or 
          reach out to <a href="mailto:support@useclearmarket.io" style="color: #f97316;">support@useclearmarket.io</a>
        </p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} ClearMarket. All rights reserved.</p>
        <p>
          <a href="${dashboardUrl}">Go to Dashboard</a>
        </p>
      </div>
    </div>
  </body>
</html>
`;
}

/**
 * Send welcome email to newly registered user
 * Called after role selection is complete
 */
export async function sendWelcomeEmail(
  userEmail: string,
  anonymousId: string,
  role: "rep" | "vendor"
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  try {
    const baseUrl = window.location.origin;
    const subject = `🎉 Welcome to ClearMarket, ${anonymousId}!`;
    const htmlBody = buildWelcomeEmailHTML(anonymousId, role, baseUrl);

    console.log(`Sending welcome email to ${userEmail} for role ${role}`);

    const { data, error } = await supabase.functions.invoke("send-notification-email", {
      body: {
        to: userEmail,
        subject,
        htmlBody,
      },
    });

    if (error) {
      console.error("Error calling send-notification-email function:", error);
      return { ok: false, error: error.message };
    }

    if (data?.skipped) {
      console.log("Welcome email skipped (emails disabled):", data.reason);
      return { ok: true, skipped: true };
    }

    if (!data?.ok) {
      console.error("Welcome email send failed:", data?.error);
      return { ok: false, error: data?.error || "Unknown error" };
    }

    console.log("Welcome email sent successfully");
    return { ok: true };
  } catch (err: any) {
    console.error("Exception sending welcome email:", err);
    return { ok: false, error: err.message };
  }
}
