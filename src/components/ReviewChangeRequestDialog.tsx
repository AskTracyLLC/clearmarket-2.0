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
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar } from "lucide-react";
import { format } from "date-fns";

interface ChangeRequest {
  id: string;
  old_rate: number | null;
  new_rate: number | null;
  old_turnaround_days: number | null;
  new_turnaround_days: number | null;
  effective_from: string;
  reason: string;
  requested_by_role: string;
  created_at: string;
}

interface ReviewChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaDescription: string;
  changeRequest: ChangeRequest;
  requesterName: string;
  onAccept: () => void;
  onDecline: (reason: string) => void;
  isLoading?: boolean;
}

const ReviewChangeRequestDialog: React.FC<ReviewChangeRequestDialogProps> = ({
  open,
  onOpenChange,
  areaDescription,
  changeRequest,
  requesterName,
  onAccept,
  onDecline,
  isLoading = false,
}) => {
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const handleDecline = () => {
    onDecline(declineReason.trim());
    setDeclineReason("");
    setShowDecline(false);
  };

  const formatValue = (value: number | null, suffix: string) => {
    if (value === null) return "Not set";
    return suffix === "$" ? `$${value}` : `${value} ${suffix}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review proposed changes</DialogTitle>
          <DialogDescription>{areaDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-sm text-muted-foreground">Proposed by</p>
            <p className="text-sm font-medium">{requesterName}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(changeRequest.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>

          <div className="space-y-3">
            {/* Rate change */}
            {changeRequest.old_rate !== changeRequest.new_rate && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-24">Base rate:</span>
                <Badge variant="outline" className="font-mono">
                  {formatValue(changeRequest.old_rate, "$")}
                </Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <Badge variant="default" className="font-mono">
                  {formatValue(changeRequest.new_rate, "$")}
                </Badge>
              </div>
            )}

            {/* Turnaround change */}
            {changeRequest.old_turnaround_days !== changeRequest.new_turnaround_days && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-24">Turnaround:</span>
                <Badge variant="outline" className="font-mono">
                  {formatValue(changeRequest.old_turnaround_days, "days")}
                </Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <Badge variant="default" className="font-mono">
                  {formatValue(changeRequest.new_turnaround_days, "days")}
                </Badge>
              </div>
            )}

            {/* Effective date */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                Effective: {format(new Date(changeRequest.effective_from), "MMMM d, yyyy")}
              </span>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground mb-1">Reason provided:</p>
            <p className="text-sm">{changeRequest.reason}</p>
          </div>

          {showDecline && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="decline-reason">Decline reason (optional)</Label>
              <Textarea
                id="decline-reason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Explain why you're declining..."
                rows={2}
              />
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {showDecline ? (
            <>
              <Button variant="outline" onClick={() => setShowDecline(false)} disabled={isLoading}>
                Back
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDecline}
                disabled={isLoading}
              >
                {isLoading ? "Declining..." : "Confirm decline"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowDecline(true)}
                disabled={isLoading}
              >
                Decline
              </Button>
              <Button onClick={onAccept} disabled={isLoading}>
                {isLoading ? "Accepting..." : "Accept new terms"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewChangeRequestDialog;
