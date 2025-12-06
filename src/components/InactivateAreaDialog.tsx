import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface InactivateAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaDescription: string;
  role: "vendor" | "rep";
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

const InactivateAreaDialog: React.FC<InactivateAreaDialogProps> = ({
  open,
  onOpenChange,
  areaDescription,
  role,
  onConfirm,
  isLoading = false,
}) => {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason("");
    }
  };

  const title = role === "rep" 
    ? "Stop covering this area for this vendor?" 
    : "Stop using this rep in this area?";

  const description = role === "rep"
    ? "You'll stop receiving work for this area from this vendor once this is saved."
    : "You'll stop treating this rep as the primary coverage for this area.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{description}</p>
            <p className="font-medium text-foreground">{areaDescription}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="inactivate-reason">Reason (required)</Label>
          <Textarea
            id="inactivate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={role === "rep" 
              ? "e.g., Moving out of area, focusing on other regions, etc." 
              : "e.g., Found alternative coverage, volume decreased, etc."}
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Inactivating..." : "Inactivate area"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default InactivateAreaDialog;
