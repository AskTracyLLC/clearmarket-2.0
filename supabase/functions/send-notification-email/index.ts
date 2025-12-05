import { serve } from "https://deno.land/std@0.190.0/http/server.ts";


const resend = Deno.env.get("RESEND_API_KEY");
const ENABLE_EMAIL_NOTIFICATIONS = Deno.env.get("ENABLE_EMAIL_NOTIFICATIONS") === "true";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, htmlBody, textBody }: NotificationEmailRequest = await req.json();

    console.log(`Email notification request for ${to}: ${subject}`);

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
        "Authorization": `Bearer ${resend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClearMarket <notifications@useclearmarket.io>",
        to: [to],
        subject,
        html: htmlBody,
        text: textBody || htmlBody.replace(/<[^>]*>/g, ""), // Strip HTML tags as fallback
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
