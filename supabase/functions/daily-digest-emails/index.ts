import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const enableEmailNotifications = Deno.env.get("ENABLE_EMAIL_NOTIFICATIONS") === "true";
const appBaseUrl = Deno.env.get("APP_BASE_URL") || supabaseUrl.replace(/\.supabase\.co$/, ".lovable.app");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface NotificationPreferences {
  digest_messages: boolean;
  digest_connections: boolean;
  digest_reviews: boolean;
  digest_system: boolean;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  message: "Messages",
  connection: "Connections",
  review: "Reviews",
  system: "System & Safety",
};

function buildDigestHTML(notificationsByType: Record<string, Notification[]>): string {
  let sectionsHTML = "";
  
  for (const [type, notifications] of Object.entries(notificationsByType)) {
    if (notifications.length === 0) continue;
    
    const label = categoryLabels[type] || type;
    sectionsHTML += `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin-bottom: 12px;">
          ${label} (${notifications.length})
        </h2>
        ${notifications.map(n => `
          <div style="background: #f8f9fa; border-left: 3px solid #3b82f6; padding: 12px; margin-bottom: 8px; border-radius: 4px;">
            <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${n.title}</div>
            ${n.body ? `<div style="color: #6b7280; font-size: 14px;">${n.body}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #ffffff; border-radius: 8px; padding: 32px;">
          <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; margin-bottom: 8px;">
            Your ClearMarket daily summary
          </h1>
          <p style="color: #6b7280; margin-bottom: 24px;">
            Here's what happened in the last 24 hours:
          </p>
          
          ${sectionsHTML}
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <a href="${appBaseUrl}/notifications" 
               style="display: inline-block; background: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              View All Notifications
            </a>
          </div>
          
          <div style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
            <p>You're receiving this because you enabled daily digest notifications.</p>
            <p>
              <a href="${appBaseUrl}/notifications/settings" style="color: #3b82f6; text-decoration: none;">
                Manage your notification preferences
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildDigestText(notificationsByType: Record<string, Notification[]>): string {
  let text = "Your ClearMarket daily summary\n\n";
  text += "Here's what happened in the last 24 hours:\n\n";
  
  for (const [type, notifications] of Object.entries(notificationsByType)) {
    if (notifications.length === 0) continue;
    
    const label = categoryLabels[type] || type;
    text += `${label} (${notifications.length}):\n`;
    text += notifications.map(n => `  • ${n.title}${n.body ? ': ' + n.body : ''}`).join('\n');
    text += '\n\n';
  }
  
  text += `View all notifications: ${appBaseUrl}/notifications\n\n`;
  text += "You're receiving this because you enabled daily digest notifications.\n";
  text += `Manage preferences: ${appBaseUrl}/notifications/settings`;
  
  return text;
}

serve(async (req) => {
  try {
    console.log("Starting daily digest job...");

    if (!enableEmailNotifications) {
      console.log("Email notifications are disabled (ENABLE_EMAIL_NOTIFICATIONS=false). Skipping digest.");
      return new Response(JSON.stringify({ message: "Email notifications disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Define 24-hour window
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

    console.log(`Digest window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

    // Fetch users with digest preferences enabled
    const { data: usersWithDigest, error: usersError } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        notification_preferences:notification_preferences(
          digest_messages,
          digest_connections,
          digest_reviews,
          digest_system
        )
      `)
      .not("email", "is", null);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`Found ${usersWithDigest.length} users with email addresses`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const user of usersWithDigest) {
      const prefs = user.notification_preferences?.[0] as NotificationPreferences | undefined;
      
      if (!prefs) {
        skippedCount++;
        continue;
      }

      // Build list of types to include
      const digestTypes: string[] = [];
      if (prefs.digest_messages) digestTypes.push("message");
      if (prefs.digest_connections) digestTypes.push("connection");
      if (prefs.digest_reviews) digestTypes.push("review");
      if (prefs.digest_system) digestTypes.push("system");

      if (digestTypes.length === 0) {
        skippedCount++;
        continue;
      }

      // Fetch undigested notifications for this user in the window
      const { data: notifications, error: notifsError } = await supabase
        .from("notifications")
        .select("id, type, title, body, created_at")
        .eq("user_id", user.id)
        .in("type", digestTypes)
        .gte("created_at", windowStart.toISOString())
        .lt("created_at", windowEnd.toISOString())
        .is("digest_sent_at", null)
        .order("created_at", { ascending: false });

      if (notifsError) {
        console.error(`Error fetching notifications for user ${user.id}:`, notifsError);
        continue;
      }

      if (!notifications || notifications.length === 0) {
        skippedCount++;
        continue;
      }

      console.log(`Processing ${notifications.length} notifications for user ${user.email}`);

      // Group notifications by type
      const notificationsByType: Record<string, Notification[]> = {
        message: [],
        connection: [],
        review: [],
        system: [],
      };

      for (const notif of notifications) {
        if (notificationsByType[notif.type]) {
          notificationsByType[notif.type].push(notif);
        }
      }

      // Build email content
      const htmlBody = buildDigestHTML(notificationsByType);
      const textBody = buildDigestText(notificationsByType);

      // Send email via existing send-notification-email function
      const { error: emailError } = await supabase.functions.invoke("send-notification-email", {
        body: {
          to: user.email,
          subject: "Your ClearMarket daily summary",
          htmlBody,
          textBody,
        },
      });

      if (emailError) {
        console.error(`Failed to send digest to ${user.email}:`, emailError);
        continue;
      }

      // Mark notifications as digested
      const notificationIds = notifications.map(n => n.id);
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ digest_sent_at: new Date().toISOString() })
        .in("id", notificationIds);

      if (updateError) {
        console.error(`Failed to mark notifications as digested for user ${user.id}:`, updateError);
        continue;
      }

      console.log(`✓ Sent digest to ${user.email} with ${notifications.length} notifications`);
      sentCount++;
    }

    console.log(`Daily digest job complete. Sent: ${sentCount}, Skipped: ${skippedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        skipped: skippedCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in daily-digest-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
