/**
 * RepBoostPurchaseDialog
 * 
 * Confirmation dialog for purchasing/extending boost visibility.
 */

import { useState } from "react";
import { Zap, Loader2, AlertCircle, Rocket } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRepCredits } from "@/hooks/useRepCredits";
import { useRepBoostStatus } from "@/hooks/useRepBoostStatus";
import { toast } from "sonner";

interface RepBoostPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RepBoostPurchaseDialog({
  open,
  onOpenChange,
  onSuccess,
}: RepBoostPurchaseDialogProps) {
  const { balance, refresh: refreshCredits } = useRepCredits();
  const { status, purchasing, purchaseBoost, refresh: refreshBoost } = useRepBoostStatus();
  const [error, setError] = useState<string | null>(null);

  const isExtending = status.isBoosted;
  const hasEnoughCredits = (balance ?? 0) >= 2;

  const handlePurchase = async () => {
    setError(null);

    const result = await purchaseBoost();

    if (!result.ok) {
      if (result.error === "INSUFFICIENT_CREDITS") {
        setError("You don't have enough credits. Complete onboarding to earn more!");
      } else if (result.error === "NOT_A_REP") {
        setError("Only field reps can purchase visibility boosts.");
      } else {
        setError(result.error || "Failed to purchase boost. Please try again.");
      }
      return;
    }

    // Success
    await refreshCredits();
    await refreshBoost();

    if (result.ends_at) {
      const endsAtFormatted = format(new Date(result.ends_at), "MMM d 'at' h:mm a");
      toast.success(
        isExtending
          ? `Boost extended! Active until ${endsAtFormatted}`
          : `Boost activated! Active until ${endsAtFormatted}`
      );
    }

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-secondary" />
            {isExtending ? "Extend Boost" : "Boost Visibility"}
          </DialogTitle>
          <DialogDescription>
            {isExtending
              ? "Add another 48 hours to your current boost."
              : "Get featured at the top of vendor search results for 48 hours."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current boost status */}
          {isExtending && status.activeEndsAt && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                <strong>Current boost ends:</strong>{" "}
                {format(new Date(status.activeEndsAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}

          {/* Cost breakdown */}
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Cost</span>
              <span className="font-semibold text-foreground">2 credits</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="font-semibold text-foreground">48 hours</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Your balance</span>
              <span
                className={`font-semibold ${
                  hasEnoughCredits ? "text-foreground" : "text-destructive"
                }`}
              >
                {balance ?? 0} credits
              </span>
            </div>
          </div>

          {/* Benefits */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>✓ Appear at the top of vendor search results</p>
            <p>✓ Works across all areas you cover</p>
            <p>✓ Stack with other boosted reps based on timing</p>
          </div>

          {/* Warning */}
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              Boost is <strong>non-refundable</strong> and does not guarantee work.
              Visibility depends on vendor demand in your areas.
            </AlertDescription>
          </Alert>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={purchasing}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!hasEnoughCredits || purchasing}
            className="gap-2"
          >
            {purchasing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {isExtending ? "Extend for 2 Credits" : "Boost for 2 Credits"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
