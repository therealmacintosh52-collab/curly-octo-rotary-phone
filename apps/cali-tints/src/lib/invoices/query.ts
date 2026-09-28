import type { InvoiceListResult } from "@/lib/db/types";

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

export const EMPTY_INVOICE_LIST: InvoiceListResult = { count: 0, total: 0, balance: 0, rows: [] };

/** Human label for a status filter, used in headers and chips. */
export const STATUS_LABELS: Record<InvoiceStatusFilter, string> = {
  all: "All",
  unpaid: "Unpaid",
  outstanding: "Sent, unpaid",
  overdue: "Overdue",
  draft: "Not sent",
  submitted: "Sent",
  partial: "Partially paid",
  paid: "Paid",
  void: "Void",
};
