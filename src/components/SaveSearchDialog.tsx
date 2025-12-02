import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { saveSearch } from "@/lib/savedSearches";

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  roleContext: "vendor_find_reps" | "rep_find_vendors" | "rep_find_work";
  currentFilters: any;
  onSaved?: () => void;
}

export function SaveSearchDialog({
  open,
  onOpenChange,
  userId,
  roleContext,
  currentFilters,
  onSaved,
}: SaveSearchDialogProps) {
  const [searchName, setSearchName] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!searchName.trim()) {
      toast.error("Please enter a name for this search");
      return;
    }

    setSaving(true);

    try {
      const { error } = await saveSearch(
        userId,
        roleContext,
        searchName.trim(),
        currentFilters,
        alertsEnabled
      );

      if (error) {
        toast.error("Failed to save search");
        return;
      }

      toast.success("Search saved successfully");
      setSearchName("");
      setAlertsEnabled(true);
      onOpenChange(false);
      onSaved?.();
    } catch (error: any) {
      console.error("Error saving search:", error);
      toast.error("Failed to save search");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
          <DialogDescription>
            Save your current search filters and get alerts when new matches appear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              placeholder="e.g., IL Reps with BG Check"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="alerts-toggle">Send me alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when new matches appear
              </p>
            </div>
            <Switch
              id="alerts-toggle"
              checked={alertsEnabled}
              onCheckedChange={setAlertsEnabled}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Search"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
