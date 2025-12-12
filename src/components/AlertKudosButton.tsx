import { useState, useEffect } from "react";
import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AlertKudosButtonProps {
  alertId: string;
  repId: string;
  vendorId: string;
  disabled?: boolean;
}

export function AlertKudosButton({ alertId, repId, vendorId, disabled }: AlertKudosButtonProps) {
  const [hasKudos, setHasKudos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kudosCount, setKudosCount] = useState(0);

  useEffect(() => {
    checkKudosStatus();
  }, [alertId, vendorId]);

  async function checkKudosStatus() {
    // Check if this vendor has given kudos
    const { data: existing } = await supabase
      .from("vendor_alert_kudos")
      .select("id")
      .eq("alert_id", alertId)
      .eq("vendor_id", vendorId)
      .maybeSingle();

    setHasKudos(!!existing);

    // Get total kudos count
    const { count } = await supabase
      .from("vendor_alert_kudos")
      .select("id", { count: "exact", head: true })
      .eq("alert_id", alertId);

    setKudosCount(count || 0);
  }

  async function handleToggle() {
    if (disabled) return;
    
    setLoading(true);
    try {
      if (hasKudos) {
        // Remove kudos
        const { error } = await supabase
          .from("vendor_alert_kudos")
          .delete()
          .eq("alert_id", alertId)
          .eq("vendor_id", vendorId);

        if (error) throw error;
        setHasKudos(false);
        setKudosCount(c => Math.max(0, c - 1));
      } else {
        // Add kudos
        const { error } = await supabase
          .from("vendor_alert_kudos")
          .insert({
            alert_id: alertId,
            vendor_id: vendorId,
            rep_id: repId,
          });

        if (error) throw error;
        setHasKudos(true);
        setKudosCount(c => c + 1);
        toast({
          title: "Thanks for the feedback!",
          description: "Your kudos helps this rep's communication score.",
        });
      }
    } catch (error: any) {
      console.error("Error toggling kudos:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update kudos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={hasKudos ? "default" : "outline"}
            size="sm"
            onClick={handleToggle}
            disabled={loading || disabled}
            className={hasKudos ? "bg-primary/80 hover:bg-primary" : ""}
          >
            <ThumbsUp className={`w-4 h-4 ${hasKudos ? "" : "mr-1"}`} />
            {kudosCount > 0 && <span className="ml-1">{kudosCount}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasKudos ? "You gave kudos – click to remove" : "Good communication – give kudos"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
