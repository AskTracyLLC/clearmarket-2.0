import { addDays, addMonths, isAfter, isBefore, startOfDay, format, parseISO, isSameDay } from "date-fns";

export type RecurrenceType = "weekly" | "biweekly" | "monthly_date";

export interface RecurringEvent {
  id: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  is_recurring: boolean;
  recurrence_type: RecurrenceType | null;
  recurrence_until: string | null;
}

export interface ExpandedEvent extends RecurringEvent {
  isGeneratedInstance?: boolean;
  parentEventId?: string;
}

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly_date", label: "Every month (same date)" },
] as const;

/**
 * Get human-readable recurrence description
 */
export function getRecurrenceDescription(
  recurrenceType: RecurrenceType | null,
  baseDate: Date
): string {
  if (!recurrenceType) return "One-time";
  
  const dayName = format(baseDate, "EEEE");
  const dayOfMonth = format(baseDate, "do");
  
  switch (recurrenceType) {
    case "weekly":
      return `Every ${dayName}`;
    case "biweekly":
      return `Every other ${dayName}`;
    case "monthly_date":
      return `Monthly on the ${dayOfMonth}`;
    default:
      return "One-time";
  }
}

/**
 * Generate upcoming pay dates for a schedule (for preview display)
 * @param event The base recurring event
 * @param count Number of dates to return
 */
export function getUpcomingPayDatesForSchedule(
  event: RecurringEvent,
  count: number = 3
): Date[] {
  const today = startOfDay(new Date());
  const baseDate = startOfDay(parseISO(event.event_date));
  
  // If not recurring, just return the base date if it's in the future
  if (!event.is_recurring || !event.recurrence_type) {
    return !isBefore(baseDate, today) ? [baseDate] : [];
  }

  const endDate = event.recurrence_until 
    ? startOfDay(parseISO(event.recurrence_until))
    : addMonths(today, 12);
  
  const dates: Date[] = [];
  let currentDate = baseDate;
  const maxIterations = 365;
  let iterations = 0;

  while (dates.length < count && iterations < maxIterations) {
    iterations++;

    // Only include dates from today forward
    if (!isBefore(currentDate, today)) {
      // Stop if we've passed the end date
      if (isAfter(currentDate, endDate)) {
        break;
      }
      dates.push(currentDate);
    }

    // Calculate next occurrence
    switch (event.recurrence_type) {
      case "weekly":
        currentDate = addDays(currentDate, 7);
        break;
      case "biweekly":
        currentDate = addDays(currentDate, 14);
        break;
      case "monthly_date":
        currentDate = addMonths(currentDate, 1);
        break;
      default:
        return dates;
    }
  }

  return dates;
}

/**
 * Generate recurring occurrences for a Pay Day event within a date range.
 * Used for rep-side calendar view.
 */
export function generateRecurringOccurrences(
  event: RecurringEvent,
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent[] {
  if (!event.is_recurring || !event.recurrence_type) {
    return [];
  }

  const occurrences: ExpandedEvent[] = [];
  const baseDate = startOfDay(parseISO(event.event_date));
  const endDate = event.recurrence_until 
    ? startOfDay(parseISO(event.recurrence_until))
    : rangeEnd;
  
  const effectiveEnd = isBefore(endDate, rangeEnd) ? endDate : rangeEnd;

  let currentDate = baseDate;
  const maxIterations = 365;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    if (!isBefore(currentDate, rangeStart)) {
      if (isAfter(currentDate, effectiveEnd)) {
        break;
      }

      // Include all occurrences including the base date
      occurrences.push({
        ...event,
        id: `${event.id}-${format(currentDate, "yyyy-MM-dd")}`,
        event_date: format(currentDate, "yyyy-MM-dd"),
        isGeneratedInstance: !isSameDay(currentDate, baseDate),
        parentEventId: event.id,
      });
    }

    switch (event.recurrence_type) {
      case "weekly":
        currentDate = addDays(currentDate, 7);
        break;
      case "biweekly":
        currentDate = addDays(currentDate, 14);
        break;
      case "monthly_date":
        currentDate = addMonths(currentDate, 1);
        break;
      default:
        return occurrences;
    }

    if (isAfter(currentDate, addMonths(rangeEnd, 1))) {
      break;
    }
  }

  return occurrences;
}

/**
 * Expand all recurring events in a list (for rep-side display)
 * This creates individual items for each occurrence
 */
export function expandCalendarEvents(
  events: RecurringEvent[],
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent[] {
  const result: ExpandedEvent[] = [];

  for (const event of events) {
    if (event.is_recurring && event.event_type === "pay_day") {
      // For recurring pay days, generate all occurrences
      const occurrences = generateRecurringOccurrences(event, rangeStart, rangeEnd);
      result.push(...occurrences);
    } else {
      // For non-recurring events, include as-is
      result.push({ ...event, isGeneratedInstance: false });
    }
  }

  result.sort((a, b) => a.event_date.localeCompare(b.event_date));
  return result;
}
