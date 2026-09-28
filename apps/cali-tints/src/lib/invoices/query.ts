import type { InvoiceListResult } from "@/lib/db/types";
import { formatDateOnly, parseDateOnly, presetRange } from "@/lib/dates";

export const INVOICE_PAGE_SIZE = 50;

/** URL-facing status values. `outstanding` is kept for old links (sent, unpaid). */
export const INVOICE_STATUSES = ["all", "unpaid", "outstanding", "overdue", "draft", "submitted", "partial", "paid", "void"] as const;
export type InvoiceStatusFilter = (typeof INVOICE_STATUSES)[number];

export interface InvoiceFilters {
  q?: string;
  service?: string;
  detailer?: string;
  dealership?: string;
  from?: string;
  to?: string;
  status: InvoiceStatusFilter;
  page: number;
}

/** Parse raw searchParams into typed filters (shared by the real page and the demo preview). */
export function parseInvoiceFilters(sp: Record<string, string | string[] | undefined>): InvoiceFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const status = s("status");
  return {
    q: s("q")?.trim() || undefined,
    service: s("service") || undefined,
    detailer: s("detailer") || undefined,
    dealership: s("dealership") || undefined,
    from: date(s("from")),
    to: date(s("to")),
    status: (INVOICE_STATUSES as readonly string[]).includes(status ?? "") ? (status as InvoiceStatusFilter) : "all",
    page: Math.max(1, Number(s("page") ?? 1) || 1),
  };
}

/** Arguments for the invoices_filtered RPC. */
export function invoiceFilterArgs(f: InvoiceFilters) {
  return {
    p_q: f.q ?? null,
    p_service: f.service ?? null,
    p_dealership: f.dealership ?? null,
    p_detailer: f.detailer ?? null,
    p_from: f.from ?? null,
    p_to: f.to ?? null,
    p_status: f.status,
    p_limit: INVOICE_PAGE_SIZE,
    p_offset: (f.page - 1) * INVOICE_PAGE_SIZE,
  };
}

// --- Search by date -----------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthIndex = (name: string) => MONTHS.findIndex((m) => name.toLowerCase().startsWith(m));
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const validDay = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);

export interface SearchDate {
  from: string;
  to: string;
  /** What the chip says, e.g. "Sep 27, 2026" or "September 2026". */
  label: string;
}

/**
 * Read the search box as a date. "9/27", "sep 27", "2026-09-27" → that day;
 * "sep", "9/2026" → that month; "today", "yesterday", "this week", "last
 * month" → those ranges. A bare number is never a date: tags look like that.
 * A year-less day that would be in the future means last year.
 */
export function parseSearchDate(raw: string, today: string): SearchDate | null {
  const q = raw.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!q) return null;
  const [ty, tm] = today.split("-").map(Number);
  const now = parseDateOnly(today);
  const day = (y: number, m: number, d: number): SearchDate | null => (validDay(y, m, d) ? { from: ymd(y, m, d), to: ymd(y, m, d), label: formatDateOnly(ymd(y, m, d)) } : null);
  const month = (y: number, m: number): SearchDate | null => (m >= 1 && m <= 12 ? { from: ymd(y, m, 1), to: ymd(y, m, daysInMonth(y, m)), label: formatDateOnly(ymd(y, m, 1), "MMMM yyyy") } : null);
  /** Year-less dates: this year, unless that puts the day after today. */
  const yearFor = (m: number, d: number) => (ymd(ty, m, d) > today ? ty - 1 : ty);
  const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
  const range = (from: string, to: string, label: string): SearchDate => ({ from, to, label });

  // Words
  if (q === "today") return day(ty, tm, Number(today.slice(8)));
  if (q === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return day(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  const presets: Record<string, "this_week" | "last_week" | "this_month" | "last_month"> = { "this week": "this_week", "last week": "last_week", "this month": "this_month", "last month": "last_month" };
  if (presets[q]) {
    const r = presetRange(presets[q], now);
    return range(r.start, r.end, q[0].toUpperCase() + q.slice(1));
  }

  let m: RegExpMatchArray | null;
  // 2026-09-27
  if ((m = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return day(Number(m[1]), Number(m[2]), Number(m[3]));
  // 9/27, 9-27, 09/27/26, 9/27/2026
  if ((m = q.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/))) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    return day(m[3] ? fullYear(m[3]) : yearFor(mo, d), mo, d);
  }
  // 9/2026 → the month
  if ((m = q.match(/^(\d{1,2})[/-](\d{4})$/))) return month(Number(m[2]), Number(m[1]));
  // sep 27, september 27 2026, sep 27th
  if ((m = q.match(/^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{2}|\d{4}))?$/))) {
    const mo = monthIndex(m[1]) + 1;
    if (mo > 0) {
      const d = Number(m[2]);
      return day(m[3] ? fullYear(m[3]) : yearFor(mo, d), mo, d);
    }
  }
  // 27 sep, 27 sep 2026
  if ((m = q.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\.?(?: (\d{2}|\d{4}))?$/))) {
    const mo = monthIndex(m[2]) + 1;
    if (mo > 0) {
      const d = Number(m[1]);
      return day(m[3] ? fullYear(m[3]) : yearFor(mo, d), mo, d);
    }
  }
  // sep, september, sep 2026
  if ((m = q.match(/^([a-z]{3,9})\.?(?: (\d{4}))?$/))) {
    const mo = monthIndex(m[1]) + 1;
    if (mo > 0) return month(m[2] ? Number(m[2]) : ymd(ty, mo, 1) > today ? ty - 1 : ty, mo);
  }
  return null;
}

/**
 * Filters as the list should run them: a search that reads as a date becomes
 * a From/To range (narrowed by any explicit From/To) and no longer a text
 * match. `searchDate` tells the UI what happened so the chip can say so.
 */
export function resolveInvoiceFilters(f: InvoiceFilters, today: string): InvoiceFilters & { searchDate: SearchDate | null } {
  const sd = f.q ? parseSearchDate(f.q, today) : null;
  if (!sd) return { ...f, searchDate: null };
  const from = f.from && f.from > sd.from ? f.from : sd.from;
  const to = f.to && f.to < sd.to ? f.to : sd.to;
  return { ...f, q: undefined, from, to, searchDate: sd };
}

export const EMPTY_INVOICE_LIST: InvoiceListResult = { count: 0, total: 0, balance: 0, rows: [] };

/** Human label for a status filter, used in headers and chips. */
export const STATUS_LABELS: Record<InvoiceStatusFilter, string> = {
  all: "All",
  unpaid: "Unpaid",
  outstanding: "Sent, unpaid",
  overdue: "Overdue",
  draft: "Not sent",
  submitted: "Sent to dealer",
  partial: "Partially paid",
  paid: "Paid",
  void: "Void",
};
