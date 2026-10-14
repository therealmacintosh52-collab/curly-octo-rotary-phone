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

/** Estimate until it is invoiced, then the invoice number leads and the estimate number stays small beside it. */
export function documentNumber(r: { display_number: string; invoice_number?: string | null }): { primary: string; secondary: string | null } {
  return r.invoice_number ? { primary: r.invoice_number, secondary: r.display_number } : { primary: r.display_number, secondary: null };
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
