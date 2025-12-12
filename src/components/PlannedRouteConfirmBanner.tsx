import { useState } from "react";
import { format, parseISO } from "date-fns";
import { MapPin, Send, Edit, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PlannedRoute {
  id: string;
  message: string;
  route_date: string;
  route_state: string;
  route_counties: string[];
}

interface PlannedRouteConfirmBannerProps {
  routes: PlannedRoute[];
  onConfirmed: () => void;
  onEdit: (route: PlannedRoute) => void;
  repUserId: string;
}

export function PlannedRouteConfirmBanner({ 
  routes, 
  onConfirmed, 
  onEdit,
  repUserId 
}: PlannedRouteConfirmBannerProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [canceling, setCanceling] = useState<string | null>(null);

  if (routes.length === 0) return null;

  async function handleSendNow(route: PlannedRoute) {
    setSending(route.id);
    try {
      // Replace placeholders in message
      const finalMessage = route.message
        .replace(/\{DATE\}/g, format(parseISO(route.route_date), "MMMM d, yyyy"))
        .replace(/\{STATE\}/g, route.route_state)
        .replace(/\{COUNTIES\}/g, route.route_counties.join(", "));

      // Update the alert record with final message and mark as sending
      const { error: updateError } = await supabase
        .from("vendor_alerts")
        .update({
          message: finalMessage,
          scheduled_status: "confirmed_sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", route.id);

      if (updateError) throw updateError;

      // Call edge function to send the alert
      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        "send-rep-network-alert",
        {
          body: {
            alertId: route.id,
            repUserId: repUserId,
          },
        }
      );

      if (sendError) throw sendError;

      const inAppCount = sendResult?.inAppNotifications || 0;
      const emailCount = sendResult?.emailsSent || 0;
      let description = `Route alert sent to ${inAppCount} ClearMarket vendor${inAppCount !== 1 ? 's' : ''}`;
      if (emailCount > 0) {
        description += ` and ${emailCount} manual contact${emailCount !== 1 ? 's' : ''}`;
      }
      description += '.';

      toast({
        title: "Route Alert Sent",
        description,
      });

      onConfirmed();
    } catch (error: any) {
      console.error("Error sending route alert:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send route alert.",
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  }

  async function handleCancel(routeId: string) {
    setCanceling(routeId);
    try {
      const { error } = await supabase
        .from("vendor_alerts")
        .update({ scheduled_status: "canceled" })
        .eq("id", routeId);

      if (error) throw error;

      toast({
        title: "Canceled",
        description: "Planned route canceled. No alerts will be sent for this day.",
      });

      onConfirmed();
    } catch (error: any) {
      console.error("Error canceling route:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel route.",
        variant: "destructive",
      });
    } finally {
      setCanceling(null);
    }
  }

  return (
    <div className="space-y-3 mb-6">
      {routes.map((route) => (
        <Alert key={route.id} className="border-primary/50 bg-primary/5">
          <MapPin className="h-4 w-4 text-primary" />
          <AlertDescription>
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-medium text-foreground mb-1">
                  Planned route today
                </p>
                <p className="text-sm text-muted-foreground">
                  You told us you'd be working in{" "}
                  <span className="font-medium text-foreground">
                    {route.route_counties.join(", ")}
                  </span>
                  {", "}
                  <span className="font-medium text-foreground">
                    {route.route_state}
                  </span>{" "}
                  today. Do you still want to send this update to your vendors?
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSendNow(route)}
                  disabled={sending === route.id || canceling === route.id}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending === route.id ? "Sending..." : "Send Alert Now"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(route)}
                  disabled={sending === route.id || canceling === route.id}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancel(route.id)}
                  disabled={sending === route.id || canceling === route.id}
                >
                  <X className="w-4 h-4 mr-2" />
                  {canceling === route.id ? "Canceling..." : "Cancel"}
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
