import { useEffect, useState } from "react";
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
import { ArrowLeft, Clock, Calendar, Plus, Pencil, Trash2 } from "lucide-react";
import AdminViewBanner from "@/components/AdminViewBanner";
import { AddCalendarEventDialog } from "@/components/AddCalendarEventDialog";
import { format, parseISO, isBefore, startOfToday } from "date-fns";
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
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

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

    // Determine which vendor ID to use
    const targetVendorId = viewingVendorId || user.id;
    
    // If admin is viewing another vendor, verify admin status
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
      // Load office hours
      const { data: hoursData, error: hoursError } = await supabase
        .from("vendor_office_hours")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("weekday");

      if (hoursError) throw hoursError;

      // Build full week with defaults
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

      // Load calendar events
      const { data: eventsData, error: eventsError } = await supabase
        .from("vendor_calendar_events")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("event_date", { ascending: true });

      if (eventsError) throw eventsError;

      setEvents((eventsData || []) as CalendarEvent[]);
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
      // Upsert all office hours
      for (const hours of officeHours) {
        const payload = {
          vendor_id: targetVendorId,
          weekday: hours.weekday,
          open_time: hours.isClosed ? null : hours.open_time,
          close_time: hours.isClosed ? null : hours.close_time,
          timezone: hours.timezone,
        };

        if (hours.id) {
          // Update existing
          const { error } = await supabase
            .from("vendor_office_hours")
            .update(payload)
            .eq("id", hours.id);
          if (error) throw error;
        } else {
          // Insert new
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

      // Reload to get IDs
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
      // Mon-Fri (1-5) = open 9-5, Sat-Sun = closed
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
    if (!deletingEventId) return;

    try {
      const { error } = await supabase
        .from("vendor_calendar_events")
        .delete()
        .eq("id", deletingEventId);

      if (error) throw error;

      setEvents(prev => prev.filter(e => e.id !== deletingEventId));
      toast({
        title: "Deleted",
        description: "Event deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "Failed to delete event.",
        variant: "destructive",
      });
    } finally {
      setDeletingEventId(null);
    }
  };

  const filteredEvents = events.filter(e => {
    if (eventFilter === "all") return true;
    return e.event_type === eventFilter;
  });

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

        {/* Calendar Events */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Office Closed & Pay Days</CardTitle>
              </div>
              <Button onClick={() => setShowAddEventDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </div>
            <CardDescription>
              Mark specific dates for office closures, pay days, and other important dates.
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
                  <SelectItem value="pay_day">Pay Days</SelectItem>
                  <SelectItem value="note">Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No events scheduled yet.</p>
                <p className="text-sm">Add office closures, pay days, or notes to keep reps informed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((event) => {
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
                        <div className="flex items-center gap-2 mb-1">
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
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingEventId(event.id)}
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
      <AlertDialog open={!!deletingEventId} onOpenChange={() => setDeletingEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The event will be permanently removed.
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
