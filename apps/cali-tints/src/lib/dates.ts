import { addDays, endOfMonth, format, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";

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

export type RangePreset = "this_week" | "last_week" | "last_2_weeks" | "this_month" | "last_month" | "last_30" | "custom";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "last_2_weeks", label: "Last 2 weeks" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30", label: "Last 30 days" },
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
    default:
      return { start: toDateInput(startOfMonth(today)), end: toDateInput(today) };
  }
}
