import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Briefcase } from "lucide-react";

export interface ReviewContextValue {
  mode: "overall" | "specific";
  stateCode: string | null;
  countyName: string | null;
  inspectionCategory: string | null;
  inspectionTypeId: string | null;
  displayLabel: string | null;
}

interface CoverageOption {
  id: string;
  stateCode: string;
  countyName: string | null;
  inspectionCategory: string | null;
  inspectionTypeId: string | null;
  displayLabel: string;
}

interface ReviewContextModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repUserId: string;
  vendorUserId: string;
  currentValue: ReviewContextValue;
  onApply: (value: ReviewContextValue) => void;
}

export function ReviewContextModal({
  open,
  onOpenChange,
  repUserId,
  vendorUserId,
  currentValue,
  onApply,
}: ReviewContextModalProps) {
  const [mode, setMode] = useState<"overall" | "specific">(currentValue.mode);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [coverageOptions, setCoverageOptions] = useState<CoverageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectionTypes, setInspectionTypes] = useState<Map<string, string>>(new Map());

  // Load coverage options from the vendor-rep connection
  useEffect(() => {
    if (!open) return;

    async function loadCoverageOptions() {
      setLoading(true);
      
      try {
        // Load inspection type labels first
        const { data: types } = await supabase
          .from("inspection_type_options")
          .select("id, label, category")
          .eq("is_active", true);
        
        const typeMap = new Map<string, string>();
        (types || []).forEach((t: any) => {
          typeMap.set(t.id, t.label);
        });
        setInspectionTypes(typeMap);

        const options: CoverageOption[] = [];

        // 1. Try working_terms_rows from active working_terms_requests
        const { data: workingTermsRequests } = await supabase
          .from("working_terms_requests")
          .select("id")
          .or(`and(vendor_id.eq.${vendorUserId},rep_id.eq.${repUserId}),and(vendor_id.eq.${repUserId},rep_id.eq.${vendorUserId})`)
          .eq("status", "active");

        if (workingTermsRequests?.length) {
          for (const request of workingTermsRequests) {
            const { data: rows } = await supabase
              .from("working_terms_rows")
              .select("*")
              .eq("working_terms_request_id", request.id)
              .eq("status", "active");

            (rows || []).forEach((row: any) => {
              const inspTypeLabel = row.inspection_type_id ? typeMap.get(row.inspection_type_id) : null;
              const countyPart = row.county_name || "Entire state";
              const typePart = inspTypeLabel || row.inspection_category || "";
              
              const displayLabel = typePart 
                ? `${row.state_code} – ${countyPart} – ${typePart}`
                : `${row.state_code} – ${countyPart}`;

              options.push({
                id: `wt-${row.id}`,
                stateCode: row.state_code,
                countyName: row.county_name,
                inspectionCategory: row.inspection_category,
                inspectionTypeId: row.inspection_type_id,
                displayLabel,
              });
            });
          }
        }

        // 2. Also try territory_assignments if we have that table
        try {
          const { data: assignments } = await supabase
            .from("territory_assignments" as any)
            .select("id, state_code, county_name, inspection_category, work_type")
            .or(`and(rep_user_id.eq.${repUserId},vendor_user_id.eq.${vendorUserId}),and(rep_user_id.eq.${vendorUserId},vendor_user_id.eq.${repUserId})`)
            .eq("status", "active");

          (assignments || []).forEach((assign: any) => {
            const countyPart = assign.county_name || "Entire state";
            const typePart = assign.inspection_category || assign.work_type || "";
            
            const displayLabel = typePart 
              ? `${assign.state_code} – ${countyPart} – ${typePart}`
              : `${assign.state_code} – ${countyPart}`;

            // Avoid duplicates
            if (!options.some(o => o.displayLabel === displayLabel)) {
              options.push({
                id: `ta-${assign.id}`,
                stateCode: assign.state_code,
                countyName: assign.county_name,
                inspectionCategory: assign.inspection_category || null,
                inspectionTypeId: null,
                displayLabel,
              });
            }
          });
        } catch (e) {
          // territory_assignments table might not exist
        }

        // 3. Fallback: try rep_coverage_areas for this rep
        if (options.length === 0) {
          const { data: repCoverage } = await supabase
            .from("rep_coverage_areas")
            .select("id, state_code, county_name, inspection_types")
            .eq("user_id", repUserId);

          (repCoverage || []).forEach((cov: any) => {
            const countyPart = cov.county_name || "Entire state";
            
            // If there are inspection types, create one option per type
            if (cov.inspection_types?.length) {
              cov.inspection_types.forEach((typeId: string) => {
                const typeLabel = typeMap.get(typeId);
                const displayLabel = typeLabel
                  ? `${cov.state_code} – ${countyPart} – ${typeLabel}`
                  : `${cov.state_code} – ${countyPart}`;

                if (!options.some(o => o.displayLabel === displayLabel)) {
                  options.push({
                    id: `rc-${cov.id}-${typeId}`,
                    stateCode: cov.state_code,
                    countyName: cov.county_name,
                    inspectionCategory: null,
                    inspectionTypeId: typeId,
                    displayLabel,
                  });
                }
              });
            } else {
              const displayLabel = `${cov.state_code} – ${countyPart}`;
              if (!options.some(o => o.displayLabel === displayLabel)) {
                options.push({
                  id: `rc-${cov.id}`,
                  stateCode: cov.state_code,
                  countyName: cov.county_name,
                  inspectionCategory: null,
                  inspectionTypeId: null,
                  displayLabel,
                });
              }
            }
          });
        }

        setCoverageOptions(options);

        // Restore selection if we have a current value
        if (currentValue.mode === "specific" && currentValue.displayLabel) {
          const matchingOption = options.find(o => o.displayLabel === currentValue.displayLabel);
          if (matchingOption) {
            setSelectedOption(matchingOption.id);
          }
        }
      } catch (error) {
        console.error("Error loading coverage options:", error);
      } finally {
        setLoading(false);
      }
    }

    loadCoverageOptions();
  }, [open, repUserId, vendorUserId, currentValue]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setMode(currentValue.mode);
      if (currentValue.mode === "overall") {
        setSelectedOption(null);
      }
    }
  }, [open, currentValue]);

  const handleApply = () => {
    if (mode === "overall") {
      onApply({
        mode: "overall",
        stateCode: null,
        countyName: null,
        inspectionCategory: null,
        inspectionTypeId: null,
        displayLabel: "Overall: All areas & work types",
      });
    } else if (selectedOption) {
      const option = coverageOptions.find(o => o.id === selectedOption);
      if (option) {
        onApply({
          mode: "specific",
          stateCode: option.stateCode,
          countyName: option.countyName,
          inspectionCategory: option.inspectionCategory,
          inspectionTypeId: option.inspectionTypeId,
          displayLabel: option.displayLabel,
        });
      }
    }
    onOpenChange(false);
  };

  const hasNoCoverage = !loading && coverageOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add context to this review</DialogTitle>
          <DialogDescription>
            You can keep this review high-level, or tie it to specific areas and work types you worked together on.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasNoCoverage ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              No specific coverage areas are set for this connection yet. This review will be saved as an overall review.
            </p>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "overall" | "specific")}>
              <div className="flex items-start space-x-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer" onClick={() => setMode("overall")}>
                <RadioGroupItem value="overall" id="overall" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="overall" className="text-sm font-medium cursor-pointer">
                    Overall experience (all areas & work types)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    This review applies to your general experience with this connection.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer" onClick={() => setMode("specific")}>
                <RadioGroupItem value="specific" id="specific" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="specific" className="text-sm font-medium cursor-pointer">
                    Choose specific coverage area
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick the main area/work type this review is about.
                  </p>
                </div>
              </div>
            </RadioGroup>

            {mode === "specific" && (
              <div className="mt-4 space-y-2 pl-6">
                <Label className="text-xs text-muted-foreground">Select coverage area:</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {coverageOptions.map((option) => (
                    <div
                      key={option.id}
                      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        selectedOption === option.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedOption(option.id)}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span>{option.displayLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={mode === "specific" && !selectedOption && !hasNoCoverage}
          >
            Apply context
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
