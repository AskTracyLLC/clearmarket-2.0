import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RECURRENCE_OPTIONS, RecurrenceType } from "@/lib/recurringEvents";

interface CalendarEvent {
  id: string;
  event_date: string;
  event_type: "office_closed" | "pay_day" | "note";
  title: string;
  description: string | null;
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType | null;
  recurrence_until?: string | null;
}

interface AddCalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  existingEvent?: CalendarEvent | null;
  onSaved: () => void;
}

export function AddCalendarEventDialog({
  open,
  onOpenChange,
  vendorId,
  existingEvent,
  onSaved,
}: AddCalendarEventDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [eventType, setEventType] = useState<"office_closed" | "pay_day" | "note">("office_closed");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  
  // Recurrence state (only for pay_day)
  const [recurrenceType, setRecurrenceType] = useState<string>("none");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [recurrenceUntil, setRecurrenceUntil] = useState<Date | undefined>(undefined);

  // Reset form when dialog opens/closes or when editing
  useEffect(() => {
    if (open) {
      if (existingEvent) {
        setDate(new Date(existingEvent.event_date));
        setEventType(existingEvent.event_type);
        setTitle(existingEvent.title);
        setDescription(existingEvent.description || "");
        
        // Set recurrence fields
        if (existingEvent.is_recurring && existingEvent.recurrence_type) {
          setRecurrenceType(existingEvent.recurrence_type);
        } else {
          setRecurrenceType("none");
        }
        
        if (existingEvent.recurrence_until) {
          setHasEndDate(true);
          setRecurrenceUntil(new Date(existingEvent.recurrence_until));
        } else {
          setHasEndDate(false);
          setRecurrenceUntil(undefined);
        }
      } else {
        setDate(undefined);
        setEventType("office_closed");
        setTitle("");
        setDescription("");
        setRecurrenceType("none");
        setHasEndDate(false);
        setRecurrenceUntil(undefined);
      }
    }
  }, [open, existingEvent]);

  // Auto-fill title based on event type
  useEffect(() => {
    if (!existingEvent && eventType) {
      switch (eventType) {
        case "office_closed":
          setTitle("Office Closed");
          break;
        case "pay_day":
          setTitle("Pay Day");
          break;
        case "note":
          setTitle("");
          break;
      }
    }
  }, [eventType, existingEvent]);

  // Reset recurrence when switching away from pay_day
  useEffect(() => {
    if (eventType !== "pay_day") {
      setRecurrenceType("none");
      setHasEndDate(false);
      setRecurrenceUntil(undefined);
    }
  }, [eventType]);

  const handleSave = async () => {
    if (!date || !title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a date and enter a title.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const isRecurring = eventType === "pay_day" && recurrenceType !== "none";
      
      const payload = {
        vendor_id: vendorId,
        event_date: format(date, "yyyy-MM-dd"),
        event_type: eventType,
        title: title.trim(),
        description: description.trim() || null,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : null,
        recurrence_until: isRecurring && hasEndDate && recurrenceUntil 
          ? format(recurrenceUntil, "yyyy-MM-dd") 
          : null,
      };

      if (existingEvent) {
        const { error } = await supabase
          .from("vendor_calendar_events")
          .update(payload)
          .eq("id", existingEvent.id);

        if (error) throw error;

        toast({
          title: "Updated",
          description: isRecurring 
            ? "Recurring pay day updated. All future instances will reflect this change."
            : "Event updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from("vendor_calendar_events")
          .insert(payload);

        if (error) throw error;

        toast({
          title: "Added",
          description: isRecurring 
            ? "Recurring pay day added to calendar."
            : "Event added to calendar.",
        });
      }

      onSaved();
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description: "Failed to save event.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const showRecurrenceOptions = eventType === "pay_day";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{existingEvent ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label>Event Type</Label>
            <RadioGroup value={eventType} onValueChange={(v) => setEventType(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="office_closed" id="office_closed" />
                <Label htmlFor="office_closed" className="font-normal cursor-pointer">
                  Office Closed
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pay_day" id="pay_day" />
                <Label htmlFor="pay_day" className="font-normal cursor-pointer">
                  Pay Day
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="note" id="note" />
                <Label htmlFor="note" className="font-normal cursor-pointer">
                  Other Note
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Recurrence Options (only for Pay Day) */}
          {showRecurrenceOptions && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="space-y-2">
                <Label>Repeats</Label>
                <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {recurrenceType !== "none" && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasEndDate"
                      checked={hasEndDate}
                      onCheckedChange={(checked) => setHasEndDate(checked === true)}
                    />
                    <Label htmlFor="hasEndDate" className="font-normal cursor-pointer">
                      End by a specific date
                    </Label>
                  </div>

                  {hasEndDate && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !recurrenceUntil && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {recurrenceUntil ? format(recurrenceUntil, "PPP") : "Select end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={recurrenceUntil}
                          onSelect={setRecurrenceUntil}
                          disabled={(d) => date ? d < date : false}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  )}

                  {!hasEndDate && (
                    <p className="text-xs text-muted-foreground">
                      Without an end date, pay days will show for the next 12 months.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Office Closed – Thanksgiving"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : existingEvent ? "Update" : "Add Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
