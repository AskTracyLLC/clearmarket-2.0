import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isToday, startOfDay } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, MapPin, Send, Clock, X, Info } from "lucide-react";
import { alertsCopy } from "@/copy/alertsCopy";

interface CoverageArea {
  state_code: string;
  state_name: string;
  county_name: string | null;
}

interface PlannedRouteAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess?: () => void;
}

export function PlannedRouteAlertDialog({
  open,
  onOpenChange,
  userId,
  onSuccess,
}: PlannedRouteAlertDialogProps) {
  const [loading, setLoading] = useState(false);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  
  // Form state
  const [routeDate, setRouteDate] = useState<Date | undefined>(undefined);
  const [routeState, setRouteState] = useState("");
  const [routeCounties, setRouteCounties] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Derived state
  const isDateToday = routeDate ? isToday(routeDate) : false;
  const isFormValid = routeDate && routeState && routeCounties.length > 0;
  const formattedScheduleDate = routeDate ? format(routeDate, "MMM d") : "";

  // Load coverage areas when dialog opens
  useEffect(() => {
    if (open && userId) {
      loadCoverageAreas();
      resetForm();
    }
  }, [open, userId]);

  // Update message template when selections change
  useEffect(() => {
    if (routeDate && routeState && routeCounties.length > 0) {
      updateMessagePreview();
    }
  }, [routeDate, routeState, routeCounties, reason]);

  async function loadCoverageAreas() {
    const { data, error } = await supabase
      .from("rep_coverage_areas")
      .select("state_code, state_name, county_name")
      .eq("user_id", userId);

    if (error) {
      console.error("Error loading coverage:", error);
      return;
    }

    setCoverageAreas(data || []);
  }

  function resetForm() {
    setRouteDate(undefined);
    setRouteState("");
    setRouteCounties([]);
    setReason("");
    // Set initial template with placeholders shown until user makes selections
    setMessage("I'm planning to be in {COUNTIES}, {STATE} on {DATE}.\nPlease request extensions on any work due before this date if you still want me to cover it.");
  }

  // Get unique states from coverage
  const coverageStates = useMemo(() => {
    const states = new Map<string, string>();
    coverageAreas.forEach(area => {
      states.set(area.state_code, area.state_name);
    });
    return Array.from(states.entries()).map(([code, name]) => ({ code, name }));
  }, [coverageAreas]);

  // Get counties for selected state
  const stateCounties = useMemo(() => {
    if (!routeState) return [];
    return coverageAreas
      .filter(area => area.state_code === routeState && area.county_name)
      .map(area => area.county_name!)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }, [coverageAreas, routeState]);

  function toggleCounty(county: string) {
    setRouteCounties(prev =>
      prev.includes(county)
        ? prev.filter(c => c !== county)
        : [...prev, county]
    );
  }

  function updateMessagePreview() {
    const stateName = coverageStates.find(s => s.code === routeState)?.name || routeState;
    const formattedDate = routeDate ? format(routeDate, "MMMM do, yyyy") : "{DATE}";
    const countiesList = routeCounties.length > 0 ? routeCounties.join(", ") : "{COUNTIES}";

    let newMessage = `I'm planning to be in ${countiesList}, ${stateName} on ${formattedDate}.`;
    
    if (reason.trim()) {
      newMessage += `\nThis is the earliest date I can be in this area because of ${reason.trim()}.`;
    }
    
    newMessage += `\nPlease request extensions on any work due before this date if you still want me to cover it.`;

    setMessage(newMessage);
  }

  async function handleSend(sendNow: boolean) {
    // Validation
    if (!routeDate) {
      toast({ title: "Validation Error", description: "Please select a date.", variant: "destructive" });
      return;
    }
    if (!routeState) {
      toast({ title: "Validation Error", description: "Please select a state.", variant: "destructive" });
      return;
    }
    if (routeCounties.length === 0) {
      toast({ title: "Validation Error", description: "Select at least one county.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      // Get connected vendors
      const { data: connections, error: connectionsError } = await supabase
        .from("vendor_connections")
        .select("vendor_id")
        .eq("field_rep_id", userId)
        .eq("status", "connected");

      if (connectionsError) throw connectionsError;

      const { count: manualContactCount } = await supabase
        .from("rep_vendor_contacts")
        .select("id", { count: "exact", head: true })
        .eq("rep_user_id", userId)
        .eq("is_active", true);

      const vendorIds = connections?.map(c => c.vendor_id) || [];
      const totalRecipients = vendorIds.length + (manualContactCount || 0);

      if (totalRecipients === 0) {
        toast({
          title: "No Recipients",
          description: "You don't have any connected vendors or manual contacts.",
          variant: "default",
        });
        setSending(false);
        return;
      }

      const routeDateStr = format(routeDate, "yyyy-MM-dd");
      const stateName = coverageStates.find(s => s.code === routeState)?.name || routeState;

      // Determine if we're scheduling or sending now
      const isScheduling = !sendNow && !isDateToday;

      // Build the alert data
      const alertData = {
        rep_user_id: userId,
        alert_type: "planned_route",
        message: message,
        affected_start_date: routeDateStr,
        affected_end_date: routeDateStr,
        recipient_vendor_ids: vendorIds,
        route_date: routeDateStr,
        route_state: stateName,
        route_counties: routeCounties,
        is_scheduled: isScheduling,
        scheduled_status: isScheduling ? "pending_confirmation" : null,
      };

      // Insert the alert
      const { data: alertRecord, error: alertError } = await supabase
        .from("vendor_alerts")
        .insert(alertData)
        .select()
        .single();

      if (alertError) throw alertError;

      if (!isScheduling) {
        // Call edge function to send notifications immediately
        const { data: sendResult, error: sendError } = await supabase.functions.invoke(
          "send-rep-network-alert",
          {
            body: {
              alertId: alertRecord.id,
              repUserId: userId,
            },
          }
        );

        if (sendError) throw sendError;

        const inAppCount = sendResult?.inAppNotifications || 0;
        const emailCount = sendResult?.emailsSent || 0;
        let description = `Alert sent to ${inAppCount} vendor${inAppCount !== 1 ? 's' : ''}`;
        if (emailCount > 0) {
          description += ` and ${emailCount} manual contact${emailCount !== 1 ? 's' : ''}`;
        }

        toast({ title: "Route Alert Sent", description });
      } else {
        // Scheduled for the route date
        toast({
          title: "Route Scheduled",
          description: `Your planned route for ${format(routeDate, "MMMM do, yyyy")} is saved. You'll be prompted to confirm and send it on that day.`,
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error sending route alert:", error);
      toast({ title: "Error", description: error.message || alertsCopy.repAlerts.toasts.sendError, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Send Your Route to Vendors
          </DialogTitle>
          <DialogDescription>
            Sending your planned route helps vendors know where you'll be and when.
            This gives them time to assign work in those areas, request extensions early if needed, and avoid last-minute panics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Date picker */}
          <div className="space-y-2">
            <Label>Which day will you be in this area? *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !routeDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {routeDate ? format(routeDate, "MMMM do, yyyy") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={routeDate}
                  onSelect={setRouteDate}
                  disabled={(date) => startOfDay(date) < startOfDay(new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* State dropdown */}
          <div className="space-y-2">
            <Label>State *</Label>
            {coverageStates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No coverage areas set. Please add coverage areas in Work Setup first.
              </p>
            ) : (
              <Select value={routeState} onValueChange={(val) => {
                setRouteState(val);
                setRouteCounties([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
                <SelectContent>
                  {coverageStates.map(state => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Counties multi-select */}
          {routeState && stateCounties.length > 0 && (
            <div className="space-y-2">
              <Label>Counties *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Choose the counties you plan to work in on this day.
              </p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded-md p-3 bg-muted/30">
                {stateCounties.map(county => (
                  <Badge
                    key={county}
                    variant={routeCounties.includes(county) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCounty(county)}
                  >
                    {county}
                    {routeCounties.includes(county) && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
              {routeCounties.length === 0 && routeState && (
                <p className="text-xs text-destructive">Select at least one county.</p>
              )}
              {routeCounties.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Selected: {routeCounties.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Reason (optional) */}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              placeholder="e.g., personal schedule, other appointments in the area"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional: Explain why this is the earliest date you can be in this area.
            </p>
          </div>

          {/* Message preview */}
          <div className="space-y-2">
            <Label>Message Preview</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This message will be sent to your vendors. You can edit it before sending.
            </p>
          </div>

          {/* Helper text about timing */}
          {isFormValid && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                {isDateToday ? (
                  "This alert will be sent immediately."
                ) : (
                  <>
                    This alert will be saved and you'll be asked to confirm it on{" "}
                    <span className="font-medium text-foreground">
                      {format(routeDate!, "MMMM do")}
                    </span>{" "}
                    before it sends.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {alertsCopy.repAlerts.form.cancelButton}
          </Button>
          
          {/* Two-button layout: Send Now (secondary) and Schedule (primary) */}
          {isDateToday ? (
            // If today, just show "Send Today" as primary
            <Button 
              onClick={() => handleSend(true)} 
              disabled={sending || !isFormValid}
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Sending..." : "Send Today"}
            </Button>
          ) : (
            // If future date, show both buttons
            <>
              <Button 
                variant="secondary"
                onClick={() => handleSend(true)} 
                disabled={sending || !isFormValid}
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? "Sending..." : "Send Now"}
              </Button>
              <Button 
                onClick={() => handleSend(false)} 
                disabled={sending || !isFormValid}
              >
                <Clock className="w-4 h-4 mr-2" />
                {sending ? "Scheduling..." : `Schedule for ${formattedScheduleDate}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
