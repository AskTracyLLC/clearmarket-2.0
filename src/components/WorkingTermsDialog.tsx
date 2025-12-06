import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const INSPECTION_TYPES = [
  { id: "property", label: "Property Inspections" },
  { id: "loss_claims", label: "Loss / Insurance Claims (appointment-based / direct contact)" },
  { id: "commercial", label: "Commercial" },
  { id: "other", label: "Other" },
];

export interface WorkingTerms {
  inspection_types_covered: string[];
  typical_rate: number | null;
  target_turnaround_days: number | null;
  additional_expectations: string;
}

interface WorkingTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreementId: string;
  coverageDisplay: string;
  existingTerms?: WorkingTerms | null;
  onSaved: () => void;
}

const WorkingTermsDialog: React.FC<WorkingTermsDialogProps> = ({
  open,
  onOpenChange,
  agreementId,
  coverageDisplay,
  existingTerms,
  onSaved,
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([]);
  const [typicalRate, setTypicalRate] = useState("");
  const [turnaroundDays, setTurnaroundDays] = useState("");
  const [additionalExpectations, setAdditionalExpectations] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (open) {
      if (existingTerms) {
        setInspectionTypes(existingTerms.inspection_types_covered || []);
        setTypicalRate(existingTerms.typical_rate?.toString() || "");
        setTurnaroundDays(existingTerms.target_turnaround_days?.toString() || "");
        setAdditionalExpectations(existingTerms.additional_expectations || "");
      } else {
        setInspectionTypes([]);
        setTypicalRate("");
        setTurnaroundDays("");
        setAdditionalExpectations("");
      }
      setValidationError("");
    }
  }, [open, existingTerms]);

  const toggleInspectionType = (typeId: string) => {
    setInspectionTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((t) => t !== typeId)
        : [...prev, typeId]
    );
    setValidationError("");
  };

  const handleSave = async () => {
    if (inspectionTypes.length === 0) {
      setValidationError("Please select at least one inspection type.");
      return;
    }

    setSaving(true);
    try {
      const workingTermsData = {
        inspection_types_covered: inspectionTypes,
        typical_rate: typicalRate ? parseFloat(typicalRate) : null,
        target_turnaround_days: turnaroundDays ? parseInt(turnaroundDays, 10) : null,
        additional_expectations: additionalExpectations.trim(),
      };

      const { error } = await supabase
        .from("vendor_rep_agreements")
        .update({ working_terms: workingTermsData })
        .eq("id", agreementId);

      if (error) throw error;

      toast({ title: "Working terms saved" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error saving working terms:", err);
      toast({
        title: "Error saving working terms",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Working Terms for This Connection</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            These details help you and your network partner stay on the same page about coverage, pricing, and timing.
            <br />
            <span className="text-xs italic">
              They are for reference only and do not create an employment relationship, contract, or guarantee of work.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Coverage Area (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Coverage area</Label>
            <div className="text-sm text-foreground bg-muted/50 rounded-md px-3 py-2">
              {coverageDisplay || "Not specified"}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on the coverage you've set in your profile. (To change it, edit your coverage areas.)
            </p>
          </div>

          {/* Inspection Types Covered (REQUIRED) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Inspection types covered by these terms <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              {INSPECTION_TYPES.map((type) => (
                <div key={type.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`type-${type.id}`}
                    checked={inspectionTypes.includes(type.id)}
                    onCheckedChange={() => toggleInspectionType(type.id)}
                  />
                  <label
                    htmlFor={`type-${type.id}`}
                    className="text-sm cursor-pointer leading-tight"
                  >
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Select at least one inspection type this connection typically handles in this area.
              Property Inspections are the standard drive-by / exterior style checks.
              Loss / Insurance Claims are appointment-based, direct-contact inspections that often pay higher.
            </p>
          </div>

          {/* Typical Rate */}
          <div className="space-y-1.5">
            <Label htmlFor="typical-rate" className="text-sm font-medium">
              Typical rate for this work
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <Input
                id="typical-rate"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={typicalRate}
                onChange={(e) => setTypicalRate(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">per inspection</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This is the usual base rate you expect for the inspection types selected above in this area.
              If Loss Drafts or other work pay differently, you can note that below in Additional expectations.
            </p>
          </div>

          {/* Target Turnaround */}
          <div className="space-y-1.5">
            <Label htmlFor="turnaround" className="text-sm font-medium">
              Target turnaround
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="turnaround"
                type="number"
                min="1"
                placeholder="3"
                value={turnaroundDays}
                onChange={(e) => setTurnaroundDays(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">days from assignment</span>
            </div>
            <p className="text-xs text-muted-foreground">
              How quickly you typically aim to complete work in this area. Vendors may still set specific due dates on each order.
            </p>
          </div>

          {/* Additional Expectations */}
          <div className="space-y-1.5">
            <Label htmlFor="additional" className="text-sm font-medium">
              Additional expectations (optional)
            </Label>
            <Textarea
              id="additional"
              rows={3}
              placeholder='e.g. "Loss Drafts are billed at a higher rate than standard property inspections," "Rush jobs must be requested in advance," "No roof photos during active storms," etc.'
              value={additionalExpectations}
              onChange={(e) => setAdditionalExpectations(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use this for any extra notes about communication, travel limits, or special conditions, including different rates for Loss Drafts vs standard property inspections.
            </p>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
          By saving, you confirm these are your current working expectations for this connection.
          They are informational only and do not replace any separate written agreements or create an employer–employee relationship.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save working terms"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkingTermsDialog;
