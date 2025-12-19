import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendBroadcastEmailsRequest {
  broadcastId: string;
}

interface Recipient {
  id: string;
  user_id: string;
  email: string;
  emailed_at: string | null;
}

interface Broadcast {
  id: string;
  title: string;
  email_subject: string | null;
  message_md: string;
  cta_label: string;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "ClearMarket <support@useclearmarket.io>";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") || "https://useclearmarket.io";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function buildEmailHtml(broadcast: Broadcast): string {
  const feedbackUrl = `${PUBLIC_APP_URL}/feedback/broadcast/${broadcast.id}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${broadcast.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a1a2e;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #252547; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                ClearMarket
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 22px; font-weight: 600;">
                ${broadcast.title}
              </h2>
              <p style="margin: 0 0 30px 0; color: #a0a0b8; font-size: 16px; line-height: 1.6;">
                ${broadcast.message_md.replace(/\n/g, '<br>')}
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                    <a href="${feedbackUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none;">
                      ${broadcast.cta_label}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #1e1e3a; border-top: 1px solid #3a3a5a;">
              <p style="margin: 0; color: #6b6b8a; font-size: 12px; line-height: 1.5;">
                You're receiving this email because you're a ClearMarket member.
                <br>
                <a href="${PUBLIC_APP_URL}/notifications/settings" style="color: #8b5cf6; text-decoration: underline;">
                  Update your email preferences
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

function buildEmailText(broadcast: Broadcast): string {
  const feedbackUrl = `${PUBLIC_APP_URL}/feedback/broadcast/${broadcast.id}`;
  
  return `
${broadcast.title}

${broadcast.message_md}

${broadcast.cta_label}: ${feedbackUrl}

---
You're receiving this email because you're a ClearMarket member.
Update your email preferences: ${PUBLIC_APP_URL}/notifications/settings
  `.trim();
}

async function sendBatchEmails(
  emails: Array<{ from: string; to: string; subject: string; html: string; text: string }>,
  idempotencyKey: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(emails),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Resend batch error:", data);
      return { success: false, error: data.message || "Failed to send batch emails" };
    }

    return { success: true, data };
  } catch (error: unknown) {
    console.error("Resend batch exception:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller is admin
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { broadcastId }: SendBroadcastEmailsRequest = await req.json();
    
    if (!broadcastId) {
      return new Response(
        JSON.stringify({ error: "broadcastId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing broadcast emails for: ${broadcastId}`);

    // Fetch broadcast details
    const { data: broadcast, error: broadcastError } = await supabase
      .from("admin_broadcasts")
      .select("id, title, email_subject, message_md, cta_label")
      .eq("id", broadcastId)
      .single();

    if (broadcastError || !broadcast) {
      return new Response(
        JSON.stringify({ error: "Broadcast not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recipients who haven't been emailed yet and have opted in
    const { data: recipients, error: recipientsError } = await supabase
      .from("admin_broadcast_recipients")
      .select(`
        id,
        user_id,
        emailed_at,
        profiles!inner (
          email,
          email_opt_in_admin_updates
        )
      `)
      .eq("broadcast_id", broadcastId)
      .is("emailed_at", null);

    if (recipientsError) {
      console.error("Error fetching recipients:", recipientsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch recipients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to only opted-in users with valid emails
    const eligibleRecipients = (recipients || []).filter((r: any) => {
      const profile = r.profiles;
      return profile?.email && 
             profile?.email.trim() !== "" && 
             profile?.email_opt_in_admin_updates !== false;
    });

    console.log(`Found ${eligibleRecipients.length} eligible recipients out of ${recipients?.length || 0} total`);

    if (eligibleRecipients.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          sent: 0, 
          failed: 0, 
          skipped: recipients?.length || 0,
          message: "No eligible recipients to email" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email content
    const subject = broadcast.email_subject || broadcast.title;
    const html = buildEmailHtml(broadcast as Broadcast);
    const text = buildEmailText(broadcast as Broadcast);

    // Process in batches of 100
    const BATCH_SIZE = 100;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < eligibleRecipients.length; i += BATCH_SIZE) {
      const batch = eligibleRecipients.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`Processing batch ${batchNumber} with ${batch.length} recipients`);

      // Prepare email payloads
      const emailPayloads = batch.map((r: any) => ({
        from: RESEND_FROM,
        to: r.profiles.email,
        subject,
        html,
        text,
      }));

      // Send batch with idempotency key
      const idempotencyKey = `broadcast-${broadcastId}-batch-${batchNumber}`;
      const result = await sendBatchEmails(emailPayloads, idempotencyKey);

      if (result.success && result.data?.data) {
        // Update successful recipients
        const successfulIds = result.data.data
          .filter((r: any) => r.id)
          .map((r: any, idx: number) => ({
            recipientId: batch[idx].id,
            emailProviderId: r.id,
          }));

        for (const { recipientId, emailProviderId } of successfulIds) {
          await supabase
            .from("admin_broadcast_recipients")
            .update({
              emailed_at: new Date().toISOString(),
              email_provider_id: emailProviderId,
              email_error: null,
            })
            .eq("id", recipientId);
          
          totalSent++;
        }
      } else {
        // Mark all in batch as failed
        for (const r of batch) {
          await supabase
            .from("admin_broadcast_recipients")
            .update({
              email_error: result.error || "Unknown error",
            })
            .eq("id", r.id);
          
          totalFailed++;
        }
      }
    }

    console.log(`Email sending complete: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        failed: totalFailed,
        skipped: (recipients?.length || 0) - eligibleRecipients.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-admin-broadcast-emails:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
