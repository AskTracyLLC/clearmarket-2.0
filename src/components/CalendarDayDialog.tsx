import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarEventPreview } from "./CalendarMonthView";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Bell, X } from "lucide-react";

interface CalendarDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  mode: "rep" | "vendor";
  userId: string;
  existingEvents?: CalendarEventPreview[];
  onEventSaved?: () => void;
}

type EventType = "time_off" | "office_closed" | "alert";

export function CalendarDayDialog({
  open,
  onOpenChange,
  date,
  mode,
  userId,
  existingEvents = [],
  onEventSaved,
}: CalendarDayDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [eventType, setEventType] = useState<EventType>(
    mode === "rep" ? "time_off" : "office_closed"
  );
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [note, setNote] = useState("");
  
  // Alert-specific state
  const [alertTitle, setAlertTitle] = useState("");
  const [alertBody, setAlertBody] = useState("");
  const [alertTime, setAlertTime] = useState("09:00");
  
  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEventType(mode === "rep" ? "time_off" : "office_closed");
      setIsFullDay(true);
      setStartTime("09:00");
      setEndTime("17:00");
      setNote("");
      setAlertTitle("");
      setAlertBody("");
      setAlertTime("09:00");
    }
  }, [open, mode]);

  const handleSave = async () => {
    if (!date || !userId) return;

    setSaving(true);
    try {
      if (eventType === "time_off") {
        // Rep time off - uses rep_availability table
        const startDate = format(date, "yyyy-MM-dd");
        const endDate = format(date, "yyyy-MM-dd"); // Single day for now
        
        const { error } = await supabase.from("rep_availability").insert({
          rep_user_id: userId,
          start_date: startDate,
          end_date: endDate,
          reason: note.trim() || null,
          auto_reply_enabled: false,
          auto_reply_message: null,
        });

        if (error) throw error;

        toast({
          title: "Time Off Added",
          description: `Time off scheduled for ${format(date, "MMMM d, yyyy")}`,
        });
      } else if (eventType === "office_closed") {
        // Vendor office closed - uses vendor_calendar_events table
        const { error } = await supabase.from("vendor_calendar_events").insert({
          vendor_id: userId,
          event_date: format(date, "yyyy-MM-dd"),
          event_type: "office_closed",
          title: "Office Closed",
          description: note.trim() || null,
          is_recurring: false,
        });

        if (error) throw error;

        toast({
          title: "Office Closed Added",
          description: `Office closure scheduled for ${format(date, "MMMM d, yyyy")}`,
        });
      } else if (eventType === "alert") {
        // Schedule future alert
        if (!alertTitle.trim() || !alertBody.trim()) {
          toast({
            title: "Validation Error",
            description: "Alert title and message are required.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        // Combine date and time for scheduled_at
        const scheduledAt = new Date(date);
        const [hours, minutes] = alertTime.split(":").map(Number);
        scheduledAt.setHours(hours, minutes, 0, 0);

        if (mode === "rep") {
          // Rep sending alert to vendors - uses vendor_alerts table
          // Get connected vendors first
          const { data: connections, error: connectionsError } = await supabase
            .from("vendor_connections")
            .select("vendor_id")
            .eq("field_rep_id", userId)
            .eq("status", "connected");

          if (connectionsError) throw connectionsError;

          const vendorIds = connections?.map(c => c.vendor_id) || [];

          if (vendorIds.length === 0) {
            toast({
              title: "No Connected Vendors",
              description: "You don't have any connected vendors to send alerts to.",
              variant: "default",
            });
            setSaving(false);
            return;
          }

          const { error } = await supabase.from("vendor_alerts").insert({
            rep_user_id: userId,
            alert_type: "scheduled",
            message: alertBody.trim(),
            recipient_vendor_ids: vendorIds,
          });

          if (error) throw error;

          // Create notifications for each vendor
          for (const vendorId of vendorIds) {
            await supabase.from("notifications").insert({
              user_id: vendorId,
              type: "vendor_alert",
              title: alertTitle.trim(),
              body: alertBody.trim().substring(0, 200),
            });
          }

          toast({
            title: "Alert Scheduled",
            description: `Alert will be sent to ${vendorIds.length} vendor${vendorIds.length !== 1 ? "s" : ""}.`,
          });
        } else {
          // Vendor sending alert to reps - uses rep_network_alerts table
          const { error } = await supabase.from("rep_network_alerts").insert({
            vendor_id: userId,
            title: alertTitle.trim(),
            body: alertBody.trim(),
            send_mode: "scheduled",
            scheduled_at: scheduledAt.toISOString(),
            status: "scheduled",
            target_scope: "all_connected",
          });

          if (error) throw error;

          toast({
            title: "Alert Scheduled",
            description: `Alert scheduled for ${format(scheduledAt, "MMMM d, yyyy 'at' h:mm a")}`,
          });
        }
      }

      onEventSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!date) return null;

  const eventTypeOptions = mode === "rep" 
    ? [
        { value: "time_off", label: "Time Off", icon: Calendar },
        { value: "alert", label: "Schedule Future Alert", icon: Bell },
      ]
    : [
        { value: "office_closed", label: "Office Closed", icon: X },
        { value: "alert", label: "Schedule Future Alert", icon: Bell },
      ];

  const dayEvents = existingEvents.filter(
    e => e.date === format(date, "yyyy-MM-dd")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {format(date, "EEEE, MMMM d, yyyy")}
          </DialogTitle>
          <DialogDescription>
            Add an event for this date
          </DialogDescription>
        </DialogHeader>

        {/* Existing events on this day */}
        {dayEvents.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Existing Events
            </p>
            {dayEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {event.type === "time_off" && "Time Off"}
                  {event.type === "office_closed" && "Office Closed"}
                  {event.type === "alert" && "Alert"}
                  {event.type === "pay_day" && "Pay Day"}
                </Badge>
                <span className="text-sm text-muted-foreground">{event.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Event type selector */}
          <div className="space-y-2">
            <Label>What do you want to schedule?</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Off / Office Closed form */}
          {(eventType === "time_off" || eventType === "office_closed") && (
            <>
              <div className="flex items-center gap-3">
                <Switch
                  id="full-day"
                  checked={isFullDay}
                  onCheckedChange={setIsFullDay}
                />
                <Label htmlFor="full-day">Full day</Label>
              </div>

              {!isFullDay && (
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <span className="text-muted-foreground mt-5">to</span>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">End</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder={
                    eventType === "time_off"
                      ? "e.g., Vacation, Personal day..."
                      : "e.g., Holiday closure, Company event..."
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Alert form */}
          {eventType === "alert" && (
            <>
              <div className="space-y-2">
                <Label>Alert Title</Label>
                <Input
                  placeholder="e.g., Schedule Update"
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Write your alert message..."
                  value={alertBody}
                  onChange={(e) => setAlertBody(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Send at</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={alertTime}
                    onChange={(e) => setAlertTime(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    on {format(date, "MMM d")}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
