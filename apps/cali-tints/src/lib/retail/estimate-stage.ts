import type { EstimateStage } from "@/lib/db/types";

/**
 * Where one retail visit stands, in the order the shop works it. The same word
 * is used on the dashboard, the Estimates list, the customer page and the
 * estimate itself. Retail has estimates and invoices, never jobs.
 */
export const STAGE_ORDER: EstimateStage[] = ["draft", "sent", "in_progress", "ready", "unpaid", "paid", "closed"];

export const STAGE_META: Record<EstimateStage, { label: string; short: string; hint: string; variant: "muted" | "info" | "warning" | "success" | "destructive" | "outline" }> = {
  draft: { label: "Draft", short: "Draft", hint: "Being written; the customer has not seen it", variant: "muted" },
  sent: { label: "Waiting on the customer", short: "Waiting", hint: "The link went out; no answer yet", variant: "info" },
  in_progress: { label: "In progress", short: "In progress", hint: "Approved; the work is being done and checked", variant: "info" },
  ready: { label: "Ready to invoice", short: "Ready", hint: "The work is done and checked; make the invoice", variant: "warning" },
  unpaid: { label: "Unpaid", short: "Unpaid", hint: "The invoice is out; payment is due", variant: "warning" },
  paid: { label: "Paid · pickup", short: "Pickup", hint: "Paid; waiting for the signature and the pickup", variant: "success" },
  closed: { label: "Closed", short: "Closed", hint: "Paid, signed and picked up", variant: "success" },
  declined: { label: "Declined", short: "Declined", hint: "The customer said no", variant: "destructive" },
  expired: { label: "Expired", short: "Expired", hint: "Past its date without an answer", variant: "outline" },
};

/** The filter row of the Estimates list: "open" is everything that is not closed, declined or expired. */
export type StageFilter = "open" | "all" | EstimateStage;
export const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Waiting" },
  { value: "in_progress", label: "In progress" },
  { value: "ready", label: "Ready to invoice" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Pickup" },
  { value: "closed", label: "Closed" },
  { value: "declined", label: "Declined" },
  { value: "all", label: "All" },
];

export function isStageFilter(v: unknown): v is StageFilter {
  return typeof v === "string" && STAGE_FILTERS.some((f) => f.value === v);
}

/** "today", "1 day", "5 days": how long a visit has been open. */
export function ageLabel(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

/** "22m", "3h", "2d": how long a visit has been open, like the shop's timer. */
export function ageShort(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
}

/**
 * What the document is called now: an **Estimate** (EST-…) until the customer
 * approves it, a **Work Order** (the RO number) while it is being worked, an
 * **Invoice** (RI-…) once it is invoiced. The earlier numbers stay small beside it.
 */
export type DocKind = "Estimate" | "Work Order" | "Invoice";
export function documentNumber(r: { display_number: string; invoice_number?: string | null; ro_number?: string | null; stage?: EstimateStage | null }): { primary: string; secondary: string | null; kind: DocKind } {
  if (r.invoice_number) return { primary: r.invoice_number, secondary: [r.ro_number, r.display_number].filter(Boolean).join(" · ") || null, kind: "Invoice" };
  const early = !r.stage || r.stage === "draft" || r.stage === "sent" || r.stage === "declined" || r.stage === "expired";
  if (!early && r.ro_number) return { primary: r.ro_number, secondary: r.display_number, kind: "Work Order" };
  return { primary: r.display_number, secondary: null, kind: "Estimate" };
}

/** The stage of one estimate, from what its page knows (the database derives the same word for lists). */
export function viewStage(e: { status: string; job?: { invoiced_at?: string | null; paid_at?: string | null; picked_up_at?: string | null; qc_at?: string | null } | null }): EstimateStage {
  if (e.status === "draft") return "draft";
  if (e.status === "sent" || e.status === "viewed") return "sent";
  if (e.status === "declined" || e.status === "expired") return e.status;
  const j = e.job;
  if (!j) return "in_progress";
  if (j.picked_up_at) return "closed";
  if (j.paid_at) return "paid";
  if (j.invoiced_at) return "unpaid";
  if (j.qc_at) return "ready";
  return "in_progress";
}
