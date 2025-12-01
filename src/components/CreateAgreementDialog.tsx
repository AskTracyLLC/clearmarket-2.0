import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MapPin, DollarSign, Loader2 } from "lucide-react";

interface CreateAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repUserId: string;
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

interface CoverageArea {
  id: string;
  state_code: string;
  state_name: string;
  county_name: string | null;
  covers_entire_state: boolean;
  covers_entire_county: boolean;
  base_price: number | null;
  rush_price: number | null;
  region_note: string | null;
  inspection_types: string[] | null;
}

interface SelectedCoverage {
  coverageId: string;
  included: boolean;
  agreedBaseRate: string;
  agreedRushRate: string;
}

export function CreateAgreementDialog({
  open,
  onOpenChange,
  repUserId,
  repName,
  defaultCoverage = "",
  defaultPricing = "",
  defaultBaseRate,
  onSave,
  saving,
}: CreateAgreementDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [repCoverageAreas, setRepCoverageAreas] = useState<CoverageArea[]>([]);
  const [selectedCoverages, setSelectedCoverages] = useState<Record<string, SelectedCoverage>>({});

  // Load rep's coverage areas when dialog opens
  useEffect(() => {
    if (open && repUserId) {
      loadRepCoverage();
    }
  }, [open, repUserId]);

  const loadRepCoverage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rep_coverage_areas")
        .select("*")
        .eq("user_id", repUserId)
        .order("state_code", { ascending: true });

      if (error) throw error;

      setRepCoverageAreas(data || []);

      // Initialize selections with defaults
      const initialSelections: Record<string, SelectedCoverage> = {};
      data?.forEach((coverage) => {
        initialSelections[coverage.id] = {
          coverageId: coverage.id,
          included: false,
          agreedBaseRate: coverage.base_price?.toString() || "",
          agreedRushRate: coverage.rush_price?.toString() || "",
        };
      });
      setSelectedCoverages(initialSelections);
    } catch (error: any) {
      console.error("Error loading rep coverage:", error);
      toast({
        title: "Error",
        description: "Failed to load rep's coverage areas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCoverageInclusion = (coverageId: string) => {
    setSelectedCoverages((prev) => ({
      ...prev,
      [coverageId]: {
        ...prev[coverageId],
        included: !prev[coverageId].included,
      },
    }));
  };

  const updateAgreedRate = (coverageId: string, field: "agreedBaseRate" | "agreedRushRate", value: string) => {
    setSelectedCoverages((prev) => ({
      ...prev,
      [coverageId]: {
        ...prev[coverageId],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    // Build coverage summary and pricing summary from selections
    const includedCoverages = repCoverageAreas
      .filter((c) => selectedCoverages[c.id]?.included)
      .map((c) => {
        const selection = selectedCoverages[c.id];
        return {
          coverage: c,
          agreedBaseRate: selection.agreedBaseRate,
          agreedRushRate: selection.agreedRushRate,
        };
      });

    if (includedCoverages.length === 0) {
      toast({
        title: "No coverage selected",
        description: "Please select at least one coverage area for this agreement.",
        variant: "destructive",
      });
      return;
    }

    // Generate coverage_summary
    const coverageSummary = includedCoverages
      .map((item) => {
        const { coverage } = item;
        if (coverage.covers_entire_state) {
          return `${coverage.state_code} - ${coverage.state_name} (Entire State)`;
        } else if (coverage.county_name) {
          return `${coverage.state_code} - ${coverage.county_name} County`;
        } else {
          return `${coverage.state_code} - ${coverage.state_name}`;
        }
      })
      .join(" · ");

    // Generate pricing_summary
    const pricingSummary = includedCoverages
      .map((item) => {
        const { coverage, agreedBaseRate, agreedRushRate } = item;
        const location = coverage.covers_entire_state
          ? coverage.state_code
          : coverage.county_name
          ? `${coverage.state_code} - ${coverage.county_name}`
          : coverage.state_code;
        
        const rates = [];
        if (agreedBaseRate) rates.push(`Base: $${parseFloat(agreedBaseRate).toFixed(2)}`);
        if (agreedRushRate) rates.push(`Rush: $${parseFloat(agreedRushRate).toFixed(2)}`);
        
        return `${location}: ${rates.join(", ")}`;
      })
      .join(" · ");

    // Calculate average base rate for the agreement
    const baseRates = includedCoverages
      .map((item) => parseFloat(item.agreedBaseRate))
      .filter((rate) => !isNaN(rate));
    const avgBaseRate = baseRates.length > 0
      ? baseRates.reduce((sum, rate) => sum + rate, 0) / baseRates.length
      : undefined;

    await onSave({
      coverageSummary,
      pricingSummary,
      baseRate: avgBaseRate,
      markPostFilled: false, // Not used in My Reps context
    });
  };

  const selectedCount = Object.values(selectedCoverages).filter((s) => s.included).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Agreement Details (optional)</DialogTitle>
          <DialogDescription>
            Select which parts of {repName}'s coverage apply to your agreement. You can use their profile rates or set vendor-specific pricing.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : repCoverageAreas.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/30">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  This rep hasn't added any coverage areas yet.
                </p>
              </div>
            ) : (
              <>
                {/* Rep's Profile Coverage (read-only) */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">Rep's Profile Coverage</h3>
                    <p className="text-sm text-muted-foreground">
                      These are the coverage areas {repName} has listed on their profile.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {repCoverageAreas.map((coverage) => (
                      <Card key={coverage.id} className="p-3 bg-muted/20 border-border">
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-foreground text-sm">
                                {coverage.state_code} - {coverage.state_name}
                              </span>
                              {coverage.covers_entire_state && (
                                <Badge variant="secondary" className="text-xs">Entire State</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {coverage.covers_entire_state
                                ? "All counties"
                                : coverage.county_name || "No specific county"}
                            </p>
                            {(coverage.base_price || coverage.rush_price) && (
                              <div className="flex items-center gap-3 text-xs mt-1">
                                {coverage.base_price && (
                                  <span className="text-muted-foreground">
                                    Base: ${parseFloat(coverage.base_price.toString()).toFixed(2)}
                                  </span>
                                )}
                                {coverage.rush_price && (
                                  <span className="text-muted-foreground">
                                    Rush: ${parseFloat(coverage.rush_price.toString()).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Coverage for this Vendor (selection) */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">Coverage for this Vendor</h3>
                    <p className="text-sm text-muted-foreground">
                      Select which areas apply to your agreement. {selectedCount > 0 && `(${selectedCount} selected)`}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {repCoverageAreas.map((coverage) => {
                      const selection = selectedCoverages[coverage.id];
                      if (!selection) return null;

                      return (
                        <Card
                          key={coverage.id}
                          className={`p-4 border transition-colors ${
                            selection.included
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card"
                          }`}
                        >
                          {/* Coverage header with checkbox */}
                          <div className="flex items-start gap-3 mb-3">
                            <Checkbox
                              id={`include-${coverage.id}`}
                              checked={selection.included}
                              onCheckedChange={() => toggleCoverageInclusion(coverage.id)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={`include-${coverage.id}`}
                                className="font-medium text-foreground cursor-pointer"
                              >
                                {coverage.state_code} - {coverage.state_name}
                                {coverage.covers_entire_state && " (Entire State)"}
                                {!coverage.covers_entire_state && coverage.county_name && ` - ${coverage.county_name} County`}
                              </Label>
                              {coverage.region_note && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  {coverage.region_note}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Pricing inputs (shown when selected) */}
                          {selection.included && (
                            <div className="ml-8 space-y-3 pt-3 border-t border-border">
                              <p className="text-sm font-medium text-foreground">Agreed Pricing for this Area</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor={`base-${coverage.id}`} className="text-xs text-muted-foreground">
                                    Base Rate (per inspection)
                                  </Label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <Input
                                      id={`base-${coverage.id}`}
                                      type="number"
                                      step="0.01"
                                      placeholder={coverage.base_price ? coverage.base_price.toString() : "0.00"}
                                      value={selection.agreedBaseRate}
                                      onChange={(e) => updateAgreedRate(coverage.id, "agreedBaseRate", e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  {coverage.base_price && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Profile rate: ${parseFloat(coverage.base_price.toString()).toFixed(2)}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <Label htmlFor={`rush-${coverage.id}`} className="text-xs text-muted-foreground">
                                    Rush Rate (optional)
                                  </Label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <Input
                                      id={`rush-${coverage.id}`}
                                      type="number"
                                      step="0.01"
                                      placeholder={coverage.rush_price ? coverage.rush_price.toString() : "0.00"}
                                      value={selection.agreedRushRate}
                                      onChange={(e) => updateAgreedRate(coverage.id, "agreedRushRate", e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  {coverage.rush_price && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Profile rate: ${parseFloat(coverage.rush_price.toString()).toFixed(2)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground italic">
                                You can use the rep's profile rates or set vendor-specific pricing. This is for your records only.
                              </p>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || selectedCount === 0}>
            {saving ? "Saving..." : "Save Agreement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
