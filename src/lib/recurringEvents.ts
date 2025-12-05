import { addDays, addMonths, isAfter, isBefore, startOfDay, format, parseISO } from "date-fns";

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

/**
 * Generate recurring occurrences for a Pay Day event within a date range.
 * @param event The base recurring event
 * @param rangeStart Start of the visible range
 * @param rangeEnd End of the visible range (defaults to 12 months ahead if not specified)
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
  
  // Cap the end date to rangeEnd
  const effectiveEnd = isBefore(endDate, rangeEnd) ? endDate : rangeEnd;

  let currentDate = baseDate;
  const maxIterations = 365; // Safety limit to prevent infinite loops
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Skip dates before the range start
    if (!isBefore(currentDate, rangeStart)) {
      // Stop if we've passed the effective end date
      if (isAfter(currentDate, effectiveEnd)) {
        break;
      }

      // Add this occurrence (skip the base date as it will be included as the original event)
      if (format(currentDate, "yyyy-MM-dd") !== event.event_date) {
        occurrences.push({
          ...event,
          id: `${event.id}-${format(currentDate, "yyyy-MM-dd")}`,
          event_date: format(currentDate, "yyyy-MM-dd"),
          isGeneratedInstance: true,
          parentEventId: event.id,
        });
      }
    }

    // Calculate next occurrence based on recurrence type
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

    // Safety check - if we're way past the end, stop
    if (isAfter(currentDate, addMonths(rangeEnd, 1))) {
      break;
    }
  }

  return occurrences;
}

/**
 * Expand all recurring events in a list, combining with one-time events
 * @param events List of calendar events from the database
 * @param rangeStart Start of the visible range
 * @param rangeEnd End of the visible range
 */
export function expandCalendarEvents(
  events: RecurringEvent[],
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent[] {
  const result: ExpandedEvent[] = [];

  for (const event of events) {
    // Always include the base event
    result.push({ ...event, isGeneratedInstance: false });

    // If recurring, generate additional occurrences
    if (event.is_recurring && event.event_type === "pay_day") {
      const occurrences = generateRecurringOccurrences(event, rangeStart, rangeEnd);
      result.push(...occurrences);
    }
  }

  // Sort by date
  result.sort((a, b) => a.event_date.localeCompare(b.event_date));

  return result;
}

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly_date", label: "Every month (same date)" },
] as const;
