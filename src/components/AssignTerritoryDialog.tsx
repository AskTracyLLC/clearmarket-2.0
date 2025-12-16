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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, MapPin, Briefcase, DollarSign, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  createTerritoryAssignment, 
  checkExistingActiveAssignment 
} from "@/lib/territoryAssignments";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AssignTerritoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  repId: string;
  repName: string;
  conversationId: string;
  seekingCoveragePost: {
    id: string;
    title: string;
    state_code: string;
    county_id?: string | null;
    county_name?: string | null;
    state_name?: string;
    inspection_types?: string[];
    systems_required_array?: string[];
    pay_max?: number | null;
    pay_min?: number | null;
  };
  onSuccess?: () => void;
}

export function AssignTerritoryDialog({
  open,
  onOpenChange,
  vendorId,
  repId,
  repName,
  conversationId,
  seekingCoveragePost,
  onSuccess,
}: AssignTerritoryDialogProps) {
  const [agreedRate, setAgreedRate] = useState<string>("");
  const [effectiveDate, setEffectiveDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [notes, setNotes] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [existingAssignment, setExistingAssignment] = useState<any>(null);
  const [repBaseRate, setRepBaseRate] = useState<number | null>(null);
  const [stateName, setStateName] = useState<string>("");
  const [countyName, setCountyName] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  }, [open, seekingCoveragePost]);

  async function loadInitialData() {
    // Check for existing active assignment
    const existing = await checkExistingActiveAssignment(
      vendorId,
      repId,
      seekingCoveragePost.state_code,
      seekingCoveragePost.county_id
    );
    setExistingAssignment(existing);

    // Fetch rep's base rate for this county if available
    if (seekingCoveragePost.county_id) {
      const { data: coverage } = await supabase
        .from("rep_coverage_areas")
        .select("base_price")
        .eq("user_id", repId)
        .eq("county_id", seekingCoveragePost.county_id)
        .maybeSingle();

      if (coverage?.base_price) {
        setRepBaseRate(coverage.base_price);
        setAgreedRate(coverage.base_price.toString());
      } else if (seekingCoveragePost.pay_max) {
        setAgreedRate(seekingCoveragePost.pay_max.toString());
      }
    } else if (seekingCoveragePost.pay_max) {
      setAgreedRate(seekingCoveragePost.pay_max.toString());
    }

    // Get state name
    if (seekingCoveragePost.state_code) {
      const { data: stateData } = await supabase
        .from("us_counties")
        .select("state_name")
        .eq("state_code", seekingCoveragePost.state_code)
        .limit(1)
        .maybeSingle();
      
      if (stateData) {
        setStateName(stateData.state_name);
      }
    }

    // Get county name if needed
    if (seekingCoveragePost.county_id) {
      const { data: countyData } = await supabase
        .from("us_counties")
        .select("county_name")
        .eq("id", seekingCoveragePost.county_id)
        .maybeSingle();
      
      if (countyData) {
        setCountyName(countyData.county_name);
      }
    } else if (seekingCoveragePost.county_name) {
      setCountyName(seekingCoveragePost.county_name);
    }
  }

  const isOverBudget = seekingCoveragePost.pay_max 
    ? parseFloat(agreedRate) > seekingCoveragePost.pay_max 
    : false;

  async function handleSubmit() {
    const rate = parseFloat(agreedRate);
    if (isNaN(rate) || rate <= 0) {
      toast({
        title: "Invalid rate",
        description: "Please enter a valid rate greater than 0.",
        variant: "destructive",
      });
      return;
    }

    // Soft validation: if over budget, require an override reason
    if (isOverBudget && !overrideReason.trim()) {
      toast({
        title: "Override note required",
        description: "Please add a brief note explaining the higher rate.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { assignment, error } = await createTerritoryAssignment({
        vendorId,
        repId,
        seekingCoveragePostId: seekingCoveragePost.id,
        conversationId,
        stateCode: seekingCoveragePost.state_code,
        stateName: stateName || seekingCoveragePost.state_code,
        countyId: seekingCoveragePost.county_id,
        countyName: countyName || null,
        inspectionTypes: seekingCoveragePost.inspection_types || [],
        systemsRequired: seekingCoveragePost.systems_required_array || [],
        agreedRate: rate,
        effectiveDate,
        notes: notes.trim() || null,
        rateOverride: isOverBudget,
        rateOverrideReason: isOverBudget ? overrideReason.trim() : null,
      });

      if (error) {
        throw new Error(error);
      }

      toast({
        title: "Assignment sent",
        description: "Territory assignment sent to rep for confirmation.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating assignment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const locationDisplay = countyName
    ? `${countyName}, ${seekingCoveragePost.state_code}`
    : `${seekingCoveragePost.state_code} (statewide)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Territory to Rep</DialogTitle>
          <DialogDescription>
            Create a territory assignment from this Seeking Coverage post.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context Section */}
          <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Post:</span>{" "}
              <span className="font-medium">{seekingCoveragePost.title}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{locationDisplay}</span>
            </div>
            {seekingCoveragePost.inspection_types && seekingCoveragePost.inspection_types.length > 0 && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                {seekingCoveragePost.inspection_types.map((type) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">Rep:</span>{" "}
              <span className="font-medium">{repName}</span>
            </div>
          </div>

          {/* Existing Assignment Warning */}
          {existingAssignment && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You already have an active agreement with this rep for {locationDisplay}. 
                Saving this will update the existing agreement.
              </AlertDescription>
            </Alert>
          )}

          {/* Agreed Rate */}
          <div className="space-y-2">
            <Label htmlFor="agreedRate">Agreed Rate (USD per order)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="agreedRate"
                type="number"
                step="0.01"
                min="0"
                value={agreedRate}
                onChange={(e) => setAgreedRate(e.target.value)}
                className="pl-9"
                placeholder="0.00"
              />
            </div>
            {seekingCoveragePost.pay_max && !isOverBudget && (
              <p className="text-xs text-muted-foreground">
                Posted max: ${seekingCoveragePost.pay_max}. You can override if needed.
              </p>
            )}
            {isOverBudget && (
              <p className="text-xs text-amber-500">
                You're above your posted max of ${seekingCoveragePost.pay_max}. That's okay, just add a note below.
              </p>
            )}
            {repBaseRate && (
              <p className="text-xs text-muted-foreground">
                Rep's base rate for this county: ${repBaseRate}
              </p>
            )}
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="effectiveDate"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Override Reason (required when over budget) */}
          {isOverBudget && (
            <div className="space-y-2">
              <Label htmlFor="overrideReason">
                Override Note <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="overrideReason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="E.g., High-priority area, includes winter bonus..."
                rows={2}
                className="border-amber-500/50"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special notes about this agreement..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !agreedRate}>
            {saving ? "Sending..." : "Send to rep for confirmation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
