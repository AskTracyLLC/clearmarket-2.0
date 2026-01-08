import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { getVendorCredits, deductVendorCredits } from "@/lib/credits";
import { ConfirmPaidFeatureDialog, PaidFeatureType } from "@/components/ConfirmPaidFeatureDialog";
import { OutOfCreditsDialog } from "@/components/OutOfCreditsDialog";

// Feature flag keys for proposal paid features
export const PROPOSAL_COMPARE_KEY = "proposal_compare";
export const PROPOSAL_CSV_EXPORT_KEY = "proposal_csv_export";

interface UsePaidFeatureResult {
  /** Execute a paid feature action with credit gating (beta free override) */
  executePaidAction: (
    featureType: PaidFeatureType,
    action: () => Promise<void> | void
  ) => Promise<boolean>;
  /** Dialogs to render */
  PaidFeatureDialogs: React.ReactNode;
}

export function usePaidFeature(): UsePaidFeatureResult {
  const { user } = useAuth();
  const { isPaid, loading: flagsLoading } = useFeatureFlags();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);
  const [currentFeatureType, setCurrentFeatureType] = useState<PaidFeatureType>("compare");
  const [pendingAction, setPendingAction] = useState<(() => Promise<void> | void) | null>(null);
  
  // Session-level "don't ask again" flags
  const [skipConfirmCompare, setSkipConfirmCompare] = useState(false);
  const [skipConfirmCsv, setSkipConfirmCsv] = useState(false);

  const getFeatureKey = (type: PaidFeatureType): string => {
    return type === "compare" ? PROPOSAL_COMPARE_KEY : PROPOSAL_CSV_EXPORT_KEY;
  };

  const executePaidAction = useCallback(
    async (
      featureType: PaidFeatureType,
      action: () => Promise<void> | void
    ): Promise<boolean> => {
      if (!user) return false;

      // Check if this feature is flagged as paid
      const featureKey = getFeatureKey(featureType);
      const featureIsPaid = isPaid(featureKey);

      // BETA FREE OVERRIDE: If not flagged as paid, or flags still loading, allow free usage
      if (flagsLoading || !featureIsPaid) {
        await action();
        return true;
      }

      // Check user's current credit balance
      const balance = await getVendorCredits(user.id);
      const currentBalance = balance ?? 0;

      if (currentBalance < 1) {
        setOutOfCreditsOpen(true);
        return false;
      }

      // Check if user opted to skip confirmation for this session
      const skipConfirm =
        featureType === "compare" ? skipConfirmCompare : skipConfirmCsv;

      if (skipConfirm) {
        // Deduct credit and execute
        const result = await deductVendorCredits(user.id, 1, featureKey, {
          feature: featureType,
        });
        if (result.success) {
          await action();
          return true;
        } else {
          setOutOfCreditsOpen(true);
          return false;
        }
      }

      // Show confirmation dialog
      setCurrentFeatureType(featureType);
      setPendingAction(() => action);
      setConfirmOpen(true);

      return false; // Will be handled by dialog callback
    },
    [user, isPaid, flagsLoading, skipConfirmCompare, skipConfirmCsv]
  );

  const handleConfirm = useCallback(async () => {
    if (!user || !pendingAction) return;

    const featureKey = getFeatureKey(currentFeatureType);

    // Deduct credit
    const result = await deductVendorCredits(user.id, 1, featureKey, {
      feature: currentFeatureType,
    });

    if (result.success) {
      await pendingAction();
    }

    setPendingAction(null);
    setConfirmOpen(false);
  }, [user, pendingAction, currentFeatureType]);

  const handleDontAskAgain = useCallback(() => {
    if (currentFeatureType === "compare") {
      setSkipConfirmCompare(true);
    } else {
      setSkipConfirmCsv(true);
    }
  }, [currentFeatureType]);

  const PaidFeatureDialogs = (
    <>
      <ConfirmPaidFeatureDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPendingAction(null);
        }}
        featureType={currentFeatureType}
        onConfirm={handleConfirm}
        onDontAskAgain={handleDontAskAgain}
      />
      <OutOfCreditsDialog
        open={outOfCreditsOpen}
        onOpenChange={setOutOfCreditsOpen}
      />
    </>
  );

  return {
    executePaidAction,
    PaidFeatureDialogs,
  };
}
