import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { US_STATES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, ChevronDown, AlertCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchInspectionTypesForRole, InspectionTypeOption } from "@/lib/inspectionTypes";
import { coveragePricingCopy } from "@/copy/coveragePricingCopy";

export type CoverageMode = "entire_state" | "entire_state_except" | "selected_counties";

export interface CoverageArea {
  id?: string;
  state_code: string;
  state_name: string;
  coverage_mode: CoverageMode;
  county_name?: string;
  county_id?: string | null;
  excluded_county_ids?: string[];
  included_county_ids?: string[];
  covers_entire_state?: boolean;
  covers_entire_county?: boolean;
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
  /** The rep's profile-level inspection types (labels) to filter available options */
  profileInspectionTypes?: string[];
}

/**
 * Dialog for adding/editing rep coverage areas and pricing.
 * Supports: entire state, entire state except counties, or selected counties only.
 * Shows detailed inspection types filtered by what the rep has selected on their profile.
 */
export const CoverageAreaDialog = ({ open, onOpenChange, onSave, editData, profileInspectionTypes = [] }: CoverageAreaDialogProps) => {
  const [stateCode, setStateCode] = useState("");
  const [coverageMode, setCoverageMode] = useState<CoverageMode>("entire_state");
  const [excludedCountyIds, setExcludedCountyIds] = useState<string[]>([]);
  const [includedCountyIds, setIncludedCountyIds] = useState<string[]>([]);
  const [basePrice, setBasePrice] = useState("");
  const [rushPrice, setRushPrice] = useState("");
  const [regionNote, setRegionNote] = useState("");
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([]);
  const [counties, setCounties] = useState<Array<{ id: string; county_name: string }>>([]);
  const [countySearchOpen, setCountySearchOpen] = useState(false);
  
  // All inspection type options grouped by category
  const [allInspectionTypesByCategory, setAllInspectionTypesByCategory] = useState<Record<string, InspectionTypeOption[]>>({});
  // Track removed types that were saved in coverage but no longer in profile
  const [removedTypes, setRemovedTypes] = useState<string[]>([]);

  // For edit mode - single county editing
  const isEditingSingleRow = !!editData?.id;

  // Fetch all inspection type options from database
  useEffect(() => {
    const loadInspectionTypes = async () => {
      const grouped = await fetchInspectionTypesForRole('rep');
      setAllInspectionTypesByCategory(grouped);
    };
    loadInspectionTypes();
  }, []);

  // Filter inspection types to only show those the rep has selected on their profile
  const availableInspectionTypesByCategory = useMemo(() => {
    const result: Record<string, InspectionTypeOption[]> = {};
    
    for (const [category, types] of Object.entries(allInspectionTypesByCategory)) {
      // Filter types that match the rep's profile-level selections (by label)
      const matchingTypes = types.filter(t => 
        profileInspectionTypes.some(pt => 
          pt === t.label || 
          pt.toLowerCase() === t.label.toLowerCase() ||
          pt.startsWith("Other:") // Keep "Other:" types for handling later
        )
      );
      
      if (matchingTypes.length > 0) {
        result[category] = matchingTypes;
      }
    }
    
    return result;
  }, [allInspectionTypesByCategory, profileInspectionTypes]);

  // Check for "Other" types from profile
  const profileOtherTypes = useMemo(() => {
    return profileInspectionTypes.filter(t => t.startsWith("Other:"));
  }, [profileInspectionTypes]);

  useEffect(() => {
    if (editData) {
      setStateCode(editData.state_code);
      setCoverageMode(editData.coverage_mode || "selected_counties");
      setExcludedCountyIds(editData.excluded_county_ids || []);
      setIncludedCountyIds(editData.included_county_ids || (editData.county_id ? [editData.county_id] : []));
      setBasePrice(editData.base_price || "");
      setRushPrice(editData.rush_price || "");
      setRegionNote(editData.region_note || "");
      
      const savedTypes = editData.inspection_types || [];
      
      // Find any saved types that are no longer in the profile
      const allAvailableLabels = Object.values(availableInspectionTypesByCategory)
        .flat()
        .map(t => t.label);
      const allProfileLabels = [...allAvailableLabels, ...profileOtherTypes];
      
      const removed = savedTypes.filter(t => !allProfileLabels.includes(t) && !t.startsWith("Other:"));
      setRemovedTypes(removed);
      
      // Only keep types that are still available
      const validTypes = savedTypes.filter(t => 
        allProfileLabels.includes(t) || profileOtherTypes.includes(t)
      );
      setInspectionTypes(validTypes);
    } else {
      resetForm();
    }
  }, [editData, open, availableInspectionTypesByCategory, profileOtherTypes]);

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
    setBasePrice("");
    setRushPrice("");
    setRegionNote("");
    setInspectionTypes([]);
    setRemovedTypes([]);
  };

  const handleSave = () => {
    if (!stateCode) {
      toast.error(coveragePricingCopy.validation.missingState);
      return;
    }

    // Validate base_price requirement
    if (!basePrice || parseFloat(basePrice) <= 0) {
      toast.error(coveragePricingCopy.validation.invalidPrice);
      return;
    }

    // Validate county selections based on mode (only for new entries, not single-row edits)
    if (!isEditingSingleRow) {
      if (coverageMode === "selected_counties" && includedCountyIds.length === 0) {
        toast.error(coveragePricingCopy.validation.missingCounty);
        return;
      }
    }

    const selectedState = US_STATES.find(s => s.value === stateCode);
    if (!selectedState) return;

    // Build inspection_types array - use selected types directly (labels)
    const finalInspectionTypes = [...inspectionTypes];

    const data: CoverageArea = {
      id: editData?.id,
      state_code: stateCode,
      state_name: selectedState.label,
      coverage_mode: coverageMode,
      excluded_county_ids: coverageMode === "entire_state_except" ? excludedCountyIds : undefined,
      included_county_ids: coverageMode === "selected_counties" ? includedCountyIds : undefined,
      covers_entire_state: coverageMode === "entire_state",
      base_price: basePrice.trim(),
      rush_price: rushPrice.trim(),
      region_note: regionNote.trim(),
      inspection_types: finalInspectionTypes,
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

  const getSelectedCountyNames = (ids: string[]) => {
    return counties.filter(c => ids.includes(c.id)).map(c => c.county_name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? coveragePricingCopy.common.editButton + " Coverage Area" : coveragePricingCopy.common.addCoverageButton}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* State (required) */}
          <div className="space-y-2">
            <Label htmlFor="state">{coveragePricingCopy.common.stateLabel} *</Label>
            <Select value={stateCode} onValueChange={setStateCode} disabled={isEditingSingleRow}>
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

          {/* Coverage Mode (radio) - disabled when editing single row */}
          {!isEditingSingleRow && (
            <div className="space-y-3">
              <Label>Coverage Mode *</Label>
              <RadioGroup value={coverageMode} onValueChange={(v: CoverageMode) => setCoverageMode(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="entire_state" id="mode-entire" />
                  <Label htmlFor="mode-entire" className="font-normal cursor-pointer">
                    Entire state (all counties)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="entire_state_except" id="mode-except" />
                  <Label htmlFor="mode-except" className="font-normal cursor-pointer">
                    Entire state except specific counties
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected_counties" id="mode-selected" />
                  <Label htmlFor="mode-selected" className="font-normal cursor-pointer">
                    Only selected counties
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* County Selector - for exclusions */}
          {!isEditingSingleRow && coverageMode === "entire_state_except" && (
            <div className="space-y-2">
              <Label>Exclude Counties</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select any counties where you do not want to work. We'll cover the rest of the state.
              </p>
              <Popover open={countySearchOpen} onOpenChange={setCountySearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-background"
                    disabled={!stateCode}
                  >
                    <span className="text-sm">
                      {excludedCountyIds.length > 0 
                        ? `${excludedCountyIds.length} counties excluded` 
                        : stateCode ? "Select counties to exclude..." : "Select a state first"
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-popover border border-border z-50" align="start">
                  <div className="p-2 border-b border-border bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground px-2">
                      Select counties to exclude ({counties.length} total)
                    </p>
                  </div>
                  <ScrollArea className="h-64 bg-popover">
                    <div className="p-2 space-y-1">
                      {counties.map((county) => (
                        <div
                          key={county.id}
                          className="flex items-center space-x-2 p-2 rounded-sm hover:bg-accent cursor-pointer"
                          onClick={() => toggleCountySelection(county.id, "exclude")}
                        >
                          <Checkbox
                            checked={excludedCountyIds.includes(county.id)}
                            onCheckedChange={() => toggleCountySelection(county.id, "exclude")}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm">{county.county_name}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {excludedCountyIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {getSelectedCountyNames(excludedCountyIds).map((name) => (
                    <Badge key={name} variant="secondary" className="text-xs">
                      {name}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={() => {
                          const county = counties.find(c => c.county_name === name);
                          if (county) toggleCountySelection(county.id, "exclude");
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* County Selector - for inclusions */}
          {!isEditingSingleRow && coverageMode === "selected_counties" && (
            <div className="space-y-2">
              <Label>Select Counties *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Choose all counties that share the same rate and work type. When you save, ClearMarket will add one row for each county.
              </p>
              <Popover open={countySearchOpen} onOpenChange={setCountySearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-background"
                    disabled={!stateCode}
                  >
                    <span className="text-sm">
                      {includedCountyIds.length > 0 
                        ? `${includedCountyIds.length} counties selected` 
                        : stateCode ? "Select counties to include..." : "Select a state first"
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-popover border border-border z-50" align="start">
                  <div className="p-2 border-b border-border bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground px-2">
                      Select counties to include ({counties.length} total)
                    </p>
                  </div>
                  <ScrollArea className="h-64 bg-popover">
                    <div className="p-2 space-y-1">
                      {counties.map((county) => (
                        <div
                          key={county.id}
                          className="flex items-center space-x-2 p-2 rounded-sm hover:bg-accent cursor-pointer"
                          onClick={() => toggleCountySelection(county.id, "include")}
                        >
                          <Checkbox
                            checked={includedCountyIds.includes(county.id)}
                            onCheckedChange={() => toggleCountySelection(county.id, "include")}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm">{county.county_name}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {includedCountyIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {getSelectedCountyNames(includedCountyIds).map((name) => (
                    <Badge key={name} variant="secondary" className="text-xs">
                      {name}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={() => {
                          const county = counties.find(c => c.county_name === name);
                          if (county) toggleCountySelection(county.id, "include");
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Show current county when editing single row */}
          {isEditingSingleRow && editData?.county_name && (
            <div className="space-y-2">
              <Label>County</Label>
              <p className="text-sm text-foreground">{editData.county_name}</p>
              <p className="text-xs text-muted-foreground">
                Editing an individual county row. To change coverage mode, delete and re-add.
              </p>
            </div>
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
              Your Base Rate is the minimum you're willing to accept per inspection in this area. 
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
              placeholder="e.g., Focus on SE Wisconsin / Milwaukee–Racine corridor"
              value={regionNote}
              onChange={(e) => setRegionNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Any special notes about this area.
            </p>
          </div>

          {/* Inspection Types (optional region-specific override) */}
          <div className="space-y-4">
            <div>
              <Label>Inspection Types for this region (optional)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Choose the specific inspection types you want to cover in this state/county. 
                Leave blank to use everything you selected in your main profile.
              </p>
            </div>

            {/* Warning for removed types */}
            {removedTypes.length > 0 && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm text-muted-foreground">
                  Some older inspection types linked to this region are no longer in your main profile. 
                  They've been removed from this list.
                </AlertDescription>
              </Alert>
            )}

            {/* No profile types warning */}
            {profileInspectionTypes.length === 0 && (
              <Alert variant="default" className="border-muted">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm text-muted-foreground">
                  You haven't selected any inspection types in your main profile yet. 
                  Please save some inspection types on your profile first.
                </AlertDescription>
              </Alert>
            )}

            {/* Grouped inspection types from profile */}
            {Object.keys(availableInspectionTypesByCategory).length > 0 && (
              <div className="space-y-4">
                {Object.entries(availableInspectionTypesByCategory).map(([category, types]) => (
                  <div key={category} className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{category}</Label>
                    <div className="ml-1 space-y-1.5">
                      {types.map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`inspection-${type.id}`}
                            checked={inspectionTypes.includes(type.label)}
                            onCheckedChange={() => handleInspectionTypeToggle(type.label)}
                          />
                          <Label 
                            htmlFor={`inspection-${type.id}`} 
                            className="cursor-pointer font-normal text-sm"
                          >
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Profile-level "Other" types */}
            {profileOtherTypes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Other</Label>
                <div className="ml-1 space-y-1.5">
                  {profileOtherTypes.map((otherType) => (
                    <div key={otherType} className="flex items-center space-x-2">
                      <Checkbox
                        id={`inspection-other-${otherType}`}
                        checked={inspectionTypes.includes(otherType)}
                        onCheckedChange={() => handleInspectionTypeToggle(otherType)}
                      />
                      <Label 
                        htmlFor={`inspection-other-${otherType}`} 
                        className="cursor-pointer font-normal text-sm"
                      >
                        {otherType.replace("Other: ", "")}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
