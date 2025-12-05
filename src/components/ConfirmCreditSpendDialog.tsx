import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Coins } from "lucide-react";

interface ConfirmCreditSpendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cost: number;
  currentBalance: number;
  actionLabel: string;
  onConfirm: () => void;
}

export function ConfirmCreditSpendDialog({
  open,
  onOpenChange,
  cost,
  currentBalance,
  actionLabel,
  onConfirm,
}: ConfirmCreditSpendDialogProps) {
  const hasEnoughCredits = currentBalance >= cost;
  const newBalance = currentBalance - cost;
  const creditText = cost === 1 ? "credit" : "credits";

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Spend {creditText}?
          </DialogTitle>
          <DialogDescription className="pt-2">
            {hasEnoughCredits ? (
              <>
                This action will spend{" "}
                <span className="font-semibold text-foreground">{cost} {creditText}</span>{" "}
                from your balance to {actionLabel}.
              </>
            ) : (
              <div className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  You don't have enough credits to complete this action. Please add more credits first.
                </span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current balance:</span>
            <span className="font-medium">{currentBalance} {currentBalance === 1 ? "credit" : "credits"}</span>
          </div>
          {hasEnoughCredits && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">After this action:</span>
              <span className="font-medium">{newBalance} {newBalance === 1 ? "credit" : "credits"}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {hasEnoughCredits ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>
                Yes, spend {cost} {creditText}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => {
                onOpenChange(false);
                window.location.href = "/vendor/credits";
              }}>
                Go to Credits
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
