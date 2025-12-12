import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"];

// Map notification types to email template keys
function getEmailTemplateKey(type: string): string | null {
  switch (type) {
    case "new_message":
      return "message.new";
    case "connection_request":
    case "connection_accepted":
    case "connection_declined":
      return "connection.activity";
    case "review_received":
    case "review_reminder":
      return "review.new";
    case "territory_assignment_pending":
      return "territory.assignment.sent";
    case "territory_assignment_accepted":
      return "territory.assignment.accepted";
    case "credits_event":
    case "system_update":
    case "safety_alert":
    case "announcement":
      return "system.update";
    default:
      return null;
  }
}

// Map notification types to categories for email preferences
function getEmailPreferenceField(type: string): keyof NotificationPreferences | null {
  switch (type) {
    case "new_message":
      return "email_messages";
    case "connection_request":
    case "connection_accepted":
    case "connection_declined":
    case "territory_assignment_pending":
    case "territory_assignment_accepted":
      return "email_connections";
    case "review_received":
    case "review_reminder":
      return "email_reviews";
    case "new_coverage_opportunity":
      return "email_system"; // Match alerts use system email preference
    case "credits_event":
    case "system_update":
    case "safety_alert":
    case "announcement":
      return "email_system";
    default:
      return null;
  }
}

// Get CTA details based on notification type
function getCTADetails(type: string, refId: string | null): { label: string; path: string } {
  switch (type) {
    case "new_message":
      return { label: "View Messages", path: refId ? `/messages/${refId}` : "/messages" };
    case "connection_request":
    case "connection_accepted":
    case "connection_declined":
      return { label: "View Connections", path: "/messages" };
    case "review_received":
      return { label: "View Reviews", path: "/dashboard" };
    case "review_reminder":
      return { label: "Leave a Review", path: "/notifications" };
    case "territory_assignment_pending":
      return { label: "Review Assignment", path: "/dashboard" };
    case "territory_assignment_accepted":
      return { label: "View Agreement", path: "/dashboard" };
    case "new_coverage_opportunity":
      return { label: "View Opportunity", path: "/rep/find-work" };
    case "announcement":
      return { label: "View Announcement", path: refId ? `/community/${refId}` : "/community?tab=announcements" };
    default:
      return { label: "Go to Dashboard", path: "/dashboard" };
  }
}

// Send email notification via Edge Function using templates
async function sendEmailNotification(
  recipientEmail: string,
  type: string,
  title: string,
  body: string | null,
  refId: string | null,
  actorName?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const templateKey = getEmailTemplateKey(type);
    if (!templateKey) {
      console.log(`No template key for notification type: ${type}`);
      return { ok: false, error: "No template for this notification type" };
    }

    const baseUrl = window.location.origin;
    const cta = getCTADetails(type, refId);
    
    // Extract first name from title if it contains a name pattern
    const firstName = recipientEmail.split("@")[0]; // Fallback

    const { data, error } = await supabase.functions.invoke("send-notification-email", {
      body: {
        to: recipientEmail,
        templateKey,
        placeholders: {
          user_first_name: firstName,
          actor_name: actorName || "Someone",
          summary: title,
          snippet: body || "",
        },
        ctaLabel: cta.label,
        ctaUrl: `${baseUrl}${cta.path}`,
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
  refId: string | null = null,
  actorName?: string
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
      case "review_reminder":
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
    // Fetch user email and name
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileData?.email) {
      console.log(`Sending email notification to ${profileData.email} for type ${type}`);
      
      // Send email asynchronously (don't block on it)
      sendEmailNotification(profileData.email, type, title, body, refId, actorName)
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
