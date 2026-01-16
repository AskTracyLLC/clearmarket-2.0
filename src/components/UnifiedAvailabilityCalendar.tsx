import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Calendar, Edit, Trash2, Send, Eye, AlertTriangle } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday as dateFnsIsToday,
  addMonths,
  subMonths,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Types
export interface AvailabilityEntry {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

export interface CalendarAlert {
  id: string;
  alert_type: string;
  message: string;
  affected_start_date: string | null;
  affected_end_date: string | null;
  is_scheduled: boolean;
  scheduled_status: string | null;
  created_at: string;
  sent_at: string | null;
  route_date: string | null;
  route_state: string | null;
  route_counties: string[] | null;
}

interface UnifiedAvailabilityCalendarProps {
  availabilityEntries: AvailabilityEntry[];
  alerts: CalendarAlert[];
  onEditTimeOff: (entry: AvailabilityEntry) => void;
  onDeleteTimeOff: (entryId: string) => void;
  onEditAlert: (alert: CalendarAlert) => void;
  onSendNowAlert?: (alert: CalendarAlert) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Helper to get alert type display info
function getAlertTypeInfo(alertType: string): { label: string; isEmergency: boolean } {
  switch (alertType) {
    case "planned_route":
      return { label: "Planned Route", isEmergency: false };
    case "time_off_start":
      return { label: "Planned Time Off", isEmergency: false };
    case "emergency":
      return { label: "Emergency", isEmergency: true };
    case "availability":
      return { label: "Availability Update", isEmergency: false };
    default:
      return { label: "Alert", isEmergency: false };
  }
}

// Helper to format route chip text
function formatRouteChipText(alert: CalendarAlert): string {
  if (alert.alert_type !== "planned_route") return "";
  
  // Get state code (first 2 chars or try to extract from full name)
  const stateCode = alert.route_state?.length === 2 
    ? alert.route_state 
    : alert.route_state?.substring(0, 2).toUpperCase() || "";
  
  const counties = alert.route_counties || [];
  let countySummary = "";
  
  if (counties.length === 1) {
    countySummary = counties[0];
  } else if (counties.length === 2) {
    countySummary = counties.join(", ");
  } else if (counties.length >= 3) {
    countySummary = `${counties[0]} (+${counties.length - 1})`;
  }
  
  return stateCode ? `${stateCode} - ${countySummary}` : countySummary;
}

// Check if alert is on a specific date
function isAlertOnDate(alert: CalendarAlert, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  
  // For planned routes, use route_date
  if (alert.alert_type === "planned_route" && alert.route_date) {
    return alert.route_date === dateStr;
  }
  
  // For other alerts, check date range
  if (alert.affected_start_date && alert.affected_end_date) {
    const start = parseISO(alert.affected_start_date);
    const end = parseISO(alert.affected_end_date);
    return isWithinInterval(date, { start, end });
  }
  
  // Single date alerts
  if (alert.affected_start_date) {
    return alert.affected_start_date === dateStr;
  }
  
  return false;
}

// Check if time off covers a date
function isTimeOffOnDate(entry: AvailabilityEntry, date: Date): boolean {
  const start = parseISO(entry.start_date);
  const end = parseISO(entry.end_date);
  return isWithinInterval(date, { start, end });
}

export function UnifiedAvailabilityCalendar({
  availabilityEntries,
  alerts,
  onEditTimeOff,
  onDeleteTimeOff,
  onEditAlert,
  onSendNowAlert,
}: UnifiedAvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTimeOff, setShowTimeOff] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get items for a specific day
  const getItemsForDay = (day: Date) => {
    const timeOffItems = showTimeOff 
      ? availabilityEntries.filter(e => isTimeOffOnDate(e, day))
      : [];
    
    const alertItems = showAlerts
      ? alerts.filter(a => isAlertOnDate(a, day) && a.scheduled_status !== "canceled")
      : [];
    
    return { timeOffItems, alertItems };
  };

  // Check if day has emergency
  const dayHasEmergency = (day: Date): boolean => {
    if (!showAlerts) return false;
    return alerts.some(a => 
      isAlertOnDate(a, day) && 
      a.alert_type === "emergency" && 
      a.scheduled_status !== "canceled"
    );
  };

  // Get chips to display on day (max 2 + overflow)
  const getChipsForDay = (day: Date) => {
    const { timeOffItems, alertItems } = getItemsForDay(day);
    const chips: { id: string; label: string; type: "time_off" | "alert"; isEmergency: boolean }[] = [];
    
    // Add time off chips
    timeOffItems.forEach(item => {
      chips.push({
        id: `timeoff-${item.id}`,
        label: "Time Off",
        type: "time_off",
        isEmergency: false,
      });
    });
    
    // Add alert chips
    alertItems.forEach(alert => {
      const info = getAlertTypeInfo(alert.alert_type);
      let label = info.label;
      
      if (alert.alert_type === "planned_route") {
        label = formatRouteChipText(alert) || "Route";
      }
      
      chips.push({
        id: `alert-${alert.id}`,
        label,
        type: "alert",
        isEmergency: info.isEmergency,
      });
    });
    
    return chips;
  };

  // Selected date details
  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return { timeOffItems: [], alertItems: [] };
    return getItemsForDay(selectedDate);
  }, [selectedDate, availabilityEntries, alerts, showTimeOff, showAlerts]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Availability Calendar
        </CardTitle>
        <CardDescription>
          Time off and vendor alerts in one place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Switch
              id="show-time-off"
              checked={showTimeOff}
              onCheckedChange={setShowTimeOff}
            />
            <Label htmlFor="show-time-off" className="text-sm cursor-pointer">Show Time Off</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-alerts"
              checked={showAlerts}
              onCheckedChange={setShowAlerts}
            />
            <Label htmlFor="show-alerts" className="text-sm cursor-pointer">Show Alerts</Label>
          </div>
        </div>

        {/* Calendar */}
        <div className="rounded-lg border border-border bg-card">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold text-foreground ml-2">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const inCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const hasEmergency = dayHasEmergency(day);
              const chips = getChipsForDay(day);
              const displayChips = chips.slice(0, 2);
              const overflowCount = chips.length - 2;
              const { timeOffItems } = getItemsForDay(day);
              const hasTimeOff = timeOffItems.length > 0;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative min-h-[90px] p-1.5 border-b border-r border-border text-left transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
                    !inCurrentMonth && "bg-muted/30",
                    isSelected && "ring-2 ring-primary ring-inset",
                    hasTimeOff && showTimeOff && "bg-emerald-500/10",
                    index % 7 === 6 && "border-r-0"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-6 h-6 text-xs rounded-full",
                      dateFnsIsToday(day) && !hasEmergency && "bg-primary text-primary-foreground font-semibold",
                      dateFnsIsToday(day) && hasEmergency && "bg-destructive text-destructive-foreground font-semibold",
                      !dateFnsIsToday(day) && hasEmergency && "text-destructive font-semibold",
                      !dateFnsIsToday(day) && !hasEmergency && inCurrentMonth && "text-foreground",
                      !dateFnsIsToday(day) && !hasEmergency && !inCurrentMonth && "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Chips */}
                  <div className="mt-1 space-y-0.5">
                    {displayChips.map((chip) => (
                      <div
                        key={chip.id}
                        className={cn(
                          "text-[10px] leading-tight px-1 py-0.5 rounded truncate",
                          chip.isEmergency 
                            ? "bg-destructive/20 text-destructive border border-destructive/30" 
                            : chip.type === "time_off"
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                        )}
                      >
                        {chip.label}
                      </div>
                    ))}
                    {overflowCount > 0 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{overflowCount} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 p-3 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
              <span>Time Off</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/30" />
              <span>Planned Route</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/30" />
              <span>Time Off Alert</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/30" />
              <span>Availability Update</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />
              <span className="text-destructive">Emergency</span>
            </div>
          </div>
        </div>

        {/* Selected Date Details */}
        {selectedDate && (
          <Card className="bg-muted/30">
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-sm font-medium">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 space-y-4">
              {selectedDateItems.timeOffItems.length === 0 && selectedDateItems.alertItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No items for this date.</p>
              )}

              {/* Time Off Items */}
              {selectedDateItems.timeOffItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Time Off</h4>
                  <div className="space-y-2">
                    {selectedDateItems.timeOffItems.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-3 p-2 rounded-md bg-background border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {format(parseISO(entry.start_date), "MM/dd/yyyy")} – {format(parseISO(entry.end_date), "MM/dd/yyyy")}
                          </p>
                          {entry.reason && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.reason}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onEditTimeOff(entry)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDeleteTimeOff(entry.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alert Items */}
              {selectedDateItems.alertItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Alerts</h4>
                  <div className="space-y-2">
                    {selectedDateItems.alertItems.map((alert) => {
                      const info = getAlertTypeInfo(alert.alert_type);
                      const isSent = !!alert.sent_at;
                      const isPending = alert.is_scheduled && alert.scheduled_status === "pending_confirmation";

                      return (
                        <div key={alert.id} className="p-2 rounded-md bg-background border border-border">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-sm font-medium",
                                  info.isEmergency && "text-destructive"
                                )}>
                                  {info.isEmergency && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                                  {info.label}
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {isSent ? "Sent" : isPending ? "Scheduled" : "Draft"}
                                </Badge>
                              </div>
                              
                              {alert.alert_type === "planned_route" && (
                                <p className="text-xs text-muted-foreground">
                                  {alert.route_state}
                                  {alert.route_counties && alert.route_counties.length > 0 && (
                                    <span> — {alert.route_counties.join(", ")}</span>
                                  )}
                                </p>
                              )}
                              
                              {/* Collapsible message */}
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs mt-1">
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Message
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <ScrollArea className="max-h-32 mt-2">
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap p-2 bg-muted/50 rounded">
                                      {alert.message}
                                    </p>
                                  </ScrollArea>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                              <Button variant="ghost" size="sm" onClick={() => onEditAlert(alert)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              {isPending && onSendNowAlert && (
                                <Button variant="ghost" size="sm" onClick={() => onSendNowAlert(alert)}>
                                  <Send className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
