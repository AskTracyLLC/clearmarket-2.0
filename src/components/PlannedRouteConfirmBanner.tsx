import { useState } from "react";
import { format, parseISO } from "date-fns";
import { MapPin, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
  const [confirmingRoute, setConfirmingRoute] = useState<PlannedRoute | null>(null);

  if (routes.length === 0) return null;

  async function handleSendNow(route: PlannedRoute) {
    setSending(route.id);
    setConfirmingRoute(null);
    try {
      // Replace placeholders in message if present; otherwise use message as-is
      let finalMessage = route.message;
      const hasPlaceholders = /\{DATE\}|\{STATE\}|\{COUNTIES\}/.test(route.message);

      if (hasPlaceholders) {
        finalMessage = route.message
          .replace(/\{DATE\}/g, format(parseISO(route.route_date), "MMMM do, yyyy"))
          .replace(/\{STATE\}/g, route.route_state)
          .replace(/\{COUNTIES\}/g, route.route_counties.join(", "));
      }

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
    setConfirmingRoute(null);
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
    <>
      {/* Confirmation Modal */}
      <AlertDialog open={!!confirmingRoute} onOpenChange={(open) => !open && setConfirmingRoute(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Still working this route today?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {confirmingRoute && (
                <>
                  <p>
                    You scheduled a route for{" "}
                    <span className="font-medium text-foreground">
                      {confirmingRoute.route_counties.join(", ")}, {confirmingRoute.route_state}
                    </span>{" "}
                    today.
                  </p>
                  <p>
                    Would you like to send the alert to your vendors now?
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => confirmingRoute && handleCancel(confirmingRoute.id)}
              disabled={canceling === confirmingRoute?.id}
            >
              <X className="w-4 h-4 mr-2" />
              {canceling === confirmingRoute?.id ? "Canceling..." : "Not Today"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmingRoute && handleSendNow(confirmingRoute)}
              disabled={sending === confirmingRoute?.id}
            >
              <Send className="w-4 h-4 mr-2" />
              {sending === confirmingRoute?.id ? "Sending..." : "Yes, Send Alert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Banner Cards */}
      <div className="space-y-3 mb-6">
        {routes.map((route) => (
          <div 
            key={route.id} 
            className="flex items-center justify-between gap-4 p-4 rounded-lg border border-primary/50 bg-primary/5"
          >
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  Scheduled route for today
                </p>
                <p className="text-sm text-muted-foreground">
                  {route.route_counties.join(", ")}, {route.route_state}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setConfirmingRoute(route)}
              disabled={sending === route.id || canceling === route.id}
            >
              {sending === route.id ? "Sending..." : "Confirm & Send"}
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
