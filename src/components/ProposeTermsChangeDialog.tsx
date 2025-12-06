import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface ProposeTermsChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaDescription: string;
  currentRate: number | null;
  currentTurnaround: number | null;
  onSubmit: (data: {
    newRate: number | null;
    newTurnaround: number | null;
    effectiveFrom: string;
    reason: string;
  }) => void;
  isLoading?: boolean;
}

const ProposeTermsChangeDialog: React.FC<ProposeTermsChangeDialogProps> = ({
  open,
  onOpenChange,
  areaDescription,
  currentRate,
  currentTurnaround,
  onSubmit,
  isLoading = false,
}) => {
  const [newRate, setNewRate] = useState<string>(currentRate?.toString() || "");
  const [newTurnaround, setNewTurnaround] = useState<string>(currentTurnaround?.toString() || "");
  const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) return;
    
    onSubmit({
      newRate: newRate ? parseFloat(newRate) : null,
      newTurnaround: newTurnaround ? parseInt(newTurnaround) : null,
      effectiveFrom,
      reason: reason.trim(),
    });
    
    // Reset form
    setReason("");
  };

  const hasRateChange = newRate !== (currentRate?.toString() || "");
  const hasTurnaroundChange = newTurnaround !== (currentTurnaround?.toString() || "");
  const hasAnyChange = hasRateChange || hasTurnaroundChange;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Propose new terms</DialogTitle>
          <DialogDescription>{areaDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current base rate</Label>
              <p className="text-sm font-medium">
                {currentRate !== null ? `$${currentRate}` : "Not set"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Current turnaround</Label>
              <p className="text-sm font-medium">
                {currentTurnaround !== null ? `${currentTurnaround} days` : "Not set"}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-rate">New base rate ($)</Label>
              <Input
                id="new-rate"
                type="number"
                step="0.01"
                min="0"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="Enter new rate"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-turnaround">New turnaround (days)</Label>
              <Input
                id="new-turnaround"
                type="number"
                min="1"
                value={newTurnaround}
                onChange={(e) => setNewTurnaround(e.target.value)}
                placeholder="Enter turnaround days"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effective-from">Effective starting</Label>
              <Input
                id="effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-reason">Reason (required)</Label>
              <Textarea
                id="change-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're proposing this change..."
                rows={3}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!reason.trim() || !hasAnyChange || isLoading}
          >
            {isLoading ? "Submitting..." : "Submit proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProposeTermsChangeDialog;
