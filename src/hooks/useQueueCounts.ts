import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import type { QueueCategory, QueueStatus } from "./useQueueItems";

export interface QueueCounts {
  reviews: number;
  violation_review: number;
  billing: number;
  support_tickets: number;
  vendor_verification: number;
  dual_role_requests: number;
  other: number;
  total: number;
  urgent: number;
}

interface UseQueueCountsReturn {
  counts: QueueCounts;
  loading: boolean;
  refresh: () => Promise<void>;
}

const emptyCounts: QueueCounts = {
  reviews: 0,
  violation_review: 0,
  billing: 0,
  support_tickets: 0,
  vendor_verification: 0,
  dual_role_requests: 0,
  other: 0,
  total: 0,
  urgent: 0,
};

export function useQueueCounts(): UseQueueCountsReturn {
  const { user, loading: authLoading } = useAuth();
  const { loading: permsLoading, permissions } = useStaffPermissions();
  const [counts, setCounts] = useState<QueueCounts>(emptyCounts);
  const [loading, setLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch counts by category for non-resolved and non-declined items
      const { data: categoryData, error: categoryError } = await supabase
        .from("support_queue_items")
        .select("category, priority")
        .not("status", "in", '("resolved","declined")');

      if (categoryError) throw categoryError;

      // Calculate counts
      const categoryCounts = (categoryData || []).reduce((acc, item) => {
        const category = item.category as QueueCategory;
        acc[category] = (acc[category] || 0) + 1;
        if (item.priority === "urgent") {
          acc.urgent = (acc.urgent || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const total = categoryData?.length || 0;

      setCounts({
        reviews: categoryCounts.reviews || 0,
        violation_review: categoryCounts.violation_review || 0,
        billing: categoryCounts.billing || 0,
        support_tickets: categoryCounts.support_tickets || 0,
        vendor_verification: categoryCounts.vendor_verification || 0,
        dual_role_requests: categoryCounts.dual_role_requests || 0,
        other: categoryCounts.other || 0,
        total,
        urgent: categoryCounts.urgent || 0,
      });
    } catch (err) {
      console.error("Error loading queue counts:", err);
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
