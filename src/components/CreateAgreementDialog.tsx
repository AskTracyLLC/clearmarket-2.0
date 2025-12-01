import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface CreateAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repName: string;
  defaultCoverage?: string;
  defaultPricing?: string;
  defaultBaseRate?: number;
  onSave: (data: {
    coverageSummary: string;
    pricingSummary: string;
    baseRate?: number;
    markPostFilled: boolean;
  }) => Promise<void>;
  saving: boolean;
}

export function CreateAgreementDialog({
  open,
  onOpenChange,
  repName,
  defaultCoverage = "",
  defaultPricing = "",
  defaultBaseRate,
  onSave,
  saving,
}: CreateAgreementDialogProps) {
  const [coverageSummary, setCoverageSummary] = useState(defaultCoverage);
  const [pricingSummary, setPricingSummary] = useState(defaultPricing);
  const [baseRate, setBaseRate] = useState(defaultBaseRate?.toString() || "");
  const [markPostFilled, setMarkPostFilled] = useState(false);

  const handleSave = async () => {
    await onSave({
      coverageSummary: coverageSummary.trim(),
      pricingSummary: pricingSummary.trim(),
      baseRate: baseRate ? parseFloat(baseRate) : undefined,
      markPostFilled,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Agreement</DialogTitle>
          <DialogDescription>
            You're about to add this Field Rep to your My Field Reps list with agreed coverage and pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Rep (read-only) */}
          <div className="space-y-2">
            <Label>Field Rep</Label>
            <Input value={repName} disabled className="bg-muted" />
          </div>

          {/* Coverage Summary */}
          <div className="space-y-2">
            <Label htmlFor="coverage">Coverage for this vendor</Label>
            <Textarea
              id="coverage"
              placeholder="Example: IL – Lake & McHenry Counties · WI – Kenosha County"
              value={coverageSummary}
              onChange={(e) => setCoverageSummary(e.target.value)}
              rows={2}
            />
          </div>

          {/* Pricing Summary */}
          <div className="space-y-2">
            <Label htmlFor="pricing">Agreed pricing</Label>
            <Textarea
              id="pricing"
              placeholder="Example: $25 standard exterior · $35 winter check · $50 rush"
              value={pricingSummary}
              onChange={(e) => setPricingSummary(e.target.value)}
              rows={2}
            />
          </div>

          {/* Base Rate (optional) */}
          <div className="space-y-2">
            <Label htmlFor="baseRate">Default base rate (optional)</Label>
            <Input
              id="baseRate"
              type="number"
              step="0.01"
              placeholder="Example: 25.00"
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
            />
          </div>

          {/* Mark Post as Filled */}
          <div className="flex items-start space-x-2 pt-2">
            <Checkbox
              id="markFilled"
              checked={markPostFilled}
              onCheckedChange={(checked) => setMarkPostFilled(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="markFilled"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Mark this Seeking Coverage post as filled
              </Label>
              <p className="text-xs text-muted-foreground">
                The post will be marked as filled and removed from active opportunities.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Agreement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
