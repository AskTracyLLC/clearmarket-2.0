/**
 * useOnboardingReward Hook
 * 
 * Manages the onboarding completion reward (5 credits) for reps and vendors.
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
  isComplete: boolean;
  missingRequired: string[];
  alreadyAwarded: boolean;
  loading: boolean;
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
  const hasAttemptedAutoClaimRef = useRef(false);
  const vendorIdRef = useRef<string | null>(null);

  /**
   * Check current onboarding status and whether reward was already claimed
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

        // Check vendor onboarding status from server view
        const { data: vendorStatus, error: statusError } = await supabase
          .from("vendor_onboarding_status")
          .select("is_complete, missing_required")
          .eq("vendor_id", vendorId)
          .maybeSingle();

        if (statusError) {
          console.error("Error checking vendor onboarding status:", statusError);
        }

        // Check if reward was already claimed
        const { data: reward } = await supabase
          .from("onboarding_rewards")
          .select("id")
          .eq("subject_type", "vendor")
          .eq("subject_id", vendorId)
          .eq("reward_key", "onboarding_complete_v1")
          .maybeSingle();

        setStatus({
          isComplete: vendorStatus?.is_complete ?? false,
          missingRequired: vendorStatus?.missing_required ?? [],
          alreadyAwarded: !!reward,
          loading: false,
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
   * Claim the onboarding reward credits
   */
  const claimReward = useCallback(async (): Promise<OnboardingRewardResult> => {
    if (!effectiveUserId || !user?.id) {
      return { awarded: false, credits_awarded: 0, message: "Not authenticated" };
    }

    // Prevent claiming during mimic
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
            description: `5 credits added to your wallet.`,
          });
          // Refresh status
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
            description: `5 credits added to your company wallet.`,
          });
          // Refresh status
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

  // Reset auto-claim flag when user changes
  useEffect(() => {
    hasAttemptedAutoClaimRef.current = false;
    vendorIdRef.current = null;
  }, [effectiveUserId]);

  // Auto-claim when requirements are met (only once)
  useEffect(() => {
    if (
      !status.loading &&
      status.isComplete &&
      !status.alreadyAwarded &&
      !hasAttemptedAutoClaimRef.current &&
      effectiveUserId === user?.id // Only auto-claim for real user, not mimic
    ) {
      hasAttemptedAutoClaimRef.current = true;
      claimReward();
    }
  }, [status, effectiveUserId, user?.id, claimReward]);

  return {
    ...status,
    claiming,
    claimReward,
    refresh: checkStatus,
  };
}
