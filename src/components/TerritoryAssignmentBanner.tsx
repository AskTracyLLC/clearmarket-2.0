import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, DollarSign, CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import { TerritoryAssignment, acceptTerritoryAssignment, declineTerritoryAssignment } from "@/lib/territoryAssignments";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface TerritoryAssignmentBannerProps {
  assignment: TerritoryAssignment;
  repUserId: string;
  onUpdate: () => void;
}

export function TerritoryAssignmentBanner({
  assignment,
  repUserId,
  onUpdate,
}: TerritoryAssignmentBannerProps) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const locationDisplay = assignment.county_name
    ? `${assignment.county_name}, ${assignment.state_code}`
    : `${assignment.state_code} (statewide)`;

  const formattedDate = format(parseISO(assignment.effective_date), "MMM d, yyyy");

  async function handleAccept() {
    setAccepting(true);
    try {
      const { error } = await acceptTerritoryAssignment(assignment.id, repUserId);
      if (error) {
        throw new Error(error);
      }

      toast({
        title: "Assignment accepted",
        description: "Territory assignment has been confirmed. Agreement is now on file.",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept assignment.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    try {
      const { error } = await declineTerritoryAssignment(
        assignment.id,
        repUserId,
        declineReason.trim() || undefined
      );
      if (error) {
        throw new Error(error);
      }

      toast({
        title: "Assignment declined",
        description: "The vendor has been notified of your decision.",
      });

      setShowDeclineDialog(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to decline assignment.",
        variant: "destructive",
      });
    } finally {
      setDeclining(false);
    }
  }

  return (
    <>
      <Alert className="border-primary/50 bg-primary/5">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary">Territory assignment pending</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm text-foreground">
            Vendor wants to assign you{" "}
            <span className="font-medium">{locationDisplay}</span> at{" "}
            <span className="font-medium">${assignment.agreed_rate}/order</span>, effective{" "}
            <span className="font-medium">{formattedDate}</span>.
          </p>
          
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={handleAccept} disabled={accepting}>
              {accepting ? "Accepting..." : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeclineDialog(true)}
              disabled={declining}
            >
              Decline
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? "Hide details" : "View details"}
            </Button>
          </div>

          {showDetails && (
            <div className="mt-3 p-3 bg-secondary/50 rounded-lg space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{locationDisplay}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>${assignment.agreed_rate} / order</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>Effective: {formattedDate}</span>
              </div>
              {assignment.inspection_types && assignment.inspection_types.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {assignment.inspection_types.map((type) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              )}
              {assignment.notes && (
                <div className="pt-2 border-t border-border mt-2">
                  <span className="text-muted-foreground">Notes: </span>
                  {assignment.notes}
                </div>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>

      {/* Decline Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Territory Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline this assignment for {locationDisplay}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="declineReason">Reason (optional)</Label>
              <Textarea
                id="declineReason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., 'Can only do this if rate is $20+'"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={declining}
            >
              {declining ? "Declining..." : "Decline Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
