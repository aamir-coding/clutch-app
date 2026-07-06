import { format } from 'date-fns';

/**
 * Centralised date/time formatting for CLUTCH.
 *
 * WHY: Date.toLocaleDateString() and Date.toLocaleTimeString() are
 * locale-sensitive. Node.js (server, SSR) and the browser may resolve the
 * user's locale differently, producing different strings for the same Date
 * value. React detects the mismatch during hydration and emits warnings that
 * can degrade perceived performance.
 *
 * date-fns format() evaluates the same format string on both server and
 * client, so the rendered HTML is byte-identical and React hydrates cleanly.
 *
 * All components that display dates MUST use these helpers instead of
 * calling Date prototype methods directly.
 */

/** "Jan 5, 2025" */
export function formatDate(date: Date): string {
  return format(date, 'MMM d, yyyy');
}

/** "2:30 PM" */
export function formatTime(date: Date): string {
  return format(date, 'h:mm a');
}

/** "Jan 5, 2025 at 2:30 PM" */
export function formatDateTime(date: Date): string {
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

/** "Mon, Jan 5" — used in battle plan / timeline headers */
export function formatShortDate(date: Date): string {
  return format(date, 'EEE, MMM d');
}

/** "2:30 PM – 4:00 PM" — focus session time range */
export function formatTimeRange(start: Date, end: Date): string {
  return `${format(start, 'h:mm a')} \u2013 ${format(end, 'h:mm a')}`;
}

/** "1/5/2025" — compact for tight-space deadlines */
export function formatCompactDate(date: Date): string {
  return format(date, 'M/d/yyyy');
}