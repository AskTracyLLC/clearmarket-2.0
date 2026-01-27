/**
 * useOnboardingReward Hook
 * 
 * Manages the onboarding completion reward for reps and vendors.
 * 
 * Reps: Single tier - 5 credits for completing all required items.
 * Vendors: Two tiers - 2 credits for milestone (profile + verification),
 *          then 3 more for completing all onboarding items (5 total).
 * 
 * Uses server-side views and RPCs to ensure idempotent, auditable credit awards.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole } from "@/hooks/useActiveRole";
import { useMimic } from "@/hooks/useMimic";
import { useToast } from "@/hooks/use-toast";
import { resolveCurrentVendorId } from "@/lib/vendorWallet";

export interface OnboardingRewardStatus {
  // Rep fields (single tier)
  isComplete: boolean;
  missingRequired: string[];
  alreadyAwarded: boolean;
  loading: boolean;
  
  // Vendor tiered fields
  milestoneComplete?: boolean;
  milestoneMissing?: string[];
  milestoneEarned?: boolean;
  milestoneCredits?: number;
  onboardingComplete?: boolean;
  onboardingMissing?: string[];
  onboardingEarned?: boolean;
  onboardingCredits?: number;
  totalEarned?: number;
  totalPossible?: number;
  remaining?: number;
}

export interface OnboardingRewardResult {
  awarded: boolean;
  credits_awarded: number;
  new_balance?: number;
  message: string;
}

export function useOnboardingReward() {
  const { user } = useAuth();
  const { effectiveUserId } = useMimic();
  const { effectiveRole } = useActiveRole();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<OnboardingRewardStatus>({
    isComplete: false,
    missingRequired: [],
    alreadyAwarded: false,
    loading: true,
  });
  const [claiming, setClaiming] = useState(false);
  const hasAttemptedMilestoneClaimRef = useRef(false);
  const hasAttemptedFullClaimRef = useRef(false);
  const vendorIdRef = useRef<string | null>(null);

  /**
   * Check current onboarding status and whether rewards were already claimed
   */
  const checkStatus = useCallback(async () => {
    if (!effectiveUserId) {
      setStatus({ isComplete: false, missingRequired: [], alreadyAwarded: false, loading: false });
      return;
    }

    try {
      if (effectiveRole === "rep") {
        // Check rep onboarding status from server view
        const { data: repStatus, error: statusError } = await supabase
          .from("rep_onboarding_status")
          .select("is_complete, missing_required")
          .eq("rep_user_id", effectiveUserId)
          .maybeSingle();

        if (statusError) {
          console.error("Error checking rep onboarding status:", statusError);
        }

        // Check if reward was already claimed
        const { data: reward } = await supabase
          .from("onboarding_rewards")
          .select("id")
          .eq("subject_type", "rep")
          .eq("subject_id", effectiveUserId)
          .eq("reward_key", "onboarding_complete_v1")
          .maybeSingle();

        setStatus({
          isComplete: repStatus?.is_complete ?? false,
          missingRequired: repStatus?.missing_required ?? [],
          alreadyAwarded: !!reward,
          loading: false,
        });
      } else if (effectiveRole === "vendor") {
        // Resolve vendor_profile.id for the current user
        const vendorId = await resolveCurrentVendorId(effectiveUserId);
        vendorIdRef.current = vendorId;

        if (!vendorId) {
          setStatus({ isComplete: false, missingRequired: [], alreadyAwarded: false, loading: false });
          return;
        }

        // Use the get_vendor_reward_summary RPC for tiered status
        const { data: summary, error: summaryError } = await supabase.rpc(
          "get_vendor_reward_summary",
          { p_vendor_id: vendorId }
        );

        if (summaryError) {
          console.error("Error fetching vendor reward summary:", summaryError);
          setStatus({ isComplete: false, missingRequired: [], alreadyAwarded: false, loading: false });
          return;
        }

        // Handle both direct return and wrapped return
        const s = summary as Record<string, unknown>;

        setStatus({
          // Legacy fields for compatibility
          isComplete: (s.onboarding_complete as boolean) ?? false,
          missingRequired: (s.onboarding_missing as string[]) ?? [],
          alreadyAwarded: ((s.total_earned as number) ?? 0) >= 5,
          loading: false,
          // Vendor tiered fields
          milestoneComplete: (s.milestone_complete as boolean) ?? false,
          milestoneMissing: (s.milestone_missing as string[]) ?? [],
          milestoneEarned: (s.milestone_earned as boolean) ?? false,
          milestoneCredits: (s.milestone_credits as number) ?? 0,
          onboardingComplete: (s.onboarding_complete as boolean) ?? false,
          onboardingMissing: (s.onboarding_missing as string[]) ?? [],
          onboardingEarned: (s.onboarding_earned as boolean) ?? false,
          onboardingCredits: (s.onboarding_credits as number) ?? 0,
          totalEarned: (s.total_earned as number) ?? 0,
          totalPossible: (s.total_possible as number) ?? 5,
          remaining: (s.remaining as number) ?? 5,
        });
      } else {
        setStatus({ isComplete: false, missingRequired: [], alreadyAwarded: false, loading: false });
      }
    } catch (error) {
      console.error("Error checking onboarding reward status:", error);
      setStatus({ isComplete: false, missingRequired: [], alreadyAwarded: false, loading: false });
    }
  }, [effectiveUserId, effectiveRole]);

  /**
   * Claim the vendor milestone reward (2 credits)
   */
  const claimMilestoneReward = useCallback(async (): Promise<OnboardingRewardResult> => {
    if (!effectiveUserId || !user?.id) {
      return { awarded: false, credits_awarded: 0, message: "Not authenticated" };
    }

    if (effectiveUserId !== user.id) {
      return { awarded: false, credits_awarded: 0, message: "Cannot claim rewards while viewing as another user" };
    }

    const vendorId = vendorIdRef.current || await resolveCurrentVendorId(effectiveUserId);
    if (!vendorId) {
      return { awarded: false, credits_awarded: 0, message: "Could not resolve vendor account" };
    }

    setClaiming(true);

    try {
      const { data, error } = await supabase.rpc("award_vendor_profile_verification_credits", {
        p_vendor_id: vendorId,
      });

      if (error) {
        console.error("Error claiming vendor milestone reward:", error);
        return { awarded: false, credits_awarded: 0, message: error.message };
      }

      const result = data as unknown as OnboardingRewardResult;

      if (result.awarded) {
        toast({
          title: "🎉 Milestone Complete!",
          description: `${result.credits_awarded} credits added to your company wallet.`,
        });
        await checkStatus();
      }

      return result;
    } catch (error) {
      console.error("Error claiming milestone reward:", error);
      return { awarded: false, credits_awarded: 0, message: "An error occurred" };
    } finally {
      setClaiming(false);
    }
  }, [effectiveUserId, user?.id, toast, checkStatus]);

  /**
   * Claim the full onboarding reward (rep: 5 credits, vendor: remainder up to 5)
   */
  const claimReward = useCallback(async (): Promise<OnboardingRewardResult> => {
    if (!effectiveUserId || !user?.id) {
      return { awarded: false, credits_awarded: 0, message: "Not authenticated" };
    }

    if (effectiveUserId !== user.id) {
      return { awarded: false, credits_awarded: 0, message: "Cannot claim rewards while viewing as another user" };
    }

    setClaiming(true);

    try {
      if (effectiveRole === "rep") {
        const { data, error } = await supabase.rpc("award_rep_onboarding_credits");

        if (error) {
          console.error("Error claiming rep onboarding reward:", error);
          return { awarded: false, credits_awarded: 0, message: error.message };
        }

        const result = data as unknown as OnboardingRewardResult;

        if (result.awarded) {
          toast({
            title: "🎉 Onboarding Complete!",
            description: `${result.credits_awarded} credits added to your wallet.`,
          });
          await checkStatus();
        }

        return result;
      } else if (effectiveRole === "vendor") {
        const vendorId = vendorIdRef.current || await resolveCurrentVendorId(effectiveUserId);

        if (!vendorId) {
          return { awarded: false, credits_awarded: 0, message: "Could not resolve vendor account" };
        }

        const { data, error } = await supabase.rpc("award_vendor_onboarding_credits", {
          p_vendor_id: vendorId,
        });

        if (error) {
          console.error("Error claiming vendor onboarding reward:", error);
          return { awarded: false, credits_awarded: 0, message: error.message };
        }

        const result = data as unknown as OnboardingRewardResult;

        if (result.awarded) {
          toast({
            title: "🎉 Onboarding Complete!",
            description: `${result.credits_awarded} credits added to your company wallet.`,
          });
          await checkStatus();
        }

        return result;
      }

      return { awarded: false, credits_awarded: 0, message: "Unknown role" };
    } catch (error) {
      console.error("Error claiming onboarding reward:", error);
      return { awarded: false, credits_awarded: 0, message: "An error occurred" };
    } finally {
      setClaiming(false);
    }
  }, [effectiveUserId, effectiveRole, user?.id, toast, checkStatus]);

  // Initial load
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Reset auto-claim flags when user changes
  useEffect(() => {
    hasAttemptedMilestoneClaimRef.current = false;
    hasAttemptedFullClaimRef.current = false;
    vendorIdRef.current = null;
  }, [effectiveUserId]);

  // Auto-claim for reps (single tier)
  useEffect(() => {
    if (
      effectiveRole === "rep" &&
      !status.loading &&
      status.isComplete &&
      !status.alreadyAwarded &&
      !hasAttemptedFullClaimRef.current &&
      effectiveUserId === user?.id
    ) {
      hasAttemptedFullClaimRef.current = true;
      claimReward();
    }
  }, [status, effectiveRole, effectiveUserId, user?.id, claimReward]);

  // Auto-claim for vendors (tiered: milestone first, then full)
  useEffect(() => {
    if (
      effectiveRole === "vendor" &&
      !status.loading &&
      effectiveUserId === user?.id
    ) {
      // Auto-claim milestone if ready and not yet claimed
      if (
        status.milestoneComplete &&
        !status.milestoneEarned &&
        !hasAttemptedMilestoneClaimRef.current
      ) {
        hasAttemptedMilestoneClaimRef.current = true;
        claimMilestoneReward();
      }
      // Auto-claim full onboarding if ready and not yet at max
      else if (
        status.onboardingComplete &&
        (status.remaining ?? 0) > 0 &&
        !hasAttemptedFullClaimRef.current
      ) {
        hasAttemptedFullClaimRef.current = true;
        claimReward();
      }
    }
  }, [status, effectiveRole, effectiveUserId, user?.id, claimMilestoneReward, claimReward]);

  return {
    ...status,
    claiming,
    claimReward,
    claimMilestoneReward,
    refresh: checkStatus,
  };
}
