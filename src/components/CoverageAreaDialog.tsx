import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { US_STATES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface CoverageArea {
  id?: string;
  state_code: string;
  state_name: string;
  county_name: string;
  county_id: string | null;
  covers_entire_state: boolean;
  covers_entire_county: boolean;
  base_price: string;
  rush_price: string;
  inspection_types: string[];
  region_note: string;
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
  const [countyId, setCountyId] = useState<string | null>(null);
  const [countyName, setCountyName] = useState("");
  const [coversEntireState, setCoversEntireState] = useState(false);
  const [coversEntireCounty, setCoversEntireCounty] = useState(false);
  const [basePrice, setBasePrice] = useState("");
  const [rushPrice, setRushPrice] = useState("");
  const [regionNote, setRegionNote] = useState("");
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([]);
  const [otherInspectionType, setOtherInspectionType] = useState("");
  const [counties, setCounties] = useState<Array<{ id: string; county_name: string }>>([]);

  useEffect(() => {
    if (editData) {
      setStateCode(editData.state_code);
      setCountyId(editData.county_id || null);
      setCountyName(editData.county_name || "");
      setCoversEntireState(editData.covers_entire_state);
      setCoversEntireCounty(editData.covers_entire_county);
      setBasePrice(editData.base_price || "");
      setRushPrice(editData.rush_price || "");
      setRegionNote(editData.region_note || "");
      
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

  // Fetch counties when state changes
  useEffect(() => {
    const fetchCounties = async () => {
      if (!stateCode) {
        setCounties([]);
        return;
      }

      const { data, error } = await supabase
        .from("us_counties")
        .select("id, county_name")
        .eq("state_code", stateCode)
        .order("county_name");

      if (error) {
        console.error("Error fetching counties:", error);
        setCounties([]);
      } else {
        setCounties(data || []);
      }
    };

    fetchCounties();
  }, [stateCode]);

  const resetForm = () => {
    setStateCode("");
    setCountyId(null);
    setCountyName("");
    setCoversEntireState(false);
    setCoversEntireCounty(false);
    setBasePrice("");
    setRushPrice("");
    setRegionNote("");
    setInspectionTypes([]);
    setOtherInspectionType("");
  };

  const handleSave = () => {
    if (!stateCode) {
      toast.error("Please select a state");
      return;
    }

    // Validate county requirement when covers_entire_state is OFF
    if (!coversEntireState && !countyId) {
      toast.error("Please select a county or turn on 'Covers entire state'");
      return;
    }

    // Validate base_price requirement
    if (!basePrice || parseFloat(basePrice) <= 0) {
      toast.error("Base Rate is required and must be greater than 0");
      return;
    }

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

    // Convert pricing values to strings, handling numeric inputs
    const basePriceStr = basePrice ? String(basePrice).trim() : "";
    const rushPriceStr = rushPrice ? String(rushPrice).trim() : "";

    const data: CoverageArea = {
      id: editData?.id,
      state_code: stateCode,
      state_name: selectedState.label,
      county_name: countyName || "",
      county_id: countyId,
      covers_entire_state: finalCoversEntireState,
      covers_entire_county: finalCoversEntireCounty,
      base_price: basePriceStr,
      rush_price: rushPriceStr,
      region_note: regionNote.trim(),
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

          {/* County dropdown - validated */}
          {!coversEntireState && (
            <>
              <div className="space-y-2">
                <Label htmlFor="county">County *</Label>
                <Select 
                  value={countyId || ""} 
                  onValueChange={(value) => {
                    setCountyId(value);
                    const selected = counties.find(c => c.id === value);
                    setCountyName(selected?.county_name || "");
                  }}
                  disabled={!stateCode}
                >
                  <SelectTrigger id="county">
                    <SelectValue placeholder={stateCode ? "Select county..." : "Select a state first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {counties.length > 0 ? (
                      counties.map(county => (
                        <SelectItem key={county.id} value={county.id}>
                          {county.county_name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        No counties available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                
                {stateCode && counties.length === 0 && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No counties are loaded for this state yet. Please choose another state or contact support.
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Legacy county warning */}
                {editData && !countyId && countyName && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">
                    ⚠️ This county was saved before validation existed. Please pick the closest match from the list to clean it up.
                  </p>
                )}
              </div>

              {/* Covers Entire County toggle - only if county is selected */}
              {countyId && (
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
            <Label htmlFor="base-price">Base Rate (USD) *</Label>
            <Input
              id="base-price"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g., 35.00"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your Base Rate is the minimum you're willing to accept per inspection in this county. 
              Vendors whose rates fall below this will not see you as a match.
            </p>
          </div>

          {/* Rush Price */}
          <div className="space-y-2">
            <Label htmlFor="rush-price">Rush Rate (USD, optional)</Label>
            <Input
              id="rush-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g., 50.00"
              value={rushPrice}
              onChange={(e) => setRushPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional higher rate for rush work (stored for future use).
            </p>
          </div>

          {/* Region Note */}
          <div className="space-y-2">
            <Label htmlFor="region-note">Region notes (optional)</Label>
            <Input
              id="region-note"
              placeholder="Any special notes about this area (optional)"
              value={regionNote}
              onChange={(e) => setRegionNote(e.target.value)}
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
