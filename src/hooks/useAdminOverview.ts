import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOverviewCounts {
  // Queue-based counts (from support_queue_items)
  reviews: number;
  moderation: number;
  background_checks: number;
  user_reports: number;
  support_tickets: number;
  total: number;
  urgent: number;
  // Legacy counts (still used for backward compatibility)
  moderation_pending: number;
  support_open: number;
  background_checks_pending: number;
  checklist_stuck: number;
  reports_new: number;
  reviews_pending: number;
}

interface UseAdminOverviewReturn {
  counts: AdminOverviewCounts;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAdminOverview(): UseAdminOverviewReturn {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<AdminOverviewCounts>({
    reviews: 0,
    moderation: 0,
    background_checks: 0,
    user_reports: 0,
    support_tickets: 0,
    total: 0,
    urgent: 0,
    // Legacy
    moderation_pending: 0,
    support_open: 0,
    background_checks_pending: 0,
    checklist_stuck: 0,
    reports_new: 0,
    reviews_pending: 0,
  });

  const loadCounts = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch from support_queue_items (non-resolved)
      const { data: queueData, error: queueError } = await supabase
        .from("support_queue_items")
        .select("category, priority")
        .neq("status", "resolved");

      if (queueError) {
        console.error("Error fetching queue items:", queueError);
      }

      // Calculate queue-based counts
      const queueCounts = (queueData || []).reduce((acc, item) => {
        const category = item.category as string;
        acc[category] = (acc[category] || 0) + 1;
        if (item.priority === "urgent") {
          acc.urgent = (acc.urgent || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const total = queueData?.length || 0;

      // Also fetch checklist feedback count (not in queue)
      const { count: checklistCount } = await supabase
        .from("checklist_item_feedback")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");

      setCounts({
        // Queue-based counts
        reviews: queueCounts.reviews || 0,
        moderation: queueCounts.moderation || 0,
        background_checks: queueCounts.background_checks || 0,
        user_reports: queueCounts.user_reports || 0,
        support_tickets: queueCounts.support_tickets || 0,
        total,
        urgent: queueCounts.urgent || 0,
        // Legacy mappings (for backward compatibility)
        moderation_pending: queueCounts.moderation || 0,
        support_open: queueCounts.support_tickets || 0,
        background_checks_pending: queueCounts.background_checks || 0,
        checklist_stuck: checklistCount || 0,
        reports_new: queueCounts.user_reports || 0,
        reviews_pending: queueCounts.reviews || 0,
      });
    } catch (error) {
      console.error("Error loading admin overview counts:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || permsLoading) return;
    if (!user || !permissions.canViewModeration) {
      setLoading(false);
      return;
    }

    loadCounts();
  }, [user, authLoading, permsLoading, permissions, loadCounts]);

  return {
    counts,
    loading,
    refresh: loadCounts,
  };
}
