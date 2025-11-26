import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { US_STATES } from "@/lib/constants";

interface CoverageArea {
  id?: string;
  state_code: string;
  state_name: string;
  county_name: string;
  covers_entire_state: boolean;
  covers_entire_county: boolean;
  base_price: string;
  rush_price: string;
  inspection_types: string[];
}

interface CoverageAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CoverageArea) => void;
  editData?: CoverageArea | null;
}

const INSPECTION_TYPES = [
  "Property Inspections",
  "Loss/Insurance Claims",
  "Commercial",
];

/**
 * Dialog for adding/editing rep coverage areas and pricing.
 * MVP version - state + optional county + pricing + optional inspection type override.
 */
export const CoverageAreaDialog = ({ open, onOpenChange, onSave, editData }: CoverageAreaDialogProps) => {
  const [stateCode, setStateCode] = useState("");
  const [countyName, setCountyName] = useState("");
  const [coversEntireState, setCoversEntireState] = useState(false);
  const [coversEntireCounty, setCoversEntireCounty] = useState(false);
  const [basePrice, setBasePrice] = useState("");
  const [rushPrice, setRushPrice] = useState("");
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([]);
  const [otherInspectionType, setOtherInspectionType] = useState("");

  useEffect(() => {
    if (editData) {
      setStateCode(editData.state_code);
      setCountyName(editData.county_name || "");
      setCoversEntireState(editData.covers_entire_state);
      setCoversEntireCounty(editData.covers_entire_county);
      setBasePrice(editData.base_price || "");
      setRushPrice(editData.rush_price || "");
      
      const types = editData.inspection_types || [];
      const standardTypes = types.filter(t => INSPECTION_TYPES.includes(t));
      const otherTypes = types.filter(t => t.startsWith("Other: "));
      
      setInspectionTypes(standardTypes);
      if (otherTypes.length > 0) {
        setInspectionTypes([...standardTypes, "Other"]);
        setOtherInspectionType(otherTypes[0].replace("Other: ", ""));
      }
    } else {
      resetForm();
    }
  }, [editData, open]);

  const resetForm = () => {
    setStateCode("");
    setCountyName("");
    setCoversEntireState(false);
    setCoversEntireCounty(false);
    setBasePrice("");
    setRushPrice("");
    setInspectionTypes([]);
    setOtherInspectionType("");
  };

  const handleSave = () => {
    if (!stateCode) return;

    const selectedState = US_STATES.find(s => s.value === stateCode);
    if (!selectedState) return;

    // Build inspection_types array
    let finalInspectionTypes = inspectionTypes.filter(t => t !== "Other");
    if (inspectionTypes.includes("Other") && otherInspectionType.trim()) {
      finalInspectionTypes.push(`Other: ${otherInspectionType.trim()}`);
    }

    // Ensure entire_state wins if both are set
    let finalCoversEntireState = coversEntireState;
    let finalCoversEntireCounty = coversEntireCounty;
    if (coversEntireState && coversEntireCounty) {
      finalCoversEntireCounty = false;
    }

    const data: CoverageArea = {
      id: editData?.id,
      state_code: stateCode,
      state_name: selectedState.label,
      county_name: countyName.trim() || "",
      covers_entire_state: finalCoversEntireState,
      covers_entire_county: finalCoversEntireCounty,
      base_price: basePrice.trim(),
      rush_price: rushPrice.trim(),
      inspection_types: finalInspectionTypes.length > 0 ? finalInspectionTypes : [],
    };

    onSave(data);
    onOpenChange(false);
    resetForm();
  };

  const handleInspectionTypeToggle = (type: string) => {
    setInspectionTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? "Edit Coverage Area" : "Add Coverage Area"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* State (required) */}
          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Select value={stateCode} onValueChange={setStateCode}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state..." />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map(state => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.value} - {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Covers Entire State toggle */}
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="covers-entire-state" className="cursor-pointer">
              Covers entire state
            </Label>
            <Switch
              id="covers-entire-state"
              checked={coversEntireState}
              onCheckedChange={setCoversEntireState}
            />
          </div>

          {/* County (optional) */}
          {!coversEntireState && (
            <>
              <div className="space-y-2">
                <Label htmlFor="county">County (optional)</Label>
                <Input
                  id="county"
                  placeholder="e.g., Milwaukee County"
                  value={countyName}
                  onChange={(e) => setCountyName(e.target.value)}
                />
              </div>

              {/* Covers Entire County toggle - only if county is provided */}
              {countyName.trim() && (
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="covers-entire-county" className="cursor-pointer">
                    Covers entire county
                  </Label>
                  <Switch
                    id="covers-entire-county"
                    checked={coversEntireCounty}
                    onCheckedChange={setCoversEntireCounty}
                  />
                </div>
              )}
            </>
          )}

          {/* Base Price */}
          <div className="space-y-2">
            <Label htmlFor="base-price">Base Price (USD, optional)</Label>
            <Input
              id="base-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 150.00"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>

          {/* Rush Price */}
          <div className="space-y-2">
            <Label htmlFor="rush-price">Rush Price (USD, optional)</Label>
            <Input
              id="rush-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 200.00"
              value={rushPrice}
              onChange={(e) => setRushPrice(e.target.value)}
            />
          </div>

          {/* Inspection Types (optional region-specific override) */}
          <div className="space-y-2">
            <Label>Inspection Types for this region (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Leave blank to use your profile-level inspection types.
            </p>
            <div className="space-y-2">
              {INSPECTION_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`inspection-${type}`}
                    checked={inspectionTypes.includes(type)}
                    onCheckedChange={() => handleInspectionTypeToggle(type)}
                  />
                  <Label htmlFor={`inspection-${type}`} className="cursor-pointer font-normal">
                    {type}
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inspection-Other"
                  checked={inspectionTypes.includes("Other")}
                  onCheckedChange={() => handleInspectionTypeToggle("Other")}
                />
                <Label htmlFor="inspection-Other" className="cursor-pointer font-normal">
                  Other
                </Label>
              </div>
              {inspectionTypes.includes("Other") && (
                <Input
                  placeholder="Specify other inspection type"
                  value={otherInspectionType}
                  onChange={(e) => setOtherInspectionType(e.target.value)}
                  className="ml-6"
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!stateCode}>
            Save Coverage Area
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
