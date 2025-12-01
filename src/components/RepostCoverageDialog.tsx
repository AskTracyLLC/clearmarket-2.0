import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RepostCoverageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverageSummary: string | null;
  pricingSummary: string | null;
  vendorUserId: string;
}

export function RepostCoverageDialog({
  open,
  onOpenChange,
  coverageSummary,
  pricingSummary,
  vendorUserId,
}: RepostCoverageDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const handleCreatePost = () => {
    // Navigate to Seeking Coverage page where vendor can create a new post
    navigate("/vendor/seeking-coverage");
    onOpenChange(false);
    
    // Show a toast to remind them about the coverage
    toast({
      title: "Create New Post",
      description: coverageSummary 
        ? `Remember to include coverage for: ${coverageSummary}`
        : "You can now create a new Seeking Coverage post.",
    });
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Do you want to repost this coverage?</DialogTitle>
          <DialogDescription>
            This Field Rep is no longer covering the area listed in your agreement. Do you want to create a new Seeking Coverage post for that area?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {coverageSummary ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Previous coverage</Label>
              <Alert>
                <AlertDescription className="text-sm">
                  {coverageSummary}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                We don't have coverage details stored in ClearMarket for this rep. Do you want to open a new Seeking Coverage post now?
              </AlertDescription>
            </Alert>
          )}

          {coverageSummary && (
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notes for your post (optional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Example: Looking for a reliable inspector for IL – Lake & McHenry Counties…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
          >
            {coverageSummary ? "Not right now" : "Skip"}
          </Button>
          <Button onClick={handleCreatePost}>
            {coverageSummary ? "Create Seeking Coverage Post" : "Create New Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
