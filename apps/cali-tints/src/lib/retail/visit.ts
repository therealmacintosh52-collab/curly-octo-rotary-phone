import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstimateJobPriority, InvoiceReview, ReceiptView, RetailCharge, RoAuthorization } from "@/lib/db/types";
import type { Session } from "@/lib/auth";
import type { RoWork } from "@/components/jobs/ro-work-card";
import type { RetailPaymentInfo } from "@/components/jobs/retail-payment";
import { appUrl } from "@/lib/retail/email";

/**
 * Everything the estimate screen needs once the customer has approved: the work
 * done (cause, correction, mileage out, the check), the authorizations, the
 * review against the approved amounts, the payments, the invoice itself. The
 * database keeps it on a hidden repair-order row; retail screens only ever see
 * this, through the estimate.
 */
export type VisitPanel = {
  jobId: string;
  deleted: boolean;
  invoiced: boolean;
  lineCount: number;
  work: RoWork;
  payment: RetailPaymentInfo;
  charge: RetailCharge | null;
  authorizations: RoAuthorization[];
  unauthorized: number;
  review: InvoiceReview | null;
  canComplete: boolean;
  canQc: boolean;
  /** Owner, admin, advisor: convert, take payments, close. */
  canPrice: boolean;
  /** The customer's link to this visit (their estimate, then their invoice). */
  receiptUrl: string | null;
  /** The invoice as the shop prints it, once there is one (staff with money). */
  invoiceDoc: ReceiptView | null;
};

type WorkRow = { id: string; title: string; priority: EstimateJobPriority; kind: "diagnosis" | "repair"; sort_order: number; cause: string | null; correction: string | null };
type JobRow = {
  id: string;
  detailer_id: string;
  odometer_out: number | null;
  completed_at: string | null;
  qc_at: string | null;
  qc_note: string | null;
  parts_disposition: "offered" | "returned" | "declined" | null;
  invoiced_at: string | null;
  deleted_at: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: "clover" | "cash" | "check" | "other" | null;
  payment_ref: string | null;
  job_services: { estimate_job_id: string | null; authorization_id: string | null }[];
};
const RANK: Record<EstimateJobPriority, number> = { safety: 0, soon: 1, optional: 2 };

export async function loadVisit(supabase: SupabaseClient<Database>, session: Session, jobId: string): Promise<VisitPanel | null> {
  const { data } = await supabase
    .from("jobs")
    .select("id, detailer_id, odometer_out, completed_at, qc_at, qc_note, parts_disposition, invoiced_at, deleted_at, paid_at, paid_amount, payment_method, payment_ref, job_services(estimate_job_id, authorization_id)")
    .eq("id", jobId)
    .maybeSingle();
  const job = data as unknown as JobRow | null;
  if (!job) return null;
  const own = session.isAdmin || job.detailer_id === session.userId;
  const invoiced = !!job.invoiced_at;
  const ids = [...new Set(job.job_services.map((s) => s.estimate_job_id).filter((x): x is string => !!x))];
  const [{ data: workRows }, { data: charge }, { data: auths }, { data: review }, { data: odo }, { data: link }, { data: doc }] = await Promise.all([
    ids.length ? supabase.from("estimate_jobs").select("id, title, priority, kind, sort_order, cause, correction").in("id", ids) : Promise.resolve({ data: [] as WorkRow[] }),
    job.deleted_at ? Promise.resolve({ data: null }) : supabase.rpc("retail_charge", { p_job_id: jobId }),
    supabase.rpc("ro_authorizations", { p_job: jobId }),
    session.canPrices && !invoiced && !job.deleted_at ? supabase.rpc("ro_invoice_review", { p_job: jobId }) : Promise.resolve({ data: null as InvoiceReview | null }),
    supabase.from("odometer_readings").select("reading").eq("job_id", jobId).order("read_at", { ascending: true }).limit(1),
    session.canPrices && !job.deleted_at ? supabase.rpc("receipt_link", { p_job_id: jobId }) : Promise.resolve({ data: null as string | null }),
    session.canPrices && invoiced ? supabase.rpc("job_receipt", { p_job_id: jobId }) : Promise.resolve({ data: null as ReceiptView | null }),
  ]);
  const jobs = ((workRows ?? []) as WorkRow[])
    .sort((a, b) => (a.kind === b.kind ? RANK[a.priority] - RANK[b.priority] || a.sort_order - b.sort_order : a.kind === "diagnosis" ? -1 : 1))
    .map((w) => ({ id: w.id, title: w.title, priority: w.priority, cause: w.cause, correction: w.correction }));
  const mileageIn = odo?.[0]?.reading ?? null;
  return {
    jobId,
    deleted: !!job.deleted_at,
    invoiced,
    lineCount: job.job_services.length,
    work: { jobs, mileageIn, odometerOut: job.odometer_out, completedAt: job.completed_at, qcAt: job.qc_at, qcNote: job.qc_note, parts: job.parts_disposition },
    payment: { paid_at: job.paid_at, paid_amount: job.paid_amount === null ? null : Number(job.paid_amount), payment_method: job.payment_method, payment_ref: job.payment_ref },
    charge: charge ?? null,
    authorizations: (auths ?? []) as RoAuthorization[],
    unauthorized: invoiced ? 0 : job.job_services.filter((s) => s.authorization_id === null).length,
    review: (review ?? null) as InvoiceReview | null,
    canComplete: own && !job.deleted_at && !invoiced,
    canQc: session.isAdmin && !job.deleted_at && !invoiced,
    canPrice: session.canPrices && !job.deleted_at,
    receiptUrl: link ? `${appUrl() ?? ""}/r/${link}` : null,
    invoiceDoc: (doc ?? null) as ReceiptView | null,
  };
}
