/**
 * RepTransactionHistoryDialog
 * 
 * Modal showing rep credit transaction history.
 */

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRepCredits, RepWalletTransaction } from "@/hooks/useRepCredits";
import { Loader2 } from "lucide-react";

interface RepTransactionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RepTransactionHistoryDialog({
  open,
  onOpenChange,
}: RepTransactionHistoryDialogProps) {
  const { transactions, balance, loading } = useRepCredits();

  const getTxnLabel = (txnType: string): string => {
    switch (txnType) {
      case "award_profile_pricing":
        return "Profile & Pricing Milestone";
      case "award_rep_onboarding":
        return "Onboarding Complete";
      case "spend_boost_visibility":
        return "Boost Visibility";
      case "admin_adjustment":
        return "Admin Adjustment";
      case "referral_bonus":
        return "Referral Bonus";
      default:
        return txnType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const getDetailsText = (tx: RepWalletTransaction): string => {
    if (!tx.metadata || typeof tx.metadata !== "object" || Array.isArray(tx.metadata)) {
      return "";
    }
    const meta = tx.metadata as Record<string, unknown>;

    if (tx.txn_type === "spend_boost_visibility" && meta.ends_at && typeof meta.ends_at === "string") {
      return `Active until ${format(new Date(meta.ends_at), "MMM d, h:mm a")}`;
    }

    if (meta.reason && typeof meta.reason === "string") return meta.reason;

    return "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Credit History</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No transactions yet.</p>
            <p className="text-sm mt-2">
              Complete your profile and onboarding to earn credits!
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                <div className="col-span-4">Date</div>
                <div className="col-span-5">Action</div>
                <div className="col-span-3 text-right">Amount</div>
              </div>

              {/* Rows */}
              {transactions.map((tx, idx) => {
                // Calculate running balance
                const creditsAfterNewerTx = transactions
                  .slice(0, idx)
                  .reduce((sum, t) => sum + t.delta, 0);
                const balanceAfterThisTx = (balance ?? 0) - creditsAfterNewerTx;

                return (
                  <div
                    key={tx.id}
                    className="grid grid-cols-12 gap-2 px-3 py-2.5 text-sm border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <div className="col-span-4 text-muted-foreground text-xs">
                      {format(new Date(tx.created_at), "MM/dd/yy h:mm a")}
                    </div>
                    <div className="col-span-5">
                      <div className="font-medium text-foreground text-sm">
                        {getTxnLabel(tx.txn_type)}
                      </div>
                      {getDetailsText(tx) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {getDetailsText(tx)}
                        </div>
                      )}
                    </div>
                    <div
                      className={`col-span-3 text-right font-semibold ${
                        tx.delta > 0 ? "text-green-600" : "text-orange-600"
                      }`}
                    >
                      {tx.delta > 0 ? "+" : ""}
                      {tx.delta}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
