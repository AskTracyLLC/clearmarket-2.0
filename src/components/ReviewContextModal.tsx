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
import { Loader2, MapPin, AlertCircle } from "lucide-react";
import { fetchActiveAgreementAreas, getConnectionId, AgreementAreaWithType } from "@/lib/agreementAreas";

export interface ReviewContextValue {
  mode: "overall" | "specific";
  stateCode: string | null;
  countyName: string | null;
  inspectionCategory: string | null;
  inspectionTypeId: string | null;
  displayLabel: string | null;
  agreementAreaId?: string | null;
}

interface CoverageOption {
  id: string;
  agreementAreaId: string;
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
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Load coverage options from connection_agreement_areas ONLY
  useEffect(() => {
    if (!open) return;

    async function loadCoverageOptions() {
      setLoading(true);
      
      try {
        // Get connection ID first
        const connId = await getConnectionId(vendorUserId, repUserId);
        setConnectionId(connId);

        if (!connId) {
          setCoverageOptions([]);
          setLoading(false);
          return;
        }

        // Fetch active agreement areas for this connection
        const areas = await fetchActiveAgreementAreas(connId);
        
        const options: CoverageOption[] = areas.map((area) => {
          const countyPart = area.county_name || area.zip_code || "Entire state";
          const typePart = area.inspection_type_label || area.inspection_category || "";
          
          const displayLabel = typePart 
            ? `${area.state_code} — ${countyPart} (${typePart})`
            : `${area.state_code} — ${countyPart}`;

          return {
            id: `aa-${area.id}`,
            agreementAreaId: area.id,
            stateCode: area.state_code,
            countyName: area.county_name,
            inspectionCategory: area.inspection_category,
            inspectionTypeId: area.inspection_type_id,
            displayLabel,
          };
        });

        // Sort options
        options.sort((a, b) => {
          const stateCompare = a.stateCode.localeCompare(b.stateCode);
          if (stateCompare !== 0) return stateCompare;
          
          const aCounty = a.countyName || "";
          const bCounty = b.countyName || "";
          return aCounty.localeCompare(bCounty);
        });

        setCoverageOptions(options);

        // Restore selection if we have a current value
        if (currentValue.mode === "specific" && currentValue.agreementAreaId) {
          const matchingOption = options.find(o => o.agreementAreaId === currentValue.agreementAreaId);
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
        agreementAreaId: null,
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
          agreementAreaId: option.agreementAreaId,
        });
      }
    }
    onOpenChange(false);
  };

  const hasNoAgreementAreas = !loading && coverageOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add context to this review</DialogTitle>
          <DialogDescription>
            You can keep this review high-level, or tie it to specific areas from your agreement.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasNoAgreementAreas ? (
          <div className="py-4 space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border">
              <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">No agreement areas found for this connection</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This review will be saved as an overall experience review.
                </p>
              </div>
            </div>
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
                    Choose specific agreement area
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick an area/work type from your agreement.
                  </p>
                </div>
              </div>
            </RadioGroup>

            {mode === "specific" && (
              <div className="mt-4 space-y-2 pl-6">
                <Label className="text-xs text-muted-foreground">Select agreement area:</Label>
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
            disabled={mode === "specific" && !selectedOption && !hasNoAgreementAreas}
          >
            Apply context
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
