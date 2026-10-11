import type { JobListResult } from "@/lib/db/types";
import { parseSearchDate, type SearchDate } from "@/lib/invoices/query";

export const JOB_PAGE_SIZE = 50;

export const JOB_STATUSES = ["all", "open", "invoiced", "deleted"] as const;
export type JobStatusFilter = (typeof JOB_STATUSES)[number];

export interface JobFilters {
  q?: string;
  service?: string;
  detailer?: string;
  dealership?: string;
  from?: string;
  to?: string;
  status: JobStatusFilter;
  page: number;
}

/** Parse raw searchParams into typed filters (shared by the real page and the demo preview). */
export function parseJobFilters(sp: Record<string, string | string[] | undefined>): JobFilters {
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
    status: (JOB_STATUSES as readonly string[]).includes(status ?? "") ? (status as JobStatusFilter) : "all",
    page: Math.max(1, Number(s("page") ?? 1) || 1),
  };
}

/** Arguments for the jobs_filtered RPC. */
export function jobFilterArgs(f: JobFilters) {
  return {
    p_q: f.q ?? null,
    p_service: f.service ?? null,
    p_dealership: f.dealership ?? null,
    p_detailer: f.detailer ?? null,
    p_from: f.from ?? null,
    p_to: f.to ?? null,
    p_status: f.status,
    p_limit: JOB_PAGE_SIZE,
    p_offset: (f.page - 1) * JOB_PAGE_SIZE,
  };
}

/** A search that reads as a date ("today", "9/27", "sep") becomes a From/To range instead of a text match. */
export function resolveJobFilters(f: JobFilters, today: string): JobFilters & { searchDate: SearchDate | null } {
  const sd = f.q ? parseSearchDate(f.q, today) : null;
  if (!sd) return { ...f, searchDate: null };
  const from = f.from && f.from > sd.from ? f.from : sd.from;
  const to = f.to && f.to < sd.to ? f.to : sd.to;
  return { ...f, q: undefined, from, to, searchDate: sd };
}

export const EMPTY_JOB_LIST: JobListResult = { count: 0, rows: [] };

export const JOB_STATUS_LABELS: Record<JobStatusFilter, string> = {
  all: "All",
  open: "Not invoiced yet",
  invoiced: "Invoiced",
  deleted: "Archive",
};
