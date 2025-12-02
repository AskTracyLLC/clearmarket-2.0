import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"];

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

  // Determine if notification should be sent based on preferences
  const allow = (() => {
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
      case "credits_event":
        return prefs.notify_credits_events;
      case "system_update":
        return prefs.notify_system_updates;
      default:
        // Safety / critical types bypass preferences
        return true;
    }
  })();

  if (!allow) {
    return { skippedByPreferences: true };
  }

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

  return { data };
}
