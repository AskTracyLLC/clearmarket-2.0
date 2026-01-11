import { format } from "date-fns";

/**
 * Formats a date string for display in Central Time (CT).
 * Uses browser's Intl API to properly convert to America/Chicago timezone.
 * 
 * @param dateStr - ISO date string or Date object
 * @returns Formatted date string in CT timezone
 */
export function formatCT(dateStr: string | Date): string {
  try {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    
    // Use Intl.DateTimeFormat to get the time in America/Chicago
    const ctFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
    
    return ctFormatter.format(date);
  } catch {
    // Fallback to basic format if timezone conversion fails
    try {
      const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
      return format(date, "MM/dd/yy - h:mm a") + " CT";
    } catch {
      return String(dateStr);
    }
  }
}

/**
 * Short format for activity timelines - same as formatCT
 */
export function formatCTShort(dateStr: string | Date): string {
  return formatCT(dateStr);
}
