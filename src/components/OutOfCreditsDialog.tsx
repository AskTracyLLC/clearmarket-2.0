import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { vendorProposalsCopy as copy } from "@/copy/vendorProposalsCopy";

interface OutOfCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OutOfCreditsDialog({ open, onOpenChange }: OutOfCreditsDialogProps) {
  const navigate = useNavigate();

  const handleGetCredits = () => {
    onOpenChange(false);
    navigate("/vendor/credits");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {copy.outOfCredits.title}
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>{copy.outOfCredits.body}</p>
            <p className="text-sm">{copy.outOfCredits.secondaryLine}</p>
            <p className="text-xs text-muted-foreground italic">
              {copy.outOfCredits.footnote}
            </p>
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground border-t pt-3 mt-2">
          {copy.outOfCredits.betaHint}
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.outOfCredits.cancelButton}
          </Button>
          <Button onClick={handleGetCredits}>
            {copy.outOfCredits.getCreditsButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
