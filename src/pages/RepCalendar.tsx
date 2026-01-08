import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CalendarMonthView, CalendarEventPreview } from "@/components/CalendarMonthView";
import { CalendarDayDialog } from "@/components/CalendarDayDialog";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";


interface AvailabilityEntry {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

interface VendorAlert {
  id: string;
  alert_type: string;
  message: string;
  created_at: string;
  affected_start_date: string | null;
  affected_end_date: string | null;
  is_scheduled: boolean;
  scheduled_status: string | null;
  route_date: string | null;
  route_state: string | null;
  route_counties: string[] | null;
}

export default function RepCalendar() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [availabilityEntries, setAvailabilityEntries] = useState<AvailabilityEntry[]>([]);
  const [vendorAlerts, setVendorAlerts] = useState<VendorAlert[]>([]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/signin");
      return;
    }

    checkAccessAndLoad();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadMonthData();
    }
  }, [currentMonth, user]);

  async function checkAccessAndLoad() {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_fieldrep, is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_fieldrep && !profile?.is_admin) {
        toast({
          title: "Access Denied",
          description: "This feature is only available for Field Reps.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      await loadMonthData();
    } catch (error) {
      console.error("Error checking access:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMonthData() {
    if (!user) return;

    try {
      // Load availability entries
      const { data: availability, error: availError } = await supabase
        .from("rep_availability")
        .select("id, start_date, end_date, reason")
        .eq("rep_user_id", user.id);

      if (availError) throw availError;
      setAvailabilityEntries(availability || []);

      // Load vendor alerts sent by this rep
      const { data: alerts, error: alertsError } = await supabase
        .from("vendor_alerts")
        .select("id, alert_type, message, created_at, affected_start_date, affected_end_date, is_scheduled, scheduled_status, route_date, route_state, route_counties")
        .eq("rep_user_id", user.id);

      if (alertsError) throw alertsError;
      setVendorAlerts(alerts || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  // Convert data to calendar events
  const calendarEvents = useMemo(() => {
    const events: CalendarEventPreview[] = [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Add time off entries
    availabilityEntries.forEach((entry) => {
      const start = parseISO(entry.start_date);
      const end = parseISO(entry.end_date);
      
      // Generate events for each day in the range that overlaps with current month
      let currentDate = start;
      while (currentDate <= end) {
        if (isWithinInterval(currentDate, { start: monthStart, end: monthEnd })) {
          events.push({
            id: `${entry.id}-${format(currentDate, "yyyy-MM-dd")}`,
            date: format(currentDate, "yyyy-MM-dd"),
            type: "time_off",
            label: entry.reason || "Time Off",
          });
        }
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Add alerts
    vendorAlerts.forEach((alert) => {
      // Skip canceled routes
      if (alert.scheduled_status === "canceled") return;
      
      // For planned routes, use route_date
      if (alert.alert_type === "planned_route" && alert.route_date) {
        const routeLabel = alert.route_counties?.length
          ? `Route: ${alert.route_state} – ${alert.route_counties.slice(0, 2).join(", ")}${alert.route_counties.length > 2 ? "..." : ""}`
          : `Route: ${alert.route_state}`;
        events.push({
          id: alert.id,
          date: alert.route_date,
          type: "planned_route" as any,
          label: routeLabel,
        });
        return;
      }
      
      const alertDate = alert.affected_start_date || alert.created_at.split("T")[0];
      if (alertDate) {
        events.push({
          id: alert.id,
          date: alertDate,
          type: "alert",
          label: alert.message.substring(0, 50) + (alert.message.length > 50 ? "..." : ""),
        });
      }
    });

    return events;
  }, [availabilityEntries, vendorAlerts, currentMonth]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowDayDialog(true);
  };

  const handleEventSaved = () => {
    loadMonthData();
  };

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return calendarEvents.filter((e) => e.date === dateKey);
  }, [selectedDate, calendarEvents]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-xl font-bold text-foreground">My Calendar</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          View and manage your time off, alerts, and availability. Click on any day to add an event.
        </p>

        {/* Calendar */}
        <CalendarMonthView
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          events={calendarEvents}
          onDayClick={handleDayClick}
          selectedDate={selectedDate}
        />

        {/* Selected day details */}
        {selectedDate && selectedDateEvents.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
              <CardDescription>
                {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""} scheduled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <Badge
                      variant="outline"
                      className={
                        event.type === "time_off"
                          ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                          : event.type === "alert"
                          ? "bg-cyan-500/20 text-cyan-500 border-cyan-500/30"
                          : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                      }
                    >
                      {event.type === "time_off" && "Time Off"}
                      {event.type === "alert" && "Alert"}
                      {event.type === "office_closed" && "Office Closed"}
                      {event.type === "planned_route" && "Planned Route"}
                    </Badge>
                    <span className="text-sm text-foreground">{event.label}</span>
                    {event.type === "planned_route" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => navigate("/rep/availability")}
                      >
                        View
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/rep/availability")}
            >
              Manage Time Off List
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Day dialog */}
      <CalendarDayDialog
        open={showDayDialog}
        onOpenChange={setShowDayDialog}
        date={selectedDate}
        mode="rep"
        userId={user?.id || ""}
        existingEvents={selectedDateEvents}
        onEventSaved={handleEventSaved}
      />
    </>
  );
}
