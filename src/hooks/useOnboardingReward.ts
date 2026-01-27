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
import { VENDOR_BETA_ONBOARDING_TEMPLATE_ID } from "@/lib/checklistOwnerResolver";

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

/**
 * Verify vendor checklist completion by checking actual checklist items
 * Returns true if all required items are completed
 */
async function verifyVendorChecklistComplete(ownerUserId: string): Promise<{ complete: boolean; stepsRemaining: number }> {
  try {
    // Get the vendor onboarding assignment for the owner
    const { data: assignment } = await supabase
      .from("user_checklist_assignments")
      .select("id")
      .eq("user_id", ownerUserId)
      .eq("template_id", VENDOR_BETA_ONBOARDING_TEMPLATE_ID)
      .maybeSingle();

    if (!assignment) {
      return { complete: false, stepsRemaining: -1 };
    }

    // Get all required checklist items for this template
    const { data: requiredItems } = await supabase
      .from("checklist_items")
      .select("id")
      .eq("template_id", VENDOR_BETA_ONBOARDING_TEMPLATE_ID)
      .eq("is_required", true);

    if (!requiredItems || requiredItems.length === 0) {
      return { complete: true, stepsRemaining: 0 };
    }

    const requiredItemIds = requiredItems.map(i => i.id);

    // Get user's completion status for required items
    const { data: userItems } = await supabase
      .from("user_checklist_items")
      .select("item_id, status")
      .eq("assignment_id", assignment.id)
      .in("item_id", requiredItemIds);

    const completedCount = (userItems || []).filter(ui => ui.status === "completed").length;
    const stepsRemaining = requiredItems.length - completedCount;

    return {
      complete: completedCount === requiredItems.length,
      stepsRemaining,
    };
  } catch (error) {
    console.error("Error verifying vendor checklist completion:", error);
    return { complete: false, stepsRemaining: -1 };
  }
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

        // Check onboarding_rewards using vendor_id as subject_id (NOT user_id)
        const { data: existingRewards } = await supabase
          .from("onboarding_rewards")
          .select("reward_key, credits_awarded")
          .eq("subject_type", "vendor")
          .eq("subject_id", vendorId);

        // Check for milestone reward
        const milestoneReward = existingRewards?.find(r => r.reward_key === "vendor_profile_verification_v1");
        
        // Check for full onboarding reward - support both legacy and current keys
        // DB currently uses "onboarding_complete_v1", but also support "vendor_onboarding_complete_v1" as alias
        const onboardingReward = existingRewards?.find(r => 
          r.reward_key === "onboarding_complete_v1" || 
          r.reward_key === "vendor_onboarding_complete_v1"
        );
        
        // If full onboarding was earned, both tiers are complete
        const fullOnboardingEarned = !!onboardingReward;
        const milestoneAlreadyEarned = !!milestoneReward || fullOnboardingEarned;
        const totalAlreadyEarned = (milestoneReward?.credits_awarded ?? 0) + (onboardingReward?.credits_awarded ?? 0);

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

        // Override earned flags with actual onboarding_rewards truth
        const computedMilestoneEarned = milestoneAlreadyEarned;
        const computedOnboardingEarned = fullOnboardingEarned;
        const computedTotalEarned = Math.max(totalAlreadyEarned, (s.total_earned as number) ?? 0);
        const computedRemaining = Math.max(0, 5 - computedTotalEarned);

        setStatus({
          // Legacy fields for compatibility
          isComplete: (s.onboarding_complete as boolean) ?? false,
          missingRequired: (s.onboarding_missing as string[]) ?? [],
          alreadyAwarded: computedTotalEarned >= 5,
          loading: false,
          // Vendor tiered fields - use DB truth for earned flags
          milestoneComplete: (s.milestone_complete as boolean) ?? false,
          milestoneMissing: (s.milestone_missing as string[]) ?? [],
          milestoneEarned: computedMilestoneEarned,
          milestoneCredits: milestoneReward?.credits_awarded ?? (s.milestone_credits as number) ?? 0,
          onboardingComplete: (s.onboarding_complete as boolean) ?? false,
          onboardingMissing: (s.onboarding_missing as string[]) ?? [],
          onboardingEarned: computedOnboardingEarned,
          onboardingCredits: onboardingReward?.credits_awarded ?? (s.onboarding_credits as number) ?? 0,
          totalEarned: computedTotalEarned,
          totalPossible: (s.total_possible as number) ?? 5,
          remaining: computedRemaining,
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

    // Check if already earned before attempting claim
    if (status.milestoneEarned) {
      toast({
        title: "Credits already claimed",
        description: "You've already earned the milestone reward.",
        variant: "default",
      });
      return { awarded: false, credits_awarded: 0, message: "Credits already claimed" };
    }

    setClaiming(true);

    try {
      const { data, error } = await supabase.rpc("award_vendor_profile_verification_credits", {
        p_vendor_id: vendorId,
      });

      if (error) {
        console.error("Error claiming vendor milestone reward:", error);
        toast({
          title: "Failed to claim reward",
          description: error.message,
          variant: "destructive",
        });
        return { awarded: false, credits_awarded: 0, message: error.message };
      }

      const result = data as unknown as OnboardingRewardResult;

      if (result.awarded) {
        toast({
          title: "🎉 Milestone Complete!",
          description: `${result.credits_awarded} credits added to your company wallet.`,
        });
        await checkStatus();
      } else {
        // RPC returned not awarded (likely already claimed)
        toast({
          title: "Credits already claimed",
          description: result.message || "You've already earned this reward.",
          variant: "default",
        });
      }

      return result;
    } catch (error) {
      console.error("Error claiming milestone reward:", error);
      toast({
        title: "Failed to claim reward",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
      return { awarded: false, credits_awarded: 0, message: "An error occurred" };
    } finally {
      setClaiming(false);
    }
  }, [effectiveUserId, user?.id, toast, checkStatus, status.milestoneEarned]);

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

    // Check if already fully earned before attempting claim
    if (status.alreadyAwarded || (effectiveRole === "vendor" && status.onboardingEarned)) {
      toast({
        title: "Credits already claimed",
        description: "You've already earned the full onboarding reward.",
        variant: "default",
      });
      return { awarded: false, credits_awarded: 0, message: "Credits already claimed" };
    }

    setClaiming(true);

    try {
      if (effectiveRole === "rep") {
        const { data, error } = await supabase.rpc("award_rep_onboarding_credits");

        if (error) {
          console.error("Error claiming rep onboarding reward:", error);
          toast({
            title: "Failed to claim reward",
            description: error.message,
            variant: "destructive",
          });
          return { awarded: false, credits_awarded: 0, message: error.message };
        }

        const result = data as unknown as OnboardingRewardResult;

        if (result.awarded) {
          toast({
            title: "🎉 Onboarding Complete!",
            description: `${result.credits_awarded} credits added to your wallet.`,
          });
          await checkStatus();
        } else {
          toast({
            title: "Credits already claimed",
            description: result.message || "You've already earned this reward.",
            variant: "default",
          });
        }

        return result;
      } else if (effectiveRole === "vendor") {
        const vendorId = vendorIdRef.current || await resolveCurrentVendorId(effectiveUserId);

        if (!vendorId) {
          return { awarded: false, credits_awarded: 0, message: "Could not resolve vendor account" };
        }

        // GATING: Verify actual checklist completion before awarding
        const checklistVerification = await verifyVendorChecklistComplete(effectiveUserId);
        
        if (!checklistVerification.complete) {
          const message = checklistVerification.stepsRemaining > 0
            ? `Finish all required onboarding steps to claim this bonus. (${checklistVerification.stepsRemaining} remaining)`
            : "Finish all required onboarding steps to claim this bonus.";
          
          toast({
            title: "Cannot claim yet",
            description: message,
            variant: "destructive",
          });
          setClaiming(false);
          return { awarded: false, credits_awarded: 0, message };
        }

        const { data, error } = await supabase.rpc("award_vendor_onboarding_credits", {
          p_vendor_id: vendorId,
        });

        if (error) {
          console.error("Error claiming vendor onboarding reward:", error);
          toast({
            title: "Failed to claim reward",
            description: error.message,
            variant: "destructive",
          });
          return { awarded: false, credits_awarded: 0, message: error.message };
        }

        const result = data as unknown as OnboardingRewardResult;

        if (result.awarded) {
          toast({
            title: "🎉 Onboarding Complete!",
            description: `${result.credits_awarded} credits added to your company wallet.`,
          });
          await checkStatus();
        } else {
          toast({
            title: "Credits already claimed",
            description: result.message || "You've already earned this reward.",
            variant: "default",
          });
        }

        return result;
      }

      return { awarded: false, credits_awarded: 0, message: "Unknown role" };
    } catch (error) {
      console.error("Error claiming onboarding reward:", error);
      toast({
        title: "Failed to claim reward",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
      return { awarded: false, credits_awarded: 0, message: "An error occurred" };
    } finally {
      setClaiming(false);
    }
  }, [effectiveUserId, effectiveRole, user?.id, toast, checkStatus, status.alreadyAwarded, status.onboardingEarned]);

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
  // NOTE: Full onboarding auto-claim now gated by verifyVendorChecklistComplete in claimReward
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
      // The actual checklist verification happens inside claimReward
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
