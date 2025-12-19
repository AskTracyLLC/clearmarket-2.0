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
  mode?: "all" | "selected";
  user_ids?: string[];
}

export interface AudienceUser {
  id: string;
  full_name: string | null;
  email: string;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
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

export interface BroadcastProfile {
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  is_fieldrep: boolean;
  is_vendor_admin: boolean;
}

export interface FeedbackWithUser extends AdminBroadcastFeedback {
  profiles?: BroadcastProfile;
}

export interface RecipientWithProfile extends AdminBroadcastRecipient {
  profiles?: BroadcastProfile;
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
): Promise<RecipientWithProfile[]> {
  const { data, error } = await supabase
    .from("admin_broadcast_recipients")
    .select(`
      *,
      profiles (
        full_name,
        email,
        is_fieldrep,
        is_vendor_admin
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
        email,
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

  // Sort client-side by last_name, then first_name (fallback to display_name/email)
  return sortByUserName(data || []);
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

/**
 * Format user label as "FirstName LastName (DisplayName)"
 * Falls back to display_name, then email, then "Unknown User"
 */
export function formatUserLabel(profile?: BroadcastProfile | null): string {
  if (!profile) return "Unknown User";
  
  const first = profile.full_name?.split(" ")[0] || "";
  const last = profile.full_name?.split(" ").slice(1).join(" ") || "";
  const baseName = `${first} ${last}`.trim();
  
  // For display_name, we check if there's an anonymous ID style (e.g., "FieldRep#123")
  const displayName = profile.display_name || "";
  
  if (baseName) {
    return displayName ? `${baseName} (${displayName})` : baseName;
  }
  
  return displayName || profile.email || "Unknown User";
}

/**
 * Get display name for spotlight/marketing use (respects allow_name permission)
 */
export function getDisplayName(
  feedback: FeedbackWithUser | { allow_name: boolean; allow_spotlight: boolean; profiles?: BroadcastProfile }
): string {
  if (feedback.allow_name && feedback.allow_spotlight) {
    return formatUserLabel(feedback.profiles);
  }
  // Anonymized label
  if (feedback.profiles?.is_fieldrep) return "Anonymous Field Rep";
  if (feedback.profiles?.is_vendor_admin) return "Anonymous Vendor";
  return "Anonymous User";
}

/**
 * Get display name for admin internal view (not for marketing, can show full name)
 */
export function getAdminDisplayName(
  profile?: BroadcastProfile | null
): string {
  return formatUserLabel(profile);
}

// Get user role label
export function getUserRoleLabel(
  item: FeedbackWithUser | RecipientWithProfile | { profiles?: { is_fieldrep: boolean; is_vendor_admin: boolean } }
): string {
  if (item.profiles?.is_fieldrep) return "Field Rep";
  if (item.profiles?.is_vendor_admin) return "Vendor";
  return "User";
}

/**
 * Sort items by user name: last_name ASC, then first_name ASC
 * Fallback: users without last_name go after named users, sorted by display_name then email
 */
export function sortByUserName<T extends { profiles?: BroadcastProfile }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aProfile = a.profiles;
    const bProfile = b.profiles;
    
    const aFullName = aProfile?.full_name || "";
    const bFullName = bProfile?.full_name || "";
    
    const aFirst = aFullName.split(" ")[0]?.toLowerCase() || "";
    const bFirst = bFullName.split(" ")[0]?.toLowerCase() || "";
    const aLast = aFullName.split(" ").slice(1).join(" ")?.toLowerCase() || "";
    const bLast = bFullName.split(" ").slice(1).join(" ")?.toLowerCase() || "";
    
    // Users with last_name come before those without
    const aHasLast = aLast.length > 0;
    const bHasLast = bLast.length > 0;
    
    if (aHasLast && !bHasLast) return -1;
    if (!aHasLast && bHasLast) return 1;
    
    if (aHasLast && bHasLast) {
      // Sort by last_name, then first_name
      const lastCmp = aLast.localeCompare(bLast);
      if (lastCmp !== 0) return lastCmp;
      return aFirst.localeCompare(bFirst);
    }
    
    // Both without last_name: sort by display_name, then email
    const aDisplay = (aProfile?.display_name || "").toLowerCase();
    const bDisplay = (bProfile?.display_name || "").toLowerCase();
    
    if (aDisplay && !bDisplay) return -1;
    if (!aDisplay && bDisplay) return 1;
    if (aDisplay && bDisplay) {
      const displayCmp = aDisplay.localeCompare(bDisplay);
      if (displayCmp !== 0) return displayCmp;
    }
    
    // Final fallback: email
    const aEmail = (aProfile?.email || "").toLowerCase();
    const bEmail = (bProfile?.email || "").toLowerCase();
    return aEmail.localeCompare(bEmail);
  });
}

// Export feedback to CSV (for admin analytics, shows full user info)
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
    "User (Internal)"
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
    getAdminDisplayName(f.profiles) // Always show full name for internal admin export
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

// Export spotlight-approved feedback to CSV (respects permissions)
export function exportSpotlightFeedbackToCSV(feedback: FeedbackWithUser[]): void {
  // Only include spotlight-approved feedback
  const spotlightFeedback = feedback.filter(f => f.allow_spotlight && (f.like_text || f.suggestion_text));
  
  const headers = [
    "Rating",
    "Quote (Likes)",
    "Quote (Suggestion)",
    "Role",
    "Display Name (Marketing)"
  ];
  
  const rows = spotlightFeedback.map(f => [
    f.rating.toString(),
    f.like_text || "",
    f.suggestion_text || "",
    getUserRoleLabel(f),
    getDisplayName(f) // Respects allow_name permission
  ]);
  
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `broadcast-spotlight-${new Date().toISOString().split("T")[0]}.csv`;
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
  // If mode is "selected", return the count of selected user_ids
  if (audience.mode === "selected" && audience.user_ids) {
    return audience.user_ids.length;
  }

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

// Fetch matching users for audience selection (admin only)
export async function fetchAudienceUsers(
  roles: string[],
  activeDays?: number
): Promise<AudienceUser[]> {
  if (roles.length === 0) {
    return [];
  }

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, is_fieldrep, is_vendor_admin")
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

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching audience users:", error);
    return [];
  }

  return data || [];
}

// Sort audience users by name
export function sortAudienceUsers(users: AudienceUser[]): AudienceUser[] {
  return [...users].sort((a, b) => {
    const aFullName = a.full_name || "";
    const bFullName = b.full_name || "";
    
    const aFirst = aFullName.split(" ")[0]?.toLowerCase() || "";
    const bFirst = bFullName.split(" ")[0]?.toLowerCase() || "";
    const aLast = aFullName.split(" ").slice(1).join(" ")?.toLowerCase() || "";
    const bLast = bFullName.split(" ").slice(1).join(" ")?.toLowerCase() || "";
    
    // Users with last_name come before those without
    const aHasLast = aLast.length > 0;
    const bHasLast = bLast.length > 0;
    
    if (aHasLast && !bHasLast) return -1;
    if (!aHasLast && bHasLast) return 1;
    
    if (aHasLast && bHasLast) {
      const lastCmp = aLast.localeCompare(bLast);
      if (lastCmp !== 0) return lastCmp;
      return aFirst.localeCompare(bFirst);
    }
    
    // Final fallback: email
    const aEmail = (a.email || "").toLowerCase();
    const bEmail = (b.email || "").toLowerCase();
    return aEmail.localeCompare(bEmail);
  });
}

// Format user label for audience list
export function formatAudienceUserLabel(user: AudienceUser): string {
  if (user.full_name) {
    return user.full_name;
  }
  return user.email || "Unknown User";
}
