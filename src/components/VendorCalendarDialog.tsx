import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, Calendar, DollarSign, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfToday, addDays } from "date-fns";
import { 
  expandCalendarEvents, 
  RecurringEvent, 
  RecurrenceType,
  getRecurrenceDescription,
  getUpcomingPayDatesForSchedule
} from "@/lib/recurringEvents";

interface OfficeHours {
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  timezone: string;
}

interface CalendarEvent extends RecurringEvent {
  event_type: "office_closed" | "pay_day" | "note";
}

interface VendorCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName?: string;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function VendorCalendarDialog({
  open,
  onOpenChange,
  vendorId,
  vendorName,
}: VendorCalendarDialogProps) {
  const [loading, setLoading] = useState(true);
  const [officeHours, setOfficeHours] = useState<OfficeHours[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!open || !vendorId) return;

    async function loadData() {
      setLoading(true);
      try {
        const { data: hoursData } = await supabase
          .from("vendor_office_hours")
          .select("weekday, open_time, close_time, timezone")
          .eq("vendor_id", vendorId)
          .order("weekday");

        setOfficeHours(hoursData || []);

        const { data: eventsData } = await supabase
          .from("vendor_calendar_events")
          .select("id, vendor_id, event_date, event_type, title, description, is_recurring, recurrence_type, recurrence_until")
          .eq("vendor_id", vendorId)
          .order("event_date", { ascending: true });

        setEvents((eventsData || []).map(e => ({
          ...e,
          is_recurring: e.is_recurring ?? false,
          recurrence_type: e.recurrence_type as RecurrenceType | null,
          recurrence_until: e.recurrence_until,
        })) as CalendarEvent[]);
      } catch (error) {
        console.error("Error loading vendor calendar:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, vendorId]);

  // Separate recurring pay schedules from one-off events
  const paySchedules = events.filter(e => e.event_type === "pay_day" && e.is_recurring);
  const oneOffEvents = events.filter(e => {
    if (e.event_type === "pay_day") return !e.is_recurring;
    return true;
  });

  // Expand one-off events for display (next 90 days)
  const expandedOneOffEvents = useMemo(() => {
    const rangeStart = startOfToday();
    const rangeEnd = addDays(rangeStart, 90);
    const expanded = expandCalendarEvents(oneOffEvents, rangeStart, rangeEnd);
    const todayStr = format(rangeStart, "yyyy-MM-dd");
    return expanded.filter(e => e.event_date >= todayStr);
  }, [oneOffEvents]);

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getHoursSummary = () => {
    const openDays = officeHours.filter(h => h.open_time);
    if (openDays.length === 0) return "Hours not set";

    const groups: { days: number[]; open: string; close: string }[] = [];
    
    openDays.forEach(h => {
      const lastGroup = groups[groups.length - 1];
      if (
        lastGroup &&
        lastGroup.open === h.open_time &&
        lastGroup.close === h.close_time &&
        lastGroup.days[lastGroup.days.length - 1] === h.weekday - 1
      ) {
        lastGroup.days.push(h.weekday);
      } else {
        groups.push({
          days: [h.weekday],
          open: h.open_time!,
          close: h.close_time!,
        });
      }
    });

    return groups.map(g => {
      const dayRange = g.days.length === 1
        ? WEEKDAY_LABELS[g.days[0]]
        : `${WEEKDAY_LABELS[g.days[0]]}–${WEEKDAY_LABELS[g.days[g.days.length - 1]]}`;
      return `${dayRange} ${formatTime(g.open)}–${formatTime(g.close)}`;
    }).join(", ");
  };

  const getEventTypeBadge = (type: string) => {
    switch (type) {
      case "office_closed":
        return <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">Office Closed</Badge>;
      case "pay_day":
        return <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">Pay Day</Badge>;
      case "note":
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Note</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {vendorName ? `${vendorName}'s Calendar` : "Vendor Calendar"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Office Hours Summary */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Office Hours</h3>
                  {officeHours.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not specified</p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-2">
                        {getHoursSummary()}
                      </p>
                      <div className="grid grid-cols-7 gap-1 text-xs">
                        {WEEKDAY_LABELS.map((label, idx) => {
                          const hours = officeHours.find(h => h.weekday === idx);
                          const isOpen = hours?.open_time;
                          return (
                            <div
                              key={idx}
                              className={`text-center py-1 rounded ${
                                isOpen
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted/50 text-muted-foreground"
                              }`}
                            >
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* Pay Schedule Summary */}
            {paySchedules.length > 0 && (
              <Card className="p-4 border-primary/30">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-2">Pay Schedule</h3>
                    <div className="space-y-3">
                      {paySchedules.map((schedule) => {
                        const baseDate = parseISO(schedule.event_date);
                        const upcomingDates = getUpcomingPayDatesForSchedule(schedule, 3);
                        const recurrenceDesc = getRecurrenceDescription(schedule.recurrence_type, baseDate);
                        
                        return (
                          <div key={schedule.id} className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Repeat className="h-3 w-3 text-primary" />
                              <span className="font-medium text-foreground">{recurrenceDesc}</span>
                            </div>
                            {upcomingDates.length > 0 && (
                              <p className="text-muted-foreground text-xs">
                                Next: {upcomingDates.map((d, i) => (
                                  <span key={i}>
                                    {i > 0 && " · "}
                                    {format(d, "MMM d")}
                                  </span>
                                ))}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Upcoming Events (one-off only) */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">Upcoming Events</h3>
              {expandedOneOffEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming one-off events scheduled.
                </p>
              ) : (
                <div className="space-y-2">
                  {expandedOneOffEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {format(parseISO(event.event_date), "MMM d")}
                          </span>
                          {getEventTypeBadge(event.event_type)}
                        </div>
                        <p className="text-sm text-foreground">{event.title}</p>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper function to get summary for display in lists
export function useVendorCalendarSummary(vendorId: string) {
  const [summary, setSummary] = useState<{
    hoursSummary: string | null;
    nextPayDay: { date: string; title: string } | null;
    payScheduleDescription: string | null;
    loading: boolean;
  }>({
    hoursSummary: null,
    nextPayDay: null,
    payScheduleDescription: null,
    loading: true,
  });

  useEffect(() => {
    if (!vendorId) {
      setSummary({ hoursSummary: null, nextPayDay: null, payScheduleDescription: null, loading: false });
      return;
    }

    async function load() {
      try {
        const { data: hoursData } = await supabase
          .from("vendor_office_hours")
          .select("weekday, open_time, close_time, timezone")
          .eq("vendor_id", vendorId)
          .order("weekday");

        let hoursSummary: string | null = null;
        if (hoursData && hoursData.length > 0) {
          const openDays = hoursData.filter(h => h.open_time);
          if (openDays.length > 0) {
            const formatTime = (time: string) => {
              const [hours] = time.split(":");
              const hour = parseInt(hours);
              const ampm = hour >= 12 ? "PM" : "AM";
              const displayHour = hour % 12 || 12;
              return `${displayHour}${ampm}`;
            };

            const first = openDays[0];
            const last = openDays[openDays.length - 1];
            const dayRange = openDays.length === 1
              ? WEEKDAY_LABELS[first.weekday]
              : `${WEEKDAY_LABELS[first.weekday]}–${WEEKDAY_LABELS[last.weekday]}`;
            hoursSummary = `${dayRange}, ${formatTime(first.open_time!)}–${formatTime(first.close_time!)}`;

            const tz = first.timezone || "America/Chicago";
            const tzAbbr = tz === "America/Chicago" ? "CT" : tz.split("/")[1]?.substring(0, 2) || "";
            if (tzAbbr) hoursSummary += ` (${tzAbbr})`;
          }
        }

        const { data: payDayData } = await supabase
          .from("vendor_calendar_events")
          .select("id, event_date, title, is_recurring, recurrence_type, recurrence_until")
          .eq("vendor_id", vendorId)
          .eq("event_type", "pay_day")
          .order("event_date", { ascending: true });

        let nextPayDay: { date: string; title: string } | null = null;
        let payScheduleDescription: string | null = null;
        
        if (payDayData && payDayData.length > 0) {
          // Find recurring schedule for description
          const recurring = payDayData.find(e => e.is_recurring && e.recurrence_type);
          if (recurring) {
            const baseDate = parseISO(recurring.event_date);
            payScheduleDescription = getRecurrenceDescription(
              recurring.recurrence_type as RecurrenceType, 
              baseDate
            );
          }

          // Find next pay day (from any schedule)
          const today = startOfToday();
          const todayStr = format(today, "yyyy-MM-dd");
          
          for (const event of payDayData) {
            const upcomingDates = getUpcomingPayDatesForSchedule({
              ...event,
              event_type: "pay_day",
              description: null,
              is_recurring: event.is_recurring ?? false,
              recurrence_type: event.recurrence_type as RecurrenceType | null,
              recurrence_until: event.recurrence_until,
            }, 1);
            
            if (upcomingDates.length > 0) {
              const dateStr = format(upcomingDates[0], "yyyy-MM-dd");
              if (!nextPayDay || dateStr < nextPayDay.date) {
                nextPayDay = { date: dateStr, title: event.title };
              }
            }
          }
        }

        setSummary({ hoursSummary, nextPayDay, payScheduleDescription, loading: false });
      } catch (error) {
        console.error("Error loading vendor calendar summary:", error);
        setSummary({ hoursSummary: null, nextPayDay: null, payScheduleDescription: null, loading: false });
      }
    }

    load();
  }, [vendorId]);

  return summary;
}
