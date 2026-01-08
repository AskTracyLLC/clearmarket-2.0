import { useCallback, useMemo, useState } from "react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { getVendorCredits, deductVendorCredits } from "@/lib/credits";
import { useAuth } from "@/hooks/useAuth";

type ConsumeResult =
  | { ok: true; reason: "free" | "paid" }
  | { ok: false; reason: "disabled" | "no_credits" | "unauth" | "error"; message: string };

type PaidFeatureOptions = {
  cost?: number;                   // default 1
  actionType?: string;             // e.g. "proposal_csv_export", "proposal_compare_refresh"
  metadata?: Record<string, any>;  // proposal_id, counts, filters, etc.
  isBetaFree?: boolean;            // default true for now
};

export function usePaidFeature(featureKey: string, opts: PaidFeatureOptions = {}) {
  const { flags, loading: flagsLoading, getFlag } = useFeatureFlags();
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [outOfCreditsOpen, setOutOfCreditsOpen] = useState(false);

  const flag = getFlag(featureKey);
  const isEnabled = !!flag?.is_enabled;
  const isPaid = !!flag?.is_paid;

  const cost = opts.cost ?? 1;
  const isBetaFree = opts.isBetaFree ?? true;

  const betaNote = flag?.beta_note ?? "Free during beta testing. This will use credits after launch.";

  const loadCredits = useCallback(async () => {
    if (!user?.id) return null;
    const bal = await getVendorCredits(user.id);
    setCredits(bal ?? 0);
    return bal ?? 0;
  }, [user?.id]);

  const canUse = useMemo(() => {
    if (!isEnabled) return false;
    if (!isPaid) return true;          // free feature
    if (isBetaFree) return true;       // paid, but free during beta
    if (credits === null) return true; // unknown yet; we'll verify on consume
    return credits >= cost;
  }, [isEnabled, isPaid, isBetaFree, credits, cost]);

  const consume = useCallback(async (): Promise<ConsumeResult> => {
    if (!isEnabled) {
      return { ok: false, reason: "disabled", message: "Feature disabled." };
    }

    // Free feature or free during beta
    if (!isPaid || isBetaFree) {
      return { ok: true, reason: "free" };
    }

    if (!user?.id) {
      return { ok: false, reason: "unauth", message: "Not authenticated." };
    }

    setBusy(true);
    try {
      const bal = credits ?? (await loadCredits());
      if ((bal ?? 0) < cost) {
        setOutOfCreditsOpen(true);
        return { ok: false, reason: "no_credits", message: "Not enough credits." };
      }

      // Atomic deduct via RPC wrapper + transaction log
      const result = await deductVendorCredits(
        user.id,
        cost,
        opts.actionType ?? featureKey,
        opts.metadata ?? {}
      );

      if (!result.success) {
        const msg = result.error ?? "Credit deduction failed.";
        if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("credits")) {
          setOutOfCreditsOpen(true);
          return { ok: false, reason: "no_credits", message: msg };
        }
        return { ok: false, reason: "error", message: msg };
      }

      // Refresh local balance
      const newBal = await getVendorCredits(user.id);
      setCredits(newBal ?? 0);

      return { ok: true, reason: "paid" };
    } catch (e: any) {
      const msg = e?.message ?? "Credit deduction failed.";
      if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("credits")) {
        setOutOfCreditsOpen(true);
        return { ok: false, reason: "no_credits", message: msg };
      }
      return { ok: false, reason: "error", message: msg };
    } finally {
      setBusy(false);
    }
  }, [isEnabled, isPaid, isBetaFree, credits, cost, featureKey, user?.id, loadCredits, opts.actionType, opts.metadata]);

  return {
    isEnabled,
    isPaid,
    isBetaFree,
    betaNote,
    cost,
    credits,
    canUse,
    busy: busy || flagsLoading,
    outOfCreditsOpen,
    setOutOfCreditsOpen,
    refreshCredits: loadCredits,
    consume,
  };
}
