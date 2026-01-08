import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { US_STATES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MobileMultiSelect } from "@/components/MobileMultiSelect";

interface VendorCoverageArea {
  id?: string;
  state_code: string;
  state_name: string;
  coverage_mode: "entire_state" | "entire_state_except" | "selected_counties";
  excluded_county_ids?: string[] | null;
  included_county_ids?: string[] | null;
  inspection_types?: string[] | null;
  region_note?: string | null;
}

interface VendorCoverageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: VendorCoverageArea) => void;
  editData?: VendorCoverageArea | null;
  /** Mode: "profile" saves to vendor_coverage_areas, "proposal" returns selection only */
  mode?: "profile" | "proposal";
}

const INSPECTION_TYPES = [
  "Property Inspections",
  "Loss/Insurance Claims",
  "Commercial",
];

/**
 * Dialog for adding/editing vendor coverage areas.
 * Supports: entire state, entire state except counties, or selected counties only.
 */
export const VendorCoverageDialog = ({ open, onOpenChange, onSave, editData, mode = "profile" }: VendorCoverageDialogProps) => {
  const isProposalMode = mode === "proposal";
  const [stateCode, setStateCode] = useState("");
  const [coverageMode, setCoverageMode] = useState<"entire_state" | "entire_state_except" | "selected_counties">("entire_state");
  const [excludedCountyIds, setExcludedCountyIds] = useState<string[]>([]);
  const [includedCountyIds, setIncludedCountyIds] = useState<string[]>([]);
  const [regionNote, setRegionNote] = useState("");
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([]);
  const [otherInspectionType, setOtherInspectionType] = useState("");
  const [counties, setCounties] = useState<Array<{ id: string; county_name: string }>>([]);

  useEffect(() => {
    if (editData) {
      setStateCode(editData.state_code);
      setCoverageMode(editData.coverage_mode || "entire_state");
      setExcludedCountyIds(editData.excluded_county_ids || []);
      setIncludedCountyIds(editData.included_county_ids || []);
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
    setCoverageMode("entire_state");
    setExcludedCountyIds([]);
    setIncludedCountyIds([]);
    setRegionNote("");
    setInspectionTypes([]);
    setOtherInspectionType("");
  };

  const handleSave = () => {
    if (!stateCode) {
      toast.error("Please select a state");
      return;
    }

    // Validate county selections based on mode
    if (coverageMode === "entire_state_except" && excludedCountyIds.length === 0) {
      toast.error("Please select at least one county to exclude");
      return;
    }
    if (coverageMode === "selected_counties" && includedCountyIds.length === 0) {
      toast.error("Please select at least one county to include");
      return;
    }

    const selectedState = US_STATES.find(s => s.value === stateCode);
    if (!selectedState) return;

    // Build inspection_types array
    let finalInspectionTypes = inspectionTypes.filter(t => t !== "Other");
    if (inspectionTypes.includes("Other") && otherInspectionType.trim()) {
      finalInspectionTypes.push(`Other: ${otherInspectionType.trim()}`);
    }

    const data: VendorCoverageArea = {
      id: editData?.id,
      state_code: stateCode,
      state_name: selectedState.label,
      coverage_mode: coverageMode,
      excluded_county_ids: coverageMode === "entire_state_except" ? excludedCountyIds : null,
      included_county_ids: coverageMode === "selected_counties" ? includedCountyIds : null,
      region_note: regionNote.trim() || null,
      inspection_types: finalInspectionTypes.length > 0 ? finalInspectionTypes : null,
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

  const toggleCountySelection = (countyId: string, mode: "exclude" | "include") => {
    if (mode === "exclude") {
      setExcludedCountyIds(prev =>
        prev.includes(countyId) ? prev.filter(id => id !== countyId) : [...prev, countyId]
      );
    } else {
      setIncludedCountyIds(prev =>
        prev.includes(countyId) ? prev.filter(id => id !== countyId) : [...prev, countyId]
      );
    }
  };

  // Convert counties to options format for MobileMultiSelect
  const countyOptions = counties.map(c => ({ id: c.id, label: c.county_name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <DialogHeader>
          <DialogTitle>
            {isProposalMode 
              ? "Add Coverage to Proposal" 
              : editData 
                ? "Edit Coverage Area" 
                : "Add Coverage Area"
            }
          </DialogTitle>
        </DialogHeader>

        {isProposalMode && (
          <Alert className="border-blue-500/30 bg-blue-500/5">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-muted-foreground">
              This selects coverage for the proposal only. It does not change your profile coverage.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6 py-4">
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
            {stateCode && counties.length === 0 && coverageMode !== "entire_state" && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No counties are loaded for this state yet. Please choose another state or contact support.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Coverage Mode (radio) */}
          <div className="space-y-3">
            <Label>Coverage Mode *</Label>
            <RadioGroup value={coverageMode} onValueChange={(v: any) => setCoverageMode(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="entire_state" id="mode-entire" />
                <Label htmlFor="mode-entire" className="font-normal cursor-pointer">
                  Entire state (all counties)
                </Label>
              </div>
              {/* Hide "entire_state_except" in proposal mode */}
              {!isProposalMode && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="entire_state_except" id="mode-except" />
                  <Label htmlFor="mode-except" className="font-normal cursor-pointer">
                    Entire state except specific counties
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="selected_counties" id="mode-selected" />
                <Label htmlFor="mode-selected" className="font-normal cursor-pointer">
                  Only selected counties
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* County Selector - for exclusions */}
          {coverageMode === "entire_state_except" && (
            <div className="space-y-2">
              <Label>Exclude Counties *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select counties where you do NOT place work.
              </p>
              <MobileMultiSelect
                options={countyOptions}
                selectedIds={excludedCountyIds}
                onToggle={(id) => toggleCountySelection(id, "exclude")}
                placeholder={stateCode ? "Select counties to exclude..." : "Select a state first"}
                headerText={`Select counties to exclude (${counties.length} total)`}
                disabled={!stateCode}
                searchPlaceholder="Search counties..."
              />
            </div>
          )}

          {/* County Selector - for inclusions */}
          {coverageMode === "selected_counties" && (
            <div className="space-y-2">
              <Label>Include Counties *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select only the counties where you place work.
              </p>
              <MobileMultiSelect
                options={countyOptions}
                selectedIds={includedCountyIds}
                onToggle={(id) => toggleCountySelection(id, "include")}
                placeholder={stateCode ? "Select counties to include..." : "Select a state first"}
                headerText={`Select counties to include (${counties.length} total)`}
                disabled={!stateCode}
                searchPlaceholder="Search counties..."
              />
            </div>
          )}

          {/* Region Note - hide in proposal mode */}
          {!isProposalMode && (
            <div className="space-y-2">
              <Label htmlFor="region-note">Region notes (optional)</Label>
              <Textarea
                id="region-note"
                placeholder="e.g., Focus on SE Wisconsin / Milwaukee–Racine corridor"
                value={regionNote}
                onChange={(e) => setRegionNote(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Any special notes about this area that would help reps understand your footprint.
              </p>
            </div>
          )}

          {/* Inspection Types - hide in proposal mode */}
          {!isProposalMode && (
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!stateCode}>
            {isProposalMode ? "Add to Proposal" : "Save Coverage Area"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};