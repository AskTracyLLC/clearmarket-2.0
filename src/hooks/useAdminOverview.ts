import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOverviewCounts {
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
      // Fetch all counts in parallel
      const [
        moderationResult,
        supportResult,
        backgroundChecksResult,
        reportsResult,
        reviewsResult,
        checklistFeedbackResult,
      ] = await Promise.all([
        // Moderation: flagged posts/comments (open or under_review user_reports)
        supabase
          .from("user_reports")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "under_review"]),
        
        // Support: open or in_progress tickets
        supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        
        // Background checks: pending status
        supabase
          .from("background_checks")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        
        // Reports: new user reports (open status)
        supabase
          .from("user_reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "open"),
        
        // Reviews: pending workflow_status
        supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("workflow_status", "pending"),
        
        // Checklist feedback: unresolved items
        supabase
          .from("checklist_item_feedback")
          .select("*", { count: "exact", head: true })
          .eq("status", "open"),
      ]);

      setCounts({
        moderation_pending: moderationResult.count || 0,
        support_open: supportResult.count || 0,
        background_checks_pending: backgroundChecksResult.count || 0,
        checklist_stuck: checklistFeedbackResult.count || 0,
        reports_new: reportsResult.count || 0,
        reviews_pending: reviewsResult.count || 0,
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
