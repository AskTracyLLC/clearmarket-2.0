/**
 * useRepRewardSummary Hook
 * 
 * Fetches and manages rep milestone (2 credits) and full onboarding (up to 5 total) reward status.
 * Uses the get_rep_reward_summary RPC for server-validated data.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useMimic } from "@/hooks/useMimic";
import { useToast } from "@/hooks/use-toast";

export interface RepRewardSummary {
  milestone_complete: boolean;
  milestone_missing: string[];
  milestone_earned: boolean;
  milestone_credits: number;
  onboarding_complete: boolean;
  onboarding_missing: string[];
  onboarding_earned: boolean;
  onboarding_credits: number;
  total_earned: number;
  total_possible: number;
  remaining: number;
}

export interface UseRepRewardSummaryResult {
  summary: RepRewardSummary | null;
  loading: boolean;
  claiming: boolean;
  claimMilestone: () => Promise<{ awarded: boolean; credits_awarded: number; message: string }>;
  claimOnboarding: () => Promise<{ awarded: boolean; credits_awarded: number; message: string }>;
  refresh: () => Promise<void>;
}

const DEFAULT_SUMMARY: RepRewardSummary = {
  milestone_complete: false,
  milestone_missing: [],
  milestone_earned: false,
  milestone_credits: 0,
  onboarding_complete: false,
  onboarding_missing: [],
  onboarding_earned: false,
  onboarding_credits: 0,
  total_earned: 0,
  total_possible: 5,
  remaining: 5,
};

export function useRepRewardSummary(): UseRepRewardSummaryResult {
  const { user } = useAuth();
  const { effectiveUserId } = useMimic();
  const { effectiveRole } = useActiveRole();
  const { toast } = useToast();

  const [summary, setSummary] = useState<RepRewardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const hasAutoClaimedMilestoneRef = useRef(false);
  const hasAutoClaimedOnboardingRef = useRef(false);

  const fetchSummary = useCallback(async () => {
    if (!effectiveUserId || effectiveRole !== "rep") {
      setSummary(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_rep_reward_summary");

      if (error) {
        console.error("Error fetching rep reward summary:", error);
        setSummary(DEFAULT_SUMMARY);
      } else if (data && typeof data === "object" && !Array.isArray(data)) {
        setSummary(data as unknown as RepRewardSummary);
      } else {
        setSummary(DEFAULT_SUMMARY);
      }
    } catch (err) {
      console.error("Error fetching rep reward summary:", err);
      setSummary(DEFAULT_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, effectiveRole]);

  const claimMilestone = useCallback(async () => {
    if (!user?.id || effectiveUserId !== user.id) {
      return { awarded: false, credits_awarded: 0, message: "Cannot claim while viewing as another user" };
    }

    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc("award_rep_profile_pricing_credits");

      if (error) {
        console.error("Error claiming milestone reward:", error);
        return { awarded: false, credits_awarded: 0, message: error.message };
      }

      const result = data as { awarded: boolean; credits_awarded: number; message: string };

      if (result.awarded) {
        toast({
          title: "🎉 Milestone Complete!",
          description: "+2 credits added for completing your profile & pricing.",
        });
        await fetchSummary();
      }

      return result;
    } catch (err) {
      console.error("Error claiming milestone reward:", err);
      return { awarded: false, credits_awarded: 0, message: "An error occurred" };
    } finally {
      setClaiming(false);
    }
  }, [user?.id, effectiveUserId, toast, fetchSummary]);

  const claimOnboarding = useCallback(async () => {
    if (!user?.id || effectiveUserId !== user.id) {
      return { awarded: false, credits_awarded: 0, message: "Cannot claim while viewing as another user" };
    }

    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc("award_rep_onboarding_credits");

      if (error) {
        console.error("Error claiming onboarding reward:", error);
        return { awarded: false, credits_awarded: 0, message: error.message };
      }

      const result = data as { awarded: boolean; credits_awarded: number; message: string };

      if (result.awarded) {
        toast({
          title: "🎉 Onboarding Complete!",
          description: `+${result.credits_awarded} credits added to your wallet.`,
        });
        await fetchSummary();
      }

      return result;
    } catch (err) {
      console.error("Error claiming onboarding reward:", err);
      return { awarded: false, credits_awarded: 0, message: "An error occurred" };
    } finally {
      setClaiming(false);
    }
  }, [user?.id, effectiveUserId, toast, fetchSummary]);

  // Initial fetch
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Reset auto-claim flags on user change
  useEffect(() => {
    hasAutoClaimedMilestoneRef.current = false;
    hasAutoClaimedOnboardingRef.current = false;
  }, [effectiveUserId]);

  // Auto-claim milestone when eligible (only for real user, not mimic)
  useEffect(() => {
    if (
      !loading &&
      summary &&
      summary.milestone_complete &&
      !summary.milestone_earned &&
      !hasAutoClaimedMilestoneRef.current &&
      effectiveUserId === user?.id
    ) {
      hasAutoClaimedMilestoneRef.current = true;
      claimMilestone();
    }
  }, [loading, summary, effectiveUserId, user?.id, claimMilestone]);

  // Auto-claim onboarding when eligible (only for real user, not mimic)
  useEffect(() => {
    if (
      !loading &&
      summary &&
      summary.onboarding_complete &&
      !summary.onboarding_earned &&
      summary.remaining > 0 &&
      !hasAutoClaimedOnboardingRef.current &&
      effectiveUserId === user?.id
    ) {
      hasAutoClaimedOnboardingRef.current = true;
      claimOnboarding();
    }
  }, [loading, summary, effectiveUserId, user?.id, claimOnboarding]);

  return {
    summary,
    loading,
    claiming,
    claimMilestone,
    claimOnboarding,
    refresh: fetchSummary,
  };
}
