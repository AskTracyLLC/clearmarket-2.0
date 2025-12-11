import { supabase } from "@/integrations/supabase/client";

export type SupportTicketCategory = 'bug' | 'account' | 'billing' | 'feature' | 'other';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportTicketPriority = 'normal' | 'high';

export const TICKET_CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'account', label: 'Account & Login' },
  { value: 'billing', label: 'Billing & Credits' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

export const TICKET_STATUSES: { value: SupportTicketStatus; label: string; color: string }[] = [
  { value: 'open', label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'closed', label: 'Closed', color: 'bg-muted text-muted-foreground border-border' },
];

export const TICKET_PRIORITIES: { value: SupportTicketPriority; label: string; color: string }[] = [
  { value: 'normal', label: 'Normal', color: 'bg-muted text-muted-foreground' },
  { value: 'high', label: 'High', color: 'bg-red-500/20 text-red-400' },
];

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: SupportTicketCategory;
  message: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  created_at: string;
  updated_at: string;
  last_admin_reply_at: string | null;
  last_user_reply_at: string | null;
  closed_at: string | null;
  image_urls: string[] | null;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  is_internal_note: boolean;
  created_at: string;
}

export interface SupportArticle {
  id: string;
  slug: string;
  category: string;
  title: string;
  body: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export async function createSupportTicket(
  userId: string,
  subject: string,
  category: SupportTicketCategory,
  message: string,
  priority: SupportTicketPriority = 'normal',
  imageUrls: string[] = []
): Promise<{ ticket: SupportTicket | null; error: string | null }> {
  // Create the ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      subject,
      category,
      message,
      priority,
      image_urls: imageUrls,
    })
    .select()
    .single();

  if (ticketError || !ticket) {
    return { ticket: null, error: ticketError?.message || 'Failed to create ticket' };
  }

  // Also insert the initial message into the messages table
  const { error: msgError } = await supabase
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticket.id,
      sender_id: userId,
      body: message,
      is_internal_note: false,
    });

  if (msgError) {
    console.error('Failed to create initial message:', msgError);
  }

  return { ticket: ticket as SupportTicket, error: null };
}

export async function fetchUserTickets(userId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }

  return (data || []) as SupportTicket[];
}

export async function fetchTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return (data || []) as SupportTicketMessage[];
}

export async function addTicketMessage(
  ticketId: string,
  senderId: string,
  body: string,
  isInternalNote: boolean = false
): Promise<{ message: SupportTicketMessage | null; error: string | null }> {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_id: senderId,
      body,
      is_internal_note: isInternalNote,
    })
    .select()
    .single();

  if (error) {
    return { message: null, error: error.message };
  }

  return { message: data as SupportTicketMessage, error: null };
}

export async function updateTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
  isAdmin: boolean = false
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = { status };

  if (status === 'closed') {
    updates.closed_at = new Date().toISOString();
  } else if (status === 'open') {
    updates.closed_at = null;
  }

  const { error } = await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId);

  return { error: error?.message || null };
}

export async function updateTicketPriority(
  ticketId: string,
  priority: SupportTicketPriority
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('support_tickets')
    .update({ priority })
    .eq('id', ticketId);

  return { error: error?.message || null };
}

export async function fetchAllTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all tickets:', error);
    return [];
  }

  return (data || []) as SupportTicket[];
}

export async function fetchPublishedArticles(): Promise<SupportArticle[]> {
  const { data, error } = await supabase
    .from('support_articles')
    .select('*')
    .eq('is_published', true)
    .order('category', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    console.error('Error fetching articles:', error);
    return [];
  }

  return (data || []) as SupportArticle[];
}

export const ARTICLE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'getting_started', label: 'Getting Started' },
  { value: 'account', label: 'Accounts & Access' },
  { value: 'billing', label: 'Billing & Credits' },
  { value: 'coverage', label: 'Seeking Coverage & Connections' },
  { value: 'safety', label: 'Safety & Moderation' },
];

export function getCategoryLabel(category: string): string {
  return ARTICLE_CATEGORIES.find(c => c.value === category)?.label || category;
}

export function getStatusInfo(status: SupportTicketStatus) {
  return TICKET_STATUSES.find(s => s.value === status) || TICKET_STATUSES[0];
}

export function getPriorityInfo(priority: SupportTicketPriority) {
  return TICKET_PRIORITIES.find(p => p.value === priority) || TICKET_PRIORITIES[0];
}

export function getCategoryLabelForTicket(category: SupportTicketCategory): string {
  return TICKET_CATEGORIES.find(c => c.value === category)?.label || category;
}
