import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Coins } from "lucide-react";
import { vendorProposalsCopy as copy } from "@/copy/vendorProposalsCopy";

export type PaidFeatureType = "compare" | "csv_export";

interface ConfirmPaidFeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureType: PaidFeatureType;
  onConfirm: () => void;
  onDontAskAgain?: () => void;
}

export function ConfirmPaidFeatureDialog({
  open,
  onOpenChange,
  featureType,
  onConfirm,
  onDontAskAgain,
}: ConfirmPaidFeatureDialogProps) {
  const [dontAsk, setDontAsk] = useState(false);

  const handleConfirm = () => {
    if (dontAsk && onDontAskAgain) {
      onDontAskAgain();
    }
    onConfirm();
    onOpenChange(false);
  };

  const bodyText =
    featureType === "compare"
      ? copy.confirmCreditUse.compareBody
      : copy.confirmCreditUse.csvBody;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            {copy.confirmCreditUse.title}
          </DialogTitle>
          <DialogDescription className="pt-2">{bodyText}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="dont-ask"
            checked={dontAsk}
            onCheckedChange={(checked) => setDontAsk(!!checked)}
          />
          <Label htmlFor="dont-ask" className="cursor-pointer text-sm">
            {copy.confirmCreditUse.dontAskCheckbox}
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.confirmCreditUse.cancelButton}
          </Button>
          <Button onClick={handleConfirm}>
            {copy.confirmCreditUse.useButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
