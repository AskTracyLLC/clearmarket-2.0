import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMimic } from "@/hooks/useMimic";

export function SeekingCoverageToggle() {
  const { effectiveUserId } = useMimic();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (effectiveUserId) {
      loadSetting();
    }
  }, [effectiveUserId]);

  async function loadSetting() {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('vendor_profile')
        .select('show_seeking_coverage_on_public_profile')
        .eq('user_id', effectiveUserId)
        .single();

      if (error) throw error;
      setEnabled(data?.show_seeking_coverage_on_public_profile ?? false);
    } catch (error) {
      console.error('Error loading seeking coverage toggle:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(newValue: boolean) {
    if (!effectiveUserId) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('vendor_profile')
        .update({ show_seeking_coverage_on_public_profile: newValue })
        .eq('user_id', effectiveUserId);

      if (error) throw error;

      setEnabled(newValue);
      toast({
        title: newValue ? "Seeking Coverage areas enabled" : "Seeking Coverage areas hidden",
        description: newValue
          ? "Your public profile will now show states/counties where you're seeking reps."
          : "Your public profile no longer displays Seeking Coverage areas."
      });
    } catch (error) {
      console.error('Error updating seeking coverage toggle:', error);
      toast({
        title: "Update failed",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Switch
          id="seeking-coverage-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={updating}
        />
        <Label htmlFor="seeking-coverage-toggle">
          Show "Seeking Coverage" areas on my public profile
        </Label>
      </div>
      <p className="text-xs text-muted-foreground pl-10">
        If enabled, your public profile will show states/counties where you're currently seeking field reps. Rates and post details are not shown.
      </p>
    </div>
  );
}
