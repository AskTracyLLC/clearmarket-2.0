import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";

export interface CalendarEventPreview {
  id: string;
  date: string; // ISO date (yyyy-MM-dd)
  type: "time_off" | "office_closed" | "alert" | "pay_day";
  label: string;
}

interface CalendarMonthViewProps {
  currentMonth: Date;
  onMonthChange: (newMonth: Date) => void;
  events: CalendarEventPreview[];
  onDayClick: (date: Date) => void;
  selectedDate?: Date | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonthView({
  currentMonth,
  onMonthChange,
  events,
  onDayClick,
  selectedDate,
}: CalendarMonthViewProps) {
  // Generate calendar days for the month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group events by date for quick lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventPreview[]>();
    events.forEach((event) => {
      const dateKey = event.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  const handlePrevMonth = () => {
    onMonthChange(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    onMonthChange(new Date());
  };

  const getEventDots = (dayEvents: CalendarEventPreview[]) => {
    const types = new Set(dayEvents.map((e) => e.type));
    const dots: { color: string; key: string }[] = [];

    if (types.has("time_off")) {
      dots.push({ color: "bg-emerald-500", key: "time_off" });
    }
    if (types.has("office_closed")) {
      dots.push({ color: "bg-amber-500", key: "office_closed" });
    }
    if (types.has("alert")) {
      dots.push({ color: "bg-cyan-500", key: "alert" });
    }
    if (types.has("pay_day")) {
      dots.push({ color: "bg-primary", key: "pay_day" });
    }

    return dots;
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground ml-2">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={handleToday}>
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
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateKey) || [];
          const inCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dots = getEventDots(dayEvents);

          return (
            <button
              key={index}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative min-h-[80px] p-2 border-b border-r border-border text-left transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
                !inCurrentMonth && "bg-muted/30",
                isSelected && "ring-2 ring-primary ring-inset",
                index % 7 === 6 && "border-r-0" // Last column
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center w-7 h-7 text-sm rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground font-semibold",
                  !isToday(day) && inCurrentMonth && "text-foreground",
                  !isToday(day) && !inCurrentMonth && "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </span>

              {/* Event dots */}
              {dots.length > 0 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {dots.map((dot) => (
                    <span
                      key={dot.key}
                      className={cn("w-1.5 h-1.5 rounded-full", dot.color)}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Time Off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Office Closed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          <span>Alert</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>Pay Day</span>
        </div>
      </div>
    </div>
  );
}
