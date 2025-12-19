import { supabase } from "@/integrations/supabase/client";

export interface AdminBroadcast {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "archived";
  send_at: string | null;
  sent_at: string | null;
  title: string;
  email_subject: string | null;
  message_md: string;
  cta_label: string;
  audience: BroadcastAudience;
  stats: BroadcastStats;
}

export interface BroadcastAudience {
  roles?: string[];
  active_days?: number;
}

export interface BroadcastStats {
  sent: number;
  responses: number;
  avg_rating: number | null;
  emails_sent?: number;
}

export interface AdminBroadcastRecipient {
  id: string;
  broadcast_id: string;
  user_id: string;
  created_at: string;
  emailed_at: string | null;
  email_provider_id: string | null;
  email_error: string | null;
  notification_id: string | null;
  opened_at: string | null;
  responded_at: string | null;
}

export interface AdminBroadcastFeedback {
  id: string;
  recipient_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  rating: number;
  like_text: string | null;
  dislike_text: string | null;
  suggestion_text: string | null;
  allow_spotlight: boolean;
  allow_name: boolean;
}

export interface FeedbackWithUser extends AdminBroadcastFeedback {
  profiles?: {
    full_name: string | null;
    is_fieldrep: boolean;
    is_vendor_admin: boolean;
  };
}

// Fetch all broadcasts
export async function fetchBroadcasts(status?: string): Promise<AdminBroadcast[]> {
  let query = supabase
    .from("admin_broadcasts")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching broadcasts:", error);
    throw error;
  }

  return (data || []).map(parseBroadcast);
}

// Fetch single broadcast
export async function fetchBroadcast(id: string): Promise<AdminBroadcast | null> {
  const { data, error } = await supabase
    .from("admin_broadcasts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching broadcast:", error);
    throw error;
  }

  return data ? parseBroadcast(data) : null;
}

// Create broadcast
export async function createBroadcast(broadcast: {
  title: string;
  email_subject?: string;
  message_md: string;
  cta_label?: string;
  audience?: BroadcastAudience;
}): Promise<AdminBroadcast> {
  const { data: user } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from("admin_broadcasts")
    .insert({
      title: broadcast.title,
      email_subject: broadcast.email_subject || null,
      message_md: broadcast.message_md,
      cta_label: broadcast.cta_label || "Give Feedback",
      audience: (broadcast.audience || {}) as unknown as Record<string, unknown>,
      created_by: user?.user?.id,
    } as any)
    .select()
    .single();

  if (error) {
    console.error("Error creating broadcast:", error);
    throw error;
  }

  return parseBroadcast(data);
}

// Update broadcast
export async function updateBroadcast(
  id: string,
  updates: Partial<{
    title: string;
    email_subject: string | null;
    message_md: string;
    cta_label: string;
    audience: BroadcastAudience;
    status: string;
  }>
): Promise<AdminBroadcast> {
  const updatePayload: Record<string, unknown> = { 
    ...updates, 
    updated_at: new Date().toISOString() 
  };
  
  if (updates.audience) {
    updatePayload.audience = updates.audience as unknown as Record<string, unknown>;
  }

  const { data, error } = await supabase
    .from("admin_broadcasts")
    .update(updatePayload as any)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating broadcast:", error);
    throw error;
  }

  return parseBroadcast(data);
}

// Send broadcast (calls RPC + edge function)
export async function sendBroadcast(id: string): Promise<{
  success: boolean;
  recipients_created?: number;
  notifications_created?: number;
  emails_sent?: number;
  emails_failed?: number;
  error?: string;
}> {
  // Step 1: Call RPC to create recipients and notifications
  const { data: rpcResult, error: rpcError } = await supabase.rpc("send_admin_broadcast", {
    p_broadcast_id: id,
  });

  if (rpcError) {
    console.error("Error in send_admin_broadcast RPC:", rpcError);
    return { success: false, error: rpcError.message };
  }

  const result = rpcResult as { success: boolean; error?: string; recipients_created?: number; notifications_created?: number } | null;

  if (!result?.success) {
    return { success: false, error: result?.error || "Unknown RPC error" };
  }

  // Step 2: Call edge function to send emails
  const { data: emailResult, error: emailError } = await supabase.functions.invoke(
    "send-admin-broadcast-emails",
    {
      body: { broadcastId: id },
    }
  );

  if (emailError) {
    console.error("Error sending broadcast emails:", emailError);
    // RPC succeeded, so recipients and notifications were created
    return {
      success: true,
      recipients_created: result.recipients_created,
      notifications_created: result.notifications_created,
      emails_sent: 0,
      emails_failed: 0,
      error: `Notifications created but email sending failed: ${emailError.message}`,
    };
  }

  return {
    success: true,
    recipients_created: result.recipients_created,
    notifications_created: result.notifications_created,
    emails_sent: emailResult?.sent || 0,
    emails_failed: emailResult?.failed || 0,
  };
}

// Fetch broadcast recipients with profiles
export async function fetchBroadcastRecipients(
  broadcastId: string
): Promise<(AdminBroadcastRecipient & { profiles?: { full_name: string | null } })[]> {
  const { data, error } = await supabase
    .from("admin_broadcast_recipients")
    .select(`
      *,
      profiles (
        full_name
      )
    `)
    .eq("broadcast_id", broadcastId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching recipients:", error);
    throw error;
  }

  return data || [];
}

// Fetch emails sent count for a broadcast
export async function fetchEmailsSentCount(broadcastId: string): Promise<number> {
  const { count, error } = await supabase
    .from("admin_broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .not("emailed_at", "is", null);

  if (error) {
    console.error("Error fetching emails sent count:", error);
    return 0;
  }

  return count || 0;
}

// Fetch broadcast feedback with user info
export async function fetchBroadcastFeedback(broadcastId: string): Promise<FeedbackWithUser[]> {
  const { data, error } = await supabase
    .from("admin_broadcast_feedback")
    .select(`
      *,
      admin_broadcast_recipients!inner (
        broadcast_id
      ),
      profiles (
        full_name,
        is_fieldrep,
        is_vendor_admin
      )
    `)
    .eq("admin_broadcast_recipients.broadcast_id", broadcastId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching feedback:", error);
    throw error;
  }

  return data || [];
}

// Fetch recipient for current user
export async function fetchMyRecipient(
  broadcastId: string
): Promise<AdminBroadcastRecipient | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) return null;

  const { data, error } = await supabase
    .from("admin_broadcast_recipients")
    .select("*")
    .eq("broadcast_id", broadcastId)
    .eq("user_id", user.user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching my recipient:", error);
    return null;
  }

  return data;
}

// Fetch my existing feedback
export async function fetchMyFeedback(
  recipientId: string
): Promise<AdminBroadcastFeedback | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) return null;

  const { data, error } = await supabase
    .from("admin_broadcast_feedback")
    .select("*")
    .eq("recipient_id", recipientId)
    .eq("user_id", user.user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching my feedback:", error);
    return null;
  }

  return data;
}

// Submit or update feedback
export async function submitFeedback(
  recipientId: string,
  feedback: {
    rating: number;
    like_text?: string;
    dislike_text?: string;
    suggestion_text?: string;
    allow_spotlight?: boolean;
    allow_name?: boolean;
  },
  existingFeedbackId?: string
): Promise<AdminBroadcastFeedback> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) throw new Error("Not authenticated");

  if (existingFeedbackId) {
    // Update existing
    const { data, error } = await supabase
      .from("admin_broadcast_feedback")
      .update({
        rating: feedback.rating,
        like_text: feedback.like_text || null,
        dislike_text: feedback.dislike_text || null,
        suggestion_text: feedback.suggestion_text || null,
        allow_spotlight: feedback.allow_spotlight || false,
        allow_name: feedback.allow_name || false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingFeedbackId)
      .eq("user_id", user.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("admin_broadcast_feedback")
      .insert({
        recipient_id: recipientId,
        user_id: user.user.id,
        rating: feedback.rating,
        like_text: feedback.like_text || null,
        dislike_text: feedback.dislike_text || null,
        suggestion_text: feedback.suggestion_text || null,
        allow_spotlight: feedback.allow_spotlight || false,
        allow_name: feedback.allow_name || false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Helper to parse broadcast from DB
function parseBroadcast(data: any): AdminBroadcast {
  return {
    ...data,
    audience: (data.audience as BroadcastAudience) || {},
    stats: (data.stats as BroadcastStats) || { sent: 0, responses: 0, avg_rating: null, emails_sent: 0 },
  };
}

// Get display name for a feedback item (handles anonymization)
export function getDisplayName(
  feedback: FeedbackWithUser | { allow_name: boolean; profiles?: { full_name: string | null; is_fieldrep: boolean; is_vendor_admin: boolean } }
): string {
  if (feedback.allow_name && feedback.profiles?.full_name) {
    return feedback.profiles.full_name;
  }
  if (feedback.profiles?.is_fieldrep) return "Anonymous Field Rep";
  if (feedback.profiles?.is_vendor_admin) return "Anonymous Vendor";
  return "Anonymous User";
}

// Get user role label
export function getUserRoleLabel(
  feedback: FeedbackWithUser | { profiles?: { is_fieldrep: boolean; is_vendor_admin: boolean } }
): string {
  if (feedback.profiles?.is_fieldrep) return "Field Rep";
  if (feedback.profiles?.is_vendor_admin) return "Vendor";
  return "User";
}

// Export feedback to CSV
export function exportFeedbackToCSV(feedback: FeedbackWithUser[]): void {
  const headers = [
    "Rating",
    "Likes",
    "Dislikes",
    "Suggestions",
    "Allow Spotlight",
    "Allow Name",
    "Submitted At",
    "Role",
    "Display Name"
  ];
  
  const rows = feedback.map(f => [
    f.rating.toString(),
    f.like_text || "",
    f.dislike_text || "",
    f.suggestion_text || "",
    f.allow_spotlight ? "Yes" : "No",
    f.allow_name ? "Yes" : "No",
    new Date(f.created_at).toISOString(),
    getUserRoleLabel(f),
    getDisplayName(f)
  ]);
  
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `broadcast-feedback-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

// Copy all spotlight quotes to clipboard
export function copySpotlightQuotes(feedback: FeedbackWithUser[]): string {
  const spotlightItems = feedback.filter(f => f.allow_spotlight && (f.like_text || f.suggestion_text));
  
  const formatted = spotlightItems.map(f => {
    const name = getDisplayName(f);
    const role = getUserRoleLabel(f);
    const quote = f.like_text || f.suggestion_text || "";
    return `"${quote}" — ${name} (${role})`;
  }).join("\n\n");
  
  return formatted;
}

// Get audience estimate
export async function estimateAudience(audience: BroadcastAudience): Promise<number> {
  const roles = audience.roles?.length ? audience.roles : ["field_rep", "vendor"];
  const activeDays = audience.active_days;

  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("account_status", "active")
    .eq("is_admin", false);

  // Build OR conditions for roles
  const orConditions: string[] = [];
  if (roles.includes("field_rep")) {
    orConditions.push("is_fieldrep.eq.true");
  }
  if (roles.includes("vendor")) {
    orConditions.push("is_vendor_admin.eq.true");
  }
  
  if (orConditions.length > 0) {
    query = query.or(orConditions.join(","));
  }

  if (activeDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - activeDays);
    query = query.gte("last_seen_at", cutoffDate.toISOString());
  }

  const { count, error } = await query;

  if (error) {
    console.error("Error estimating audience:", error);
    return 0;
  }

  return count || 0;
}
