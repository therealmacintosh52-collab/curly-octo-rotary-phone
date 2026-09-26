import { addDays, endOfMonth, endOfQuarter, endOfYear, format, startOfMonth, startOfQuarter, startOfWeek, startOfYear, subDays, subMonths, subQuarters, subYears } from "date-fns";

/** yyyy-MM-dd for <input type="date"> and SQL date params. */
export function toDateInput(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Local "yyyy-MM-ddTHH:mm" for <input type="datetime-local">. */
export function toDateTimeLocal(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function formatDate(iso: string | Date | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? "" : format(d, pattern);
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  return formatDate(iso, "MMM d, yyyy h:mm a");
}

/** Parse a plain yyyy-MM-dd as a local date (avoids the UTC-midnight shift of new Date("2024-01-01")). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDateOnly(s: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!s) return "";
  return format(parseDateOnly(s), pattern);
}

export type RangePreset =
  | "this_week"
  | "last_week"
  | "last_2_weeks"
  | "this_month"
  | "last_month"
  | "last_30"
  | "this_quarter"
  | "last_quarter"
  | "last_90"
  | "ytd"
  | "last_year"
  | "all"
  | "custom";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "last_2_weeks", label: "Last 2 weeks" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30", label: "Last 30 days" },
  { value: "this_quarter", label: "This quarter" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "last_90", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "last_year", label: "Last year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

/** Inclusive [start, end] for a preset, weeks starting Monday. */
export function presetRange(preset: RangePreset, today = new Date()): { start: string; end: string } {
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  switch (preset) {
    case "this_week":
      return { start: toDateInput(weekStart), end: toDateInput(today) };
    case "last_week": {
      const s = subDays(weekStart, 7);
      return { start: toDateInput(s), end: toDateInput(addDays(s, 6)) };
    }
    case "last_2_weeks": {
      const s = subDays(weekStart, 14);
      return { start: toDateInput(s), end: toDateInput(subDays(weekStart, 1)) };
    }
    case "this_month":
      return { start: toDateInput(startOfMonth(today)), end: toDateInput(today) };
    case "last_month": {
      const lm = subMonths(today, 1);
      return { start: toDateInput(startOfMonth(lm)), end: toDateInput(endOfMonth(lm)) };
    }
    case "last_30":
      return { start: toDateInput(subDays(today, 30)), end: toDateInput(today) };
    case "this_quarter":
      return { start: toDateInput(startOfQuarter(today)), end: toDateInput(today) };
    case "last_quarter": {
      const q = subQuarters(today, 1);
      return { start: toDateInput(startOfQuarter(q)), end: toDateInput(endOfQuarter(q)) };
    }
    case "last_90":
      return { start: toDateInput(subDays(today, 90)), end: toDateInput(today) };
    case "ytd":
      return { start: toDateInput(startOfYear(today)), end: toDateInput(today) };
    case "last_year": {
      const y = subYears(today, 1);
      return { start: toDateInput(startOfYear(y)), end: toDateInput(endOfYear(y)) };
    }
    case "all":
      return { start: "2000-01-01", end: toDateInput(today) };
    default:
      return { start: toDateInput(startOfMonth(today)), end: toDateInput(today) };
  }
}

/** ISO timestamp `days` ago. Kept out of components so the React compiler rules stay happy. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Current epoch ms (see isoDaysAgo). */
export function nowMs(): number {
  return Date.now();
}
