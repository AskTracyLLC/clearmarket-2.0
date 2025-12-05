import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isBefore, startOfToday, addDays } from "date-fns";

interface OfficeHours {
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  timezone: string;
}

interface CalendarEvent {
  id: string;
  event_date: string;
  event_type: "office_closed" | "pay_day" | "note";
  title: string;
  description: string | null;
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
        // Load office hours
        const { data: hoursData } = await supabase
          .from("vendor_office_hours")
          .select("weekday, open_time, close_time, timezone")
          .eq("vendor_id", vendorId)
          .order("weekday");

        setOfficeHours(hoursData || []);

        // Load upcoming events (next 90 days)
        const today = format(startOfToday(), "yyyy-MM-dd");
        const futureDate = format(addDays(startOfToday(), 90), "yyyy-MM-dd");

        const { data: eventsData } = await supabase
          .from("vendor_calendar_events")
          .select("*")
          .eq("vendor_id", vendorId)
          .gte("event_date", today)
          .lte("event_date", futureDate)
          .order("event_date", { ascending: true });

        setEvents((eventsData || []) as CalendarEvent[]);
      } catch (error) {
        console.error("Error loading vendor calendar:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, vendorId]);

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

    // Group consecutive days with same hours
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

  const nextPayDay = events.find(e => e.event_type === "pay_day");

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

            {/* Next Pay Day */}
            {nextPayDay && (
              <Card className="p-4 border-primary/30">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Next Pay Day</h3>
                    <p className="text-sm text-foreground">
                      {format(parseISO(nextPayDay.event_date), "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">{nextPayDay.title}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Upcoming Events */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">Upcoming Events</h3>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming events scheduled.
                </p>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
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
    loading: boolean;
  }>({
    hoursSummary: null,
    nextPayDay: null,
    loading: true,
  });

  useEffect(() => {
    if (!vendorId) {
      setSummary({ hoursSummary: null, nextPayDay: null, loading: false });
      return;
    }

    async function load() {
      try {
        // Load office hours
        const { data: hoursData } = await supabase
          .from("vendor_office_hours")
          .select("weekday, open_time, close_time, timezone")
          .eq("vendor_id", vendorId)
          .order("weekday");

        // Build hours summary
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

            // Simplified: just show first open time range
            const first = openDays[0];
            const last = openDays[openDays.length - 1];
            const dayRange = openDays.length === 1
              ? WEEKDAY_LABELS[first.weekday]
              : `${WEEKDAY_LABELS[first.weekday]}–${WEEKDAY_LABELS[last.weekday]}`;
            hoursSummary = `${dayRange}, ${formatTime(first.open_time!)}–${formatTime(first.close_time!)}`;

            // Get timezone abbreviation
            const tz = first.timezone || "America/Chicago";
            const tzAbbr = tz === "America/Chicago" ? "CT" : tz.split("/")[1]?.substring(0, 2) || "";
            if (tzAbbr) hoursSummary += ` (${tzAbbr})`;
          }
        }

        // Load next pay day
        const today = format(startOfToday(), "yyyy-MM-dd");
        const { data: payDayData } = await supabase
          .from("vendor_calendar_events")
          .select("event_date, title")
          .eq("vendor_id", vendorId)
          .eq("event_type", "pay_day")
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        const nextPayDay = payDayData
          ? { date: payDayData.event_date, title: payDayData.title }
          : null;

        setSummary({ hoursSummary, nextPayDay, loading: false });
      } catch (error) {
        console.error("Error loading vendor calendar summary:", error);
        setSummary({ hoursSummary: null, nextPayDay: null, loading: false });
      }
    }

    load();
  }, [vendorId]);

  return summary;
}
