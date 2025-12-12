import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, MapPin, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES } from "@/lib/constants";

interface ReviewContext {
  stateCode: string | null;
  countyName: string | null;
  zipCode: string | null;
  inspectionCategory: string | null;
  inspectionTypeId: string | null;
}

interface InspectionTypeOption {
  id: string;
  label: string;
  category: string;
}

interface ReviewContextSelectorProps {
  value: ReviewContext;
  onChange: (context: ReviewContext) => void;
  autoFilledFrom?: string; // e.g., "Seeking Coverage post" or "Working terms"
}

const INSPECTION_CATEGORIES = [
  "Property Inspections",
  "Loss / Insurance Claims (Appointment-based)",
  "Commercial",
  "Other",
];

export function ReviewContextSelector({
  value,
  onChange,
  autoFilledFrom,
}: ReviewContextSelectorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [counties, setCounties] = useState<{ id: string; county_name: string }[]>([]);
  const [inspectionTypes, setInspectionTypes] = useState<InspectionTypeOption[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<InspectionTypeOption[]>([]);
  const [loadingCounties, setLoadingCounties] = useState(false);

  // Load inspection types on mount
  useEffect(() => {
    async function loadInspectionTypes() {
      const { data } = await supabase
        .from("inspection_type_options")
        .select("id, label, category")
        .eq("is_active", true)
        .order("category")
        .order("sort_order");
      
      setInspectionTypes((data || []) as InspectionTypeOption[]);
    }
    loadInspectionTypes();
  }, []);

  // Filter inspection types when category changes
  useEffect(() => {
    if (value.inspectionCategory) {
      const filtered = inspectionTypes.filter(
        (t) => t.category === value.inspectionCategory
      );
      setFilteredTypes(filtered);
    } else {
      setFilteredTypes(inspectionTypes);
    }
  }, [value.inspectionCategory, inspectionTypes]);

  // Load counties when state changes
  useEffect(() => {
    async function loadCounties() {
      if (!value.stateCode) {
        setCounties([]);
        return;
      }

      setLoadingCounties(true);
      const { data } = await supabase
        .from("us_counties")
        .select("id, county_name")
        .eq("state_code", value.stateCode)
        .order("county_name");

      setCounties((data || []) as { id: string; county_name: string }[]);
      setLoadingCounties(false);
    }
    loadCounties();
  }, [value.stateCode]);

  const getDisplayText = () => {
    const parts: string[] = [];
    
    if (value.countyName && value.stateCode) {
      parts.push(`${value.countyName}, ${value.stateCode}`);
    } else if (value.stateCode) {
      const state = US_STATES.find((s) => s.value === value.stateCode);
      parts.push(state?.label || value.stateCode);
    }

    if (value.inspectionCategory) {
      parts.push(value.inspectionCategory);
    }

    // Find inspection type label
    if (value.inspectionTypeId) {
      const type = inspectionTypes.find((t) => t.id === value.inspectionTypeId);
      if (type) {
        parts.push(type.label);
      }
    }

    return parts.length > 0 ? parts.join(" – ") : null;
  };

  const displayText = getDisplayText();

  if (!isEditing && displayText) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 mb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">
              Reviewing work for:
              {autoFilledFrom && (
                <span className="ml-1 text-primary">
                  (auto-filled from {autoFilledFrom})
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {(value.stateCode || value.countyName) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {value.countyName && value.stateCode
                    ? `${value.countyName}, ${value.stateCode}`
                    : value.stateCode}
                </span>
              )}
              {(value.inspectionCategory || value.inspectionTypeId) && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                  {value.inspectionCategory}
                  {value.inspectionTypeId && inspectionTypes.find((t) => t.id === value.inspectionTypeId) && (
                    <> – {inspectionTypes.find((t) => t.id === value.inspectionTypeId)?.label}</>
                  )}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-xs h-6 px-2"
          >
            <Pencil className="h-3 w-3 mr-1" />
            Change
          </Button>
        </div>
      </div>
    );
  }

  if (!isEditing && !displayText) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Add location & work type context (optional)
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-xs h-6 px-2"
          >
            <Pencil className="h-3 w-3 mr-1" />
            Add context
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">Review Context</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(false)}
          className="text-xs h-6 px-2"
        >
          Done
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">State</Label>
          <Select
            value={value.stateCode || ""}
            onValueChange={(v) =>
              onChange({
                ...value,
                stateCode: v || null,
                countyName: null, // Reset county when state changes
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Not specified</SelectItem>
              {US_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">County</Label>
          <Select
            value={value.countyName || ""}
            onValueChange={(v) => onChange({ ...value, countyName: v || null })}
            disabled={!value.stateCode || loadingCounties}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={loadingCounties ? "Loading..." : "Select county"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Not specified</SelectItem>
              {counties.map((county) => (
                <SelectItem key={county.id} value={county.county_name}>
                  {county.county_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Inspection Category</Label>
        <Select
          value={value.inspectionCategory || ""}
          onValueChange={(v) =>
            onChange({
              ...value,
              inspectionCategory: v || null,
              inspectionTypeId: null, // Reset type when category changes
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Not specified</SelectItem>
            {INSPECTION_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTypes.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Inspection Type</Label>
          <Select
            value={value.inspectionTypeId || ""}
            onValueChange={(v) => onChange({ ...value, inspectionTypeId: v || null })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select type (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Not specified</SelectItem>
              {filteredTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
