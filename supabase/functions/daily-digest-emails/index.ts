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

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

const categoryLabels: Record<string, string> = {
  message: "Messages",
  new_message: "Messages",
  connection: "Connections",
  connection_request: "Connections",
  connection_accepted: "Connections",
  review: "Reviews",
  review_received: "Reviews",
  system: "System & Safety",
  system_update: "System & Safety",
  territory_assignment_pending: "Territory Assignments",
  territory_assignment_accepted: "Territory Assignments",
};

function categorizeNotificationType(type: string): string {
  if (type.includes("message")) return "message";
  if (type.includes("connection") || type.includes("territory")) return "connection";
  if (type.includes("review")) return "review";
  return "system";
}

function buildDigestSummary(notificationsByCategory: Record<string, Notification[]>): string {
  const parts: string[] = [];
  
  for (const [category, notifications] of Object.entries(notificationsByCategory)) {
    if (notifications.length === 0) continue;
    const label = categoryLabels[category] || category;
    parts.push(`${notifications.length} ${label.toLowerCase()}`);
  }
  
  if (parts.length === 0) return "No new activity";
  if (parts.length === 1) return `You have ${parts[0]}`;
  
  const lastPart = parts.pop();
  return `You have ${parts.join(", ")}, and ${lastPart}`;
}

function buildDigestBodyHTML(notificationsByCategory: Record<string, Notification[]>): string {
  let html = "";
  
  for (const [category, notifications] of Object.entries(notificationsByCategory)) {
    if (notifications.length === 0) continue;
    
    const label = categoryLabels[category] || category;
    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #f2f2f2;">
          ${label} (${notifications.length})
        </h3>
        ${notifications.slice(0, 5).map(n => `
          <div style="background: #0d2626; border-left: 3px solid #e07830; padding: 12px; margin-bottom: 8px; border-radius: 4px;">
            <div style="font-weight: 500; color: #f2f2f2; margin-bottom: 4px;">${n.title}</div>
            ${n.body ? `<div style="color: #999999; font-size: 14px;">${n.body}</div>` : ''}
          </div>
        `).join('')}
        ${notifications.length > 5 ? `
          <p style="color: #999999; font-size: 14px; margin: 8px 0 0 0;">
            +${notifications.length - 5} more
          </p>
        ` : ''}
      </div>
    `;
  }
  
  return html;
}

serve(async (req) => {
  try {
    console.log("Starting daily digest job...");

    if (!enableEmailNotifications) {
      console.log("Email notifications are disabled. Skipping digest.");
      return new Response(JSON.stringify({ message: "Email notifications disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Define 24-hour window
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

    console.log(`Digest window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

    // Load digest template
    const { data: digestTemplate, error: templateError } = await supabase
      .from("email_templates")
      .select("subject_template, body_template")
      .eq("key", "digest.daily")
      .single();

    if (templateError) {
      console.error("Error loading digest template:", templateError);
    }

    // Fetch users with digest preferences enabled
    const { data: usersWithDigest, error: usersError } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
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

      // Check if any digest preference is enabled
      const hasDigestEnabled = prefs.digest_messages || prefs.digest_connections || 
                               prefs.digest_reviews || prefs.digest_system;
      
      if (!hasDigestEnabled) {
        skippedCount++;
        continue;
      }

      // Fetch undigested notifications for this user in the window
      const { data: notifications, error: notifsError } = await supabase
        .from("notifications")
        .select("id, type, title, body, created_at")
        .eq("user_id", user.id)
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

      // Filter notifications based on user's digest preferences
      const filteredNotifications = notifications.filter(n => {
        const category = categorizeNotificationType(n.type);
        switch (category) {
          case "message": return prefs.digest_messages;
          case "connection": return prefs.digest_connections;
          case "review": return prefs.digest_reviews;
          default: return prefs.digest_system;
        }
      });

      if (filteredNotifications.length === 0) {
        skippedCount++;
        continue;
      }

      console.log(`Processing ${filteredNotifications.length} notifications for user ${user.email}`);

      // Group notifications by category
      const notificationsByCategory: Record<string, Notification[]> = {
        message: [],
        connection: [],
        review: [],
        system: [],
      };

      for (const notif of filteredNotifications) {
        const category = categorizeNotificationType(notif.type);
        notificationsByCategory[category].push(notif);
      }

      // Build summary and body
      const summary = buildDigestSummary(notificationsByCategory);
      const bodyContent = buildDigestBodyHTML(notificationsByCategory);
      const firstName = user.full_name?.split(" ")[0] || "there";

      // Send email using template-based approach
      const { error: emailError } = await supabase.functions.invoke("send-notification-email", {
        body: {
          to: user.email,
          templateKey: "digest.daily",
          placeholders: {
            user_first_name: firstName,
            summary: summary,
          },
          // Override body with the full digest content
          subject: digestTemplate?.subject_template || "Your ClearMarket daily summary",
          htmlBody: undefined, // Will use template
          ctaLabel: "View All Activity",
          ctaUrl: `${appBaseUrl}/dashboard`,
        },
      });

      if (emailError) {
        console.error(`Failed to send digest to ${user.email}:`, emailError);
        continue;
      }

      // Mark notifications as digested
      const notificationIds = filteredNotifications.map(n => n.id);
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ digest_sent_at: new Date().toISOString() })
        .in("id", notificationIds);

      if (updateError) {
        console.error(`Failed to mark notifications as digested for user ${user.id}:`, updateError);
        continue;
      }

      console.log(`✓ Sent digest to ${user.email} with ${filteredNotifications.length} notifications`);
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
