import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BatchEditPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (basePrice: string, rushPrice: string) => void;
}

export const BatchEditPricingDialog = ({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: BatchEditPricingDialogProps) => {
  const [basePrice, setBasePrice] = useState("");
  const [rushPrice, setRushPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(basePrice, rushPrice);
    setSaving(false);
    setBasePrice("");
    setRushPrice("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setBasePrice("");
    setRushPrice("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update pricing for selected coverage areas</DialogTitle>
          <DialogDescription>
            You are updating pricing for {selectedCount} coverage area{selectedCount !== 1 ? "s" : ""}.
            Leave a field blank to keep that price unchanged on these areas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="batch-base-price">Base Price ($)</Label>
            <Input
              id="batch-base-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="Leave blank to keep unchanged"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-rush-price">Rush Price ($)</Label>
            <Input
              id="batch-rush-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="Leave blank to keep unchanged"
              value={rushPrice}
              onChange={(e) => setRushPrice(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving || (!basePrice && !rushPrice)}>
            {saving ? "Updating..." : "Update Pricing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
