import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, BellOff, Mail, Smartphone } from "lucide-react";
import { US_STATES } from "@/lib/constants";
import {
  getRepMatchSettings,
  upsertRepMatchSettings,
  getDefaultStatesFromCoverage,
  RepMatchSettings,
} from "@/lib/matchAlerts";

const INSPECTION_TYPE_OPTIONS = [
  "Property Inspections",
  "Loss/Insurance Claims",
  "Commercial",
];

interface RepMatchSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export default function RepMatchSettingsDialog({
  open,
  onOpenChange,
  userId,
}: RepMatchSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<RepMatchSettings | null>(null);

  // Form state
  const [statesInterested, setStatesInterested] = useState<string[]>([]);
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([]);
  const [minimumPay, setMinimumPay] = useState<string>("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open, userId]);

  async function loadSettings() {
    setLoading(true);
    try {
      const existingSettings = await getRepMatchSettings(userId);

      if (existingSettings) {
        setSettings(existingSettings);
        setStatesInterested(existingSettings.states_interested || []);
        setInspectionTypes(existingSettings.inspection_types || []);
        setMinimumPay(existingSettings.minimum_pay?.toString() || "");
        setNotifyEmail(existingSettings.notify_email);
        setNotifyInApp(existingSettings.notify_in_app);
      } else {
        // No settings yet - default to rep's coverage states
        const defaultStates = await getDefaultStatesFromCoverage(userId);
        setStatesInterested(defaultStates);
        setInspectionTypes([]);
        setMinimumPay("");
        setNotifyEmail(true);
        setNotifyInApp(true);
      }
    } catch (error) {
      console.error("Error loading match settings:", error);
      toast.error("Failed to load match settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (statesInterested.length === 0) {
      toast.error("Please select at least one state");
      return;
    }

    if (!notifyEmail && !notifyInApp) {
      toast.error("Please enable at least one notification method");
      return;
    }

    setSaving(true);
    try {
      const { error } = await upsertRepMatchSettings(userId, {
        states_interested: statesInterested,
        inspection_types: inspectionTypes.length > 0 ? inspectionTypes : null,
        minimum_pay: minimumPay ? parseFloat(minimumPay) : null,
        notify_email: notifyEmail,
        notify_in_app: notifyInApp,
      });

      if (error) {
        toast.error(error);
      } else {
        toast.success("Match settings saved successfully");
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error saving match settings:", error);
      toast.error("Failed to save match settings");
    } finally {
      setSaving(false);
    }
  }

  function toggleState(stateCode: string) {
    setStatesInterested((prev) =>
      prev.includes(stateCode)
        ? prev.filter((s) => s !== stateCode)
        : [...prev, stateCode]
    );
  }

  function toggleInspectionType(type: string) {
    setInspectionTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Match Alert Settings
          </DialogTitle>
          <DialogDescription>
            Get notified when new Seeking Coverage posts match your preferences.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading settings...
          </div>
        ) : (
          <div className="space-y-6">
            {/* States interested */}
            <div>
              <Label className="text-base font-semibold mb-3 block">
                States I'm Interested In
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                You'll only receive alerts for posts in these states.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {US_STATES.map((state) => (
                  <div
                    key={state.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`state-${state.value}`}
                      checked={statesInterested.includes(state.value)}
                      onCheckedChange={() => toggleState(state.value)}
                    />
                    <label
                      htmlFor={`state-${state.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {state.value}
                    </label>
                  </div>
                ))}
              </div>
              {statesInterested.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {statesInterested.map((code) => (
                    <Badge key={code} variant="secondary">
                      {code}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Inspection types (optional filter) */}
            <div>
              <Label className="text-base font-semibold mb-3 block">
                Inspection Types (Optional)
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Leave empty to receive alerts for all inspection types.
              </p>
              <div className="space-y-2">
                {INSPECTION_TYPE_OPTIONS.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={inspectionTypes.includes(type)}
                      onCheckedChange={() => toggleInspectionType(type)}
                    />
                    <label
                      htmlFor={`type-${type}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {type}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Minimum pay (optional filter) */}
            <div>
              <Label htmlFor="minimum-pay" className="text-base font-semibold mb-3 block">
                Minimum Pay (Optional)
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Only alert for posts offering at least this rate per order.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm">$</span>
                <Input
                  id="minimum-pay"
                  type="number"
                  min="0"
                  step="1"
                  value={minimumPay}
                  onChange={(e) => setMinimumPay(e.target.value)}
                  placeholder="e.g., 35"
                  className="max-w-[150px]"
                />
                <span className="text-sm text-muted-foreground">per order</span>
              </div>
            </div>

            {/* Notification methods */}
            <div>
              <Label className="text-base font-semibold mb-3 block">
                Notification Methods
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Choose how you want to be notified about new matches.
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notify-in-app"
                    checked={notifyInApp}
                    onCheckedChange={(checked) => setNotifyInApp(checked as boolean)}
                  />
                  <label
                    htmlFor="notify-in-app"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Smartphone className="h-4 w-4" />
                    In-app notifications
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notify-email"
                    checked={notifyEmail}
                    onCheckedChange={(checked) => setNotifyEmail(checked as boolean)}
                  />
                  <label
                    htmlFor="notify-email"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Email notifications
                  </label>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
