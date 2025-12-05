import { useState, useCallback, useRef } from "react";
import { ConfirmCreditSpendDialog } from "@/components/ConfirmCreditSpendDialog";
import { getVendorCredits } from "@/lib/credits";
import { useAuth } from "@/hooks/useAuth";

interface ConfirmCreditSpendOptions {
  cost: number;
  actionLabel: string;
}

export function useCreditConfirm() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProps, setDialogProps] = useState<{
    cost: number;
    currentBalance: number;
    actionLabel: string;
  } | null>(null);

  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirmCreditSpend = useCallback(
    async (options: ConfirmCreditSpendOptions): Promise<boolean> => {
      if (!user) return false;

      // Fetch current balance
      const balance = await getVendorCredits(user.id);
      const currentBalance = balance ?? 0;

      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setDialogProps({
          cost: options.cost,
          currentBalance,
          actionLabel: options.actionLabel,
        });
        setDialogOpen(true);
      });
    },
    [user]
  );

  const handleConfirm = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open && resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  }, []);

  const CreditConfirmDialog = dialogProps ? (
    <ConfirmCreditSpendDialog
      open={dialogOpen}
      onOpenChange={handleOpenChange}
      cost={dialogProps.cost}
      currentBalance={dialogProps.currentBalance}
      actionLabel={dialogProps.actionLabel}
      onConfirm={handleConfirm}
    />
  ) : null;

  return {
    confirmCreditSpend,
    CreditConfirmDialog,
  };
}
