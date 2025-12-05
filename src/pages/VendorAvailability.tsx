import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Calendar, Plus, Pencil, Trash2, Repeat, DollarSign, CalendarDays } from "lucide-react";
import AdminViewBanner from "@/components/AdminViewBanner";
import { AddCalendarEventDialog } from "@/components/AddCalendarEventDialog";
import { VendorNetworkAlertsCard } from "@/components/VendorNetworkAlertsCard";
import { CalendarMonthView, CalendarEventPreview } from "@/components/CalendarMonthView";
import { CalendarDayDialog } from "@/components/CalendarDayDialog";
import { format, parseISO, isBefore, startOfToday, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RecurrenceType, getRecurrenceDescription, getUpcomingPayDatesForSchedule } from "@/lib/recurringEvents";

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const DEFAULT_HOURS = {
  open: "09:00",
  close: "17:00",
};

interface OfficeHours {
  id?: string;
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  timezone: string;
  isClosed: boolean;
}

interface CalendarEvent {
  id: string;
  event_date: string;
  event_type: "office_closed" | "pay_day" | "note";
  title: string;
  description: string | null;
  is_recurring: boolean;
  recurrence_type: RecurrenceType | null;
  recurrence_until: string | null;
}

const VendorAvailability = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ is_vendor_admin: boolean; is_admin: boolean } | null>(null);
  const [viewingVendorId, setViewingVendorId] = useState<string | null>(null);
  const [officeHours, setOfficeHours] = useState<OfficeHours[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  
  // Calendar view state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [networkAlerts, setNetworkAlerts] = useState<any[]>([]);

  // Check for vendorId param (admin viewing)
  useEffect(() => {
    const vendorIdParam = searchParams.get("vendorId");
    if (vendorIdParam) {
      setViewingVendorId(vendorIdParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/signin");
      return;
    }

    if (user) {
      checkAccess();
    }
  }, [user, authLoading, navigate, viewingVendorId]);

  const checkAccess = async () => {
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("is_vendor_admin, is_admin")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    if (!profileData?.is_vendor_admin && !profileData?.is_admin) {
      toast({
        title: "Access Denied",
        description: "This page is only available to vendor accounts.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    const targetVendorId = viewingVendorId || user.id;
    
    if (viewingVendorId && viewingVendorId !== user.id && !profileData?.is_admin) {
      toast({
        title: "Access Denied",
        description: "You can only view your own availability.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    loadData(targetVendorId);
  };

  const loadData = async (vendorId: string) => {
    setLoading(true);
    try {
      const { data: hoursData, error: hoursError } = await supabase
        .from("vendor_office_hours")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("weekday");

      if (hoursError) throw hoursError;

      const hoursMap = new Map(hoursData?.map(h => [h.weekday, h]));
      const fullWeek: OfficeHours[] = WEEKDAYS.map(day => {
        const existing = hoursMap.get(day.value);
        if (existing) {
          return {
            id: existing.id,
            weekday: existing.weekday,
            open_time: existing.open_time,
            close_time: existing.close_time,
            timezone: existing.timezone || "America/Chicago",
            isClosed: !existing.open_time,
          };
        }
        return {
          weekday: day.value,
          open_time: null,
          close_time: null,
          timezone: "America/Chicago",
          isClosed: true,
        };
      });

      setOfficeHours(fullWeek);

      const { data: eventsData, error: eventsError } = await supabase
        .from("vendor_calendar_events")
        .select("id, vendor_id, event_date, event_type, title, description, is_recurring, recurrence_type, recurrence_until")
        .eq("vendor_id", vendorId)
        .order("event_date", { ascending: true });

      if (eventsError) throw eventsError;

      setEvents((eventsData || []).map(e => ({
        ...e,
        is_recurring: e.is_recurring ?? false,
        recurrence_type: e.recurrence_type as RecurrenceType | null,
        recurrence_until: e.recurrence_until,
      })) as CalendarEvent[]);
      
      // Load network alerts for calendar view
      const { data: alertsData, error: alertsError } = await supabase
        .from("rep_network_alerts")
        .select("id, title, body, scheduled_at, status")
        .eq("vendor_id", vendorId)
        .in("status", ["scheduled", "pending"]);
      
      if (!alertsError) {
        setNetworkAlerts(alertsData || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load availability data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClosed = (weekday: number, isClosed: boolean) => {
    setOfficeHours(prev => prev.map(h => {
      if (h.weekday === weekday) {
        return {
          ...h,
          isClosed,
          open_time: isClosed ? null : DEFAULT_HOURS.open,
          close_time: isClosed ? null : DEFAULT_HOURS.close,
        };
      }
      return h;
    }));
  };

  const handleTimeChange = (weekday: number, field: "open_time" | "close_time", value: string) => {
    setOfficeHours(prev => prev.map(h => {
      if (h.weekday === weekday) {
        return { ...h, [field]: value };
      }
      return h;
    }));
  };

  const handleSaveHours = async () => {
    const targetVendorId = viewingVendorId || user?.id;
    if (!targetVendorId) return;

    setSaving(true);
    try {
      for (const hours of officeHours) {
        const payload = {
          vendor_id: targetVendorId,
          weekday: hours.weekday,
          open_time: hours.isClosed ? null : hours.open_time,
          close_time: hours.isClosed ? null : hours.close_time,
          timezone: hours.timezone,
        };

        if (hours.id) {
          const { error } = await supabase
            .from("vendor_office_hours")
            .update(payload)
            .eq("id", hours.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("vendor_office_hours")
            .insert(payload);
          if (error) throw error;
        }
      }

      toast({
        title: "Saved",
        description: "Office hours updated successfully.",
      });

      loadData(targetVendorId);
    } catch (error) {
      console.error("Error saving hours:", error);
      toast({
        title: "Error",
        description: "Failed to save office hours.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setOfficeHours(prev => prev.map(h => {
      const isWeekday = h.weekday >= 1 && h.weekday <= 5;
      return {
        ...h,
        isClosed: !isWeekday,
        open_time: isWeekday ? DEFAULT_HOURS.open : null,
        close_time: isWeekday ? DEFAULT_HOURS.close : null,
      };
    }));
  };

  const handleEventSaved = () => {
    const targetVendorId = viewingVendorId || user?.id;
    if (targetVendorId) {
      loadData(targetVendorId);
    }
    setShowAddEventDialog(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;

    try {
      const { error } = await supabase
        .from("vendor_calendar_events")
        .delete()
        .eq("id", deletingEvent.id);

      if (error) throw error;

      setEvents(prev => prev.filter(e => e.id !== deletingEvent.id));
      toast({
        title: "Deleted",
        description: deletingEvent.is_recurring 
          ? "Pay schedule deleted. All future pay dates removed."
          : "Event deleted successfully.",
      });
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete event.",
        variant: "destructive",
      });
    } finally {
      setDeletingEvent(null);
    }
  };

  // Separate recurring pay schedules from one-off events
  const paySchedules = events.filter(e => e.event_type === "pay_day" && e.is_recurring);
  
  // One-off events: non-recurring pay days + all other event types
  const oneOffEvents = events.filter(e => {
    if (e.event_type === "pay_day") return !e.is_recurring;
    return true;
  });

  // Apply filter to one-off events
  const filteredOneOffEvents = oneOffEvents.filter(e => {
    if (eventFilter === "all") return true;
    if (eventFilter === "pay_day") return e.event_type === "pay_day";
    return e.event_type === eventFilter;
  });

  // Convert data to calendar events for the month view
  const calendarEvents = useMemo(() => {
    const evts: CalendarEventPreview[] = [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Add office closed events
    events.forEach((event) => {
      if (event.event_type === "office_closed") {
        evts.push({
          id: event.id,
          date: event.event_date,
          type: "office_closed",
          label: event.title || "Office Closed",
        });
      }
    });

    // Add scheduled network alerts
    networkAlerts.forEach((alert) => {
      if (alert.scheduled_at) {
        const alertDate = alert.scheduled_at.split("T")[0];
        evts.push({
          id: alert.id,
          date: alertDate,
          type: "alert",
          label: alert.title || "Scheduled Alert",
        });
      }
    });

    // Add upcoming pay days from recurring schedules
    paySchedules.forEach((schedule) => {
      const upcomingDates = getUpcomingPayDatesForSchedule(schedule, 6);
      upcomingDates.forEach((date, i) => {
        if (isWithinInterval(date, { start: monthStart, end: monthEnd })) {
          evts.push({
            id: `${schedule.id}-pay-${i}`,
            date: format(date, "yyyy-MM-dd"),
            type: "pay_day",
            label: "Pay Day",
          });
        }
      });
    });

    return evts;
  }, [events, networkAlerts, paySchedules, currentMonth]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowDayDialog(true);
  };

  const handleCalendarEventSaved = () => {
    const vid = viewingVendorId || user?.id;
    if (vid) loadData(vid);
  };

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return calendarEvents.filter((e) => e.date === dateKey);
  }, [selectedDate, calendarEvents]);

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

  const isAdminViewing = profile?.is_admin && viewingVendorId && viewingVendorId !== user?.id;
  const targetVendorId = viewingVendorId || user?.id;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isAdminViewing && <AdminViewBanner />}
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Office & Pay Calendar</h1>
          <p className="text-muted-foreground">
            Share your office hours, closure dates, and pay days with connected Field Reps.
          </p>
        </div>

        {/* Calendar Month View */}
        <div className="mb-8">
          <CalendarMonthView
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            events={calendarEvents}
            onDayClick={handleDayClick}
            selectedDate={selectedDate}
          />
        </div>

        {/* Day dialog for adding events */}
        <CalendarDayDialog
          open={showDayDialog}
          onOpenChange={setShowDayDialog}
          date={selectedDate}
          mode="vendor"
          userId={targetVendorId || ""}
          existingEvents={selectedDateEvents}
          onEventSaved={handleCalendarEventSaved}
        />

        {/* Weekly Office Hours */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Weekly Office Hours</CardTitle>
            </div>
            <CardDescription>
              Reps will see these hours on your profile and in their My Vendors view.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {officeHours.map((hours) => {
              const dayLabel = WEEKDAYS.find(d => d.value === hours.weekday)?.label || "";
              return (
                <div key={hours.weekday} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <div className="w-28 font-medium text-foreground">{dayLabel}</div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={hours.isClosed}
                      onCheckedChange={(checked) => handleToggleClosed(hours.weekday, checked)}
                    />
                    <span className="text-sm text-muted-foreground">Closed</span>
                  </div>
                  {!hours.isClosed && (
                    <div className="flex items-center gap-2 ml-4">
                      <Input
                        type="time"
                        value={hours.open_time || ""}
                        onChange={(e) => handleTimeChange(hours.weekday, "open_time", e.target.value)}
                        className="w-32"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={hours.close_time || ""}
                        onChange={(e) => handleTimeChange(hours.weekday, "close_time", e.target.value)}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSaveHours} disabled={saving}>
                {saving ? "Saving..." : "Save Hours"}
              </Button>
              <Button variant="outline" onClick={handleResetToDefault}>
                Reset to Mon–Fri 9–5
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pay Schedule Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle>Pay Schedule</CardTitle>
              </div>
              <Button onClick={() => setShowAddEventDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Pay Day
              </Button>
            </div>
            <CardDescription>
              Manage your recurring pay days. Reps will see upcoming dates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paySchedules.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recurring pay schedule set yet.</p>
                <p className="text-xs mt-1">Add a Pay Day event and mark it as repeating to create your schedule.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paySchedules.map((schedule) => {
                  const baseDate = parseISO(schedule.event_date);
                  const upcomingDates = getUpcomingPayDatesForSchedule(schedule, 3);
                  const recurrenceDesc = getRecurrenceDescription(schedule.recurrence_type, baseDate);
                  
                  return (
                    <div
                      key={schedule.id}
                      className="p-4 rounded-lg border border-primary/30 bg-primary/5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                              <Repeat className="h-3 w-3 mr-1" />
                              Pay Day
                            </Badge>
                            <span className="text-sm font-medium text-foreground">{recurrenceDesc}</span>
                          </div>
                          
                          {upcomingDates.length > 0 ? (
                            <p className="text-sm text-muted-foreground">
                              <span className="text-xs uppercase tracking-wide">Next pay days: </span>
                              {upcomingDates.map((d, i) => (
                                <span key={i}>
                                  {i > 0 && " · "}
                                  {format(d, "MMM d, yyyy")}
                                </span>
                              ))}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">No upcoming pay dates</p>
                          )}
                          
                          {schedule.recurrence_until && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Ends: {format(parseISO(schedule.recurrence_until), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingEvent(schedule);
                              setShowAddEventDialog(true);
                            }}
                            title="Edit schedule"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingEvent(schedule)}
                            title="Delete schedule"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Office Closed & One-off Events */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Office Closed & One-off Events</CardTitle>
              </div>
              <Button onClick={() => setShowAddEventDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </div>
            <CardDescription>
              Mark specific dates for office closures, one-time pay days, and other notes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label className="text-sm text-muted-foreground mb-2 block">Filter events</Label>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="office_closed">Office Closed</SelectItem>
                  <SelectItem value="pay_day">One-off Pay Days</SelectItem>
                  <SelectItem value="note">Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredOneOffEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No one-off events scheduled.</p>
                <p className="text-sm">Add office closures, special pay days, or notes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOneOffEvents.map((event) => {
                  const eventDate = parseISO(event.event_date);
                  const isPast = isBefore(eventDate, startOfToday());
                  
                  return (
                    <div
                      key={event.id}
                      className={`flex items-start justify-between p-3 rounded-lg border ${
                        isPast ? "border-border/50 bg-muted/30" : "border-border bg-card"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`font-medium ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
                            {format(eventDate, "EEEE, MMMM d, yyyy")}
                          </span>
                          {getEventTypeBadge(event.event_type)}
                          {isPast && (
                            <Badge variant="outline" className="text-xs">Past</Badge>
                          )}
                        </div>
                        <p className={`text-sm ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
                          {event.title}
                        </p>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingEvent(event);
                            setShowAddEventDialog(true);
                          }}
                          title="Edit event"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingEvent(event)}
                          title="Delete event"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Alerts */}
        {targetVendorId && (
          <VendorNetworkAlertsCard vendorId={targetVendorId} />
        )}
      </div>

      {/* Add/Edit Event Dialog */}
      <AddCalendarEventDialog
        open={showAddEventDialog}
        onOpenChange={(open) => {
          setShowAddEventDialog(open);
          if (!open) setEditingEvent(null);
        }}
        vendorId={targetVendorId || ""}
        existingEvent={editingEvent}
        onSaved={handleEventSaved}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEvent} onOpenChange={() => setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingEvent?.is_recurring ? "Delete Pay Schedule?" : "Delete Event?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingEvent?.is_recurring 
                ? "This will remove all future pay day instances from your calendar. This action cannot be undone."
                : "This action cannot be undone. The event will be permanently removed."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VendorAvailability;
