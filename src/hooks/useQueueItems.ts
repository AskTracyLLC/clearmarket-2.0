import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

export type QueueCategory = 
  | "reviews" 
  | "violation_review"
  | "billing" 
  | "support_tickets" 
  | "vendor_verification"
  | "dual_role_requests"
  | "other";

export type QueuePriority = "normal" | "urgent";
export type QueueStatus = "open" | "in_progress" | "waiting" | "resolved" | "declined";

export interface QueueItem {
  id: string;
  category: QueueCategory;
  source_type: string;
  source_id: string;
  title: string;
  preview: string | null;
  priority: QueuePriority;
  status: QueueStatus;
  assigned_to: string | null;
  target_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  conversation_id: string | null;
  // Joined profile data
  assignee?: {
    id: string;
    full_name: string | null;
  } | null;
}

export interface QueueFilters {
  category?: QueueCategory | null;
  status?: QueueStatus | null;
  priority?: QueuePriority | null;
  assigned_to?: string | null;
  search?: string;
  source_type?: string;
  source_id?: string;
}

interface UseQueueItemsReturn {
  items: QueueItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateStatus: (itemId: string, status: QueueStatus) => Promise<boolean>;
  assignTo: (itemId: string, userId: string | null) => Promise<boolean>;
}

export function useQueueItems(filters: QueueFilters = {}): UseQueueItemsReturn {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      let query = supabase
        .from("support_queue_items")
        .select(`
          *,
          assignee:profiles!support_queue_items_assigned_to_fkey(id, full_name)
        `)
        .order("priority", { ascending: false }) // urgent first
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      } else {
        // Default: exclude resolved and declined items
        query = query.not("status", "in", '("resolved","declined")');
      }
      if (filters.priority) {
        query = query.eq("priority", filters.priority);
      }
      if (filters.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters.source_type) {
        query = query.eq("source_type", filters.source_type);
      }
      if (filters.source_id) {
        query = query.eq("source_id", filters.source_id);
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,preview.ilike.%${filters.search}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setItems((data || []) as QueueItem[]);
    } catch (err) {
      console.error("Error loading queue items:", err);
      setError(err instanceof Error ? err.message : "Failed to load queue items");
    } finally {
      setLoading(false);
    }
  }, [user, filters.category, filters.status, filters.priority, filters.assigned_to, filters.search, filters.source_type, filters.source_id]);

  const updateStatus = useCallback(async (itemId: string, status: QueueStatus): Promise<boolean> => {
    if (!user) return false;

    try {
      const updateData: Record<string, unknown> = { 
        status,
        updated_at: new Date().toISOString(),
      };

      // Both resolved and declined are terminal states
      if (status === "resolved" || status === "declined") {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = user.id;
      }

      const { error: updateError } = await supabase
        .from("support_queue_items")
        .update(updateData)
        .eq("id", itemId);

      if (updateError) throw updateError;

      // Optimistic update
      setItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, status, updated_at: new Date().toISOString() }
          : item
      ));

      return true;
    } catch (err) {
      console.error("Error updating queue item status:", err);
      return false;
    }
  }, [user]);

  const assignTo = useCallback(async (itemId: string, userId: string | null): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from("support_queue_items")
        .update({ 
          assigned_to: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (updateError) throw updateError;

      await loadItems();
      return true;
    } catch (err) {
      console.error("Error assigning queue item:", err);
      return false;
    }
  }, [user, loadItems]);

  useEffect(() => {
    if (authLoading || permsLoading) return;
    if (!user || !permissions.canViewModeration) {
      setLoading(false);
      return;
    }

    loadItems();
  }, [user, authLoading, permsLoading, permissions, loadItems]);

  return {
    items,
    loading,
    error,
    refresh: loadItems,
    updateStatus,
    assignTo,
  };
}
