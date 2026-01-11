import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NudgeRequest {
  queueItemId: string;
  recipientEmail: string;
  recipientName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is staff
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if user is staff
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("is_admin, is_support, is_moderator")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin && !profile?.is_support && !profile?.is_moderator) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { queueItemId, recipientEmail, recipientName }: NudgeRequest = await req.json();

    if (!queueItemId || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://useclearmarket.io";

    // Send the email using Resend REST API
    const vendorName = recipientName || "there";
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f10; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1a1a1b; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px; background-color: #262627; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">ClearMarket</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 24px;">
                    <p style="margin: 0 0 16px; color: #e5e5e5; font-size: 15px; line-height: 1.6;">
                      Hi ${vendorName},
                    </p>
                    <p style="margin: 0 0 24px; color: #e5e5e5; font-size: 15px; line-height: 1.6;">
                      You have a message waiting in ClearMarket regarding your Vendor Verification request.
                    </p>
                    <p style="margin: 0 0 24px; color: #e5e5e5; font-size: 15px; line-height: 1.6;">
                      Please log in to review and respond: <a href="${appBaseUrl}/signin" style="color: #3b82f6; text-decoration: underline;">${appBaseUrl}/signin</a>
                    </p>
                    <p style="margin: 24px 0 0; color: #e5e5e5; font-size: 15px; line-height: 1.6;">
                      Thanks,<br>ClearMarket (noreply)
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 24px; background-color: #262627; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">
                      This is an automated notification. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClearMarket <noreply@useclearmarket.io>",
        to: [recipientEmail],
        subject: "Action needed: Vendor Verification message waiting in ClearMarket",
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend error:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("Nudge email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, emailId: emailData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-vendor-verification-nudge:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
