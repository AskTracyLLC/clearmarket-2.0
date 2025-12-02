import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"];

// Map notification types to categories for email preferences
function getEmailPreferenceField(type: string): keyof NotificationPreferences | null {
  switch (type) {
    case "new_message":
      return "email_messages";
    case "connection_request":
    case "connection_accepted":
    case "connection_declined":
      return "email_connections";
    case "review_received":
      return "email_reviews";
    case "new_coverage_opportunity":
      return "email_system"; // Match alerts use system email preference
    case "credits_event":
    case "system_update":
    case "safety_alert":
      return "email_system";
    default:
      return null;
  }
}

// Build email content based on notification type
function buildEmailContent(
  type: string,
  title: string,
  body: string | null,
  baseUrl: string
): { subject: string; htmlBody: string } {
  const subject = title;
  let htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
          .title { font-size: 24px; font-weight: bold; margin: 0 0 10px 0; }
          .body { margin: 20px 0; color: #475569; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ClearMarket</div>
        </div>
        <div class="content">
          <h2>${title}</h2>
          ${body ? `<div class="body">${body}</div>` : ""}
  `;

  // Add context-specific call to action
  switch (type) {
    case "new_message":
      htmlBody += `<a href="${baseUrl}/messages" class="button">View Messages</a>`;
      break;
    case "connection_request":
    case "connection_accepted":
    case "connection_declined":
      htmlBody += `<a href="${baseUrl}/messages" class="button">View Connections</a>`;
      break;
    case "review_received":
      htmlBody += `<a href="${baseUrl}/dashboard" class="button">View Reviews</a>`;
      break;
    case "new_coverage_opportunity":
      htmlBody += `<a href="${baseUrl}/rep/find-work" class="button">View Opportunity</a>`;
      break;
    default:
      htmlBody += `<a href="${baseUrl}/dashboard" class="button">Go to Dashboard</a>`;
  }

  htmlBody += `
        </div>
        <div class="footer">
          <p>You received this email because you have email notifications enabled for this type of activity.</p>
          <p><a href="${baseUrl}/safety-center">Manage notification preferences</a></p>
        </div>
      </body>
    </html>
  `;

  return { subject, htmlBody };
}

// Send email notification via Edge Function
async function sendEmailNotification(
  recipientEmail: string,
  type: string,
  title: string,
  body: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const baseUrl = window.location.origin;
    const { subject, htmlBody } = buildEmailContent(type, title, body, baseUrl);

    const { data, error } = await supabase.functions.invoke("send-notification-email", {
      body: {
        to: recipientEmail,
        subject,
        htmlBody,
      },
    });

    if (error) {
      console.error("Error calling send-notification-email function:", error);
      return { ok: false, error: error.message };
    }

    if (!data?.ok) {
      console.error("Email send failed:", data?.error);
      return { ok: false, error: data?.error || "Unknown error" };
    }

    return { ok: true };
  } catch (err: any) {
    console.error("Exception sending email notification:", err);
    return { ok: false, error: err.message };
  }
}

export async function getNotificationPreferences(
  supabaseClient: SupabaseClient<Database>,
  userId: string
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabaseClient
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error loading notification preferences", error);
    return null;
  }

  return data;
}

export async function createNotification(
  supabaseClient: SupabaseClient<Database>,
  userId: string,
  type: string,
  title: string,
  body: string | null,
  refId: string | null = null
) {
  // Load preferences
  const prefs = await getNotificationPreferences(supabaseClient, userId);

  // Determine if in-app notification should be sent based on preferences
  const allowInApp = (() => {
    if (!prefs) return true; // Default to sending if no preferences set

    switch (type) {
      case "new_message":
        return prefs.notify_new_message;
      case "connection_request":
        return prefs.notify_connection_request;
      case "connection_accepted":
        return prefs.notify_connection_accepted;
      case "review_received":
        return prefs.notify_review_received;
      case "new_coverage_opportunity":
        return prefs.notify_system_updates; // Match alerts use system notification preference
      case "credits_event":
        return prefs.notify_credits_events;
      case "system_update":
        return prefs.notify_system_updates;
      default:
        // Safety / critical types bypass preferences
        return true;
    }
  })();

  if (!allowInApp) {
    return { skippedByPreferences: true };
  }

  // Create in-app notification
  const { data, error } = await supabaseClient
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      body,
      ref_id: refId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    return { error: error.message };
  }

  // Attempt to send email notification if enabled in preferences
  const emailPrefField = getEmailPreferenceField(type);
  const allowEmail = emailPrefField && prefs ? (prefs[emailPrefField] as boolean) : false;

  if (allowEmail && data?.id) {
    // Fetch user email
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    if (profileData?.email) {
      console.log(`Sending email notification to ${profileData.email} for type ${type}`);
      
      // Send email asynchronously (don't block on it)
      sendEmailNotification(profileData.email, type, title, body)
        .then(async (result) => {
          if (result.ok) {
            console.log(`Email sent successfully for notification ${data.id}`);
            // Update email_sent_at timestamp
            await supabaseClient
              .from("notifications")
              .update({ email_sent_at: new Date().toISOString() })
              .eq("id", data.id);
          } else {
            console.error(`Failed to send email for notification ${data.id}:`, result.error);
          }
        })
        .catch((err) => {
          console.error(`Exception sending email for notification ${data.id}:`, err);
        });
    } else {
      console.log(`No email address found for user ${userId}, skipping email notification`);
    }
  }

  return { data };
}
