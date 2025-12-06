import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { createWorkingTermsRequest } from "@/lib/workingTerms";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

interface RequestCoverageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  repId: string;
  repName: string;
  onRequestSent?: () => void;
}

const RequestCoverageDialog: React.FC<RequestCoverageDialogProps> = ({
  open,
  onOpenChange,
  vendorId,
  repId,
  repName,
  onRequestSent,
}) => {
  const { toast } = useToast();
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [counties, setCounties] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleStateToggle = (stateCode: string) => {
    setSelectedStates(prev =>
      prev.includes(stateCode)
        ? prev.filter(s => s !== stateCode)
        : [...prev, stateCode]
    );
  };

  const handleSubmit = async () => {
    if (selectedStates.length === 0) {
      toast({
        title: "Select states",
        description: "Please select at least one state.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const countiesArray = counties.trim()
      ? counties.split(",").map(c => c.trim()).filter(Boolean)
      : null;

    const { error } = await createWorkingTermsRequest(
      vendorId,
      repId,
      selectedStates,
      countiesArray,
      message.trim() || null
    );

    setSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request sent",
      description: `Coverage request sent to ${repName}.`,
    });

    // Reset form
    setSelectedStates([]);
    setCounties("");
    setMessage("");
    onOpenChange(false);
    onRequestSent?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request coverage details</DialogTitle>
          <DialogDescription>
            Ask {repName} to share their coverage & pricing for the states you need.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* States Selection */}
          <div className="space-y-2">
            <Label>States (select at least one)</Label>
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto border border-border rounded-md p-2">
              {US_STATES.map(state => (
                <div key={state.code} className="flex items-center space-x-2">
                  <Checkbox
                    id={`state-${state.code}`}
                    checked={selectedStates.includes(state.code)}
                    onCheckedChange={() => handleStateToggle(state.code)}
                  />
                  <label
                    htmlFor={`state-${state.code}`}
                    className="text-xs cursor-pointer"
                  >
                    {state.code}
                  </label>
                </div>
              ))}
            </div>
            {selectedStates.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedStates.join(", ")}
              </p>
            )}
          </div>

          {/* Counties (optional) */}
          <div className="space-y-2">
            <Label htmlFor="counties">Counties (optional)</Label>
            <Textarea
              id="counties"
              placeholder="e.g. Milwaukee, Racine, Kenosha (comma-separated)"
              value={counties}
              onChange={(e) => setCounties(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to request coverage for entire state(s).
            </p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message to rep (optional)</Label>
            <Textarea
              id="message"
              placeholder="e.g. 'Can you send your coverage & pricing for WI, especially Milwaukee, Racine, and Kenosha?'"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || selectedStates.length === 0}>
            {submitting ? "Sending..." : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestCoverageDialog;
