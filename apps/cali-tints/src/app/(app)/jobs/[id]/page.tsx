import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PriceListRow } from "@/lib/db/types";
import { JobDetail, type JobDetailProps } from "@/components/jobs/job-detail";

export const metadata: Metadata = { title: "Job" };

type JobRow = {
  id: string;
  dealership_id: string;
  detailer_id: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  performed_at: string;
  ro_po_number: string | null;
  notes: string | null;
  invoice_id: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  quickbooks_doc_number: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: "clover" | "cash" | "check" | "other" | null;
  payment_ref: string | null;
  created_at: string;
  dealership: { name: string; retail: boolean } | null;
  invoice: { display_number: string; status: string } | null;
  job_services: { id: string; service_id: string; label: string | null; needs_price: boolean; service: { name: string } | null }[];
};

/**
 * One job: the car, the services, the photos, where it stands (open, on an
 * invoice, deleted). Editable until it is on an invoice; RLS limits detailers
 * to their own jobs.
 */
export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      // Prices are not readable here (column privileges); the owner gets them from job_service_prices_v below.
      "id, dealership_id, detailer_id, tag_number, vin, year, make, model, color, performed_at, ro_po_number, notes, invoice_id, deleted_at, delete_reason, quickbooks_doc_number, paid_at, paid_amount, payment_method, payment_ref, created_at, dealership:dealerships(name, retail), invoice:invoices(display_number, status), job_services(id, service_id, label, needs_price, service:services(name))",
    )
    .eq("id", id)
    .maybeSingle();
  const job = data as unknown as JobRow | null;
  if (!job) notFound();

  const [{ data: photoRows }, priceListRes, { data: detailers }, { data: priceRows }, { data: invoiceNumber }] = await Promise.all([
    supabase.from("job_photos").select("id, kind, storage_path, created_at").eq("job_id", id).order("created_at"),
    supabase.rpc("dealership_price_list", { p_dealership_id: job.dealership_id }),
    session.isAdmin ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name") : Promise.resolve({ data: [{ id: session.profile.id, full_name: session.profile.full_name }] }),
    // The owner's prices for this job's lines (empty for everyone else).
    session.canPrices ? supabase.from("job_service_prices_v").select("job_service_id, price, override_reason").eq("job_id", id) : Promise.resolve({ data: [] as { job_service_id: string; price: number; override_reason: string | null }[] }),
    // Invoices are the owner's; everyone else still learns which invoice the car is on.
    job.invoice_id && !job.invoice ? supabase.rpc("job_invoice_number", { p_job_id: id }) : Promise.resolve({ data: null as string | null }),
  ]);
  const priceOf = new Map((priceRows ?? []).map((r) => [r.job_service_id, r]));
  const photos = await Promise.all(
    (photoRows ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage.from("job-photos").createSignedUrl(p.storage_path, 3600);
      return { id: p.id, kind: p.kind, url: signed?.signedUrl ?? null, created_at: p.created_at };
    }),
  );

  const own = session.isAdmin || job.detailer_id === session.userId;
  const open = !job.invoice_id && !job.deleted_at;
  const detail: JobDetailProps = {
    job: {
      id: job.id,
      dealership_id: job.dealership_id,
      detailer_id: job.detailer_id,
      tag_number: job.tag_number,
      vin: job.vin,
      year: job.year,
      make: job.make,
      model: job.model,
      color: job.color,
      performed_at: job.performed_at,
      ro_po_number: job.ro_po_number,
      notes: job.notes,
      services: job.job_services.map((s) => ({ service_id: s.service_id, name: s.service?.name ?? "", price: Number(priceOf.get(s.id)?.price ?? 0), override_reason: priceOf.get(s.id)?.override_reason ?? null, label: s.label, needs_price: s.needs_price })),
      dealership_name: job.dealership?.name ?? "",
      invoice: job.invoice_id ? { id: job.invoice_id, display_number: job.invoice?.display_number ?? invoiceNumber ?? "", status: job.invoice?.status ?? "" } : null,
      quickbooks_doc_number: job.quickbooks_doc_number,
      retail: !!job.dealership?.retail,
      payment: { paid_at: job.paid_at, paid_amount: job.paid_amount === null ? null : Number(job.paid_amount), payment_method: job.payment_method, payment_ref: job.payment_ref },
      deleted_at: job.deleted_at,
      deleted_reason: job.delete_reason,
      created_at: job.created_at,
    },
    photos,
    priceList: (priceListRes.data ?? []) as PriceListRow[],
    detailers: detailers ?? [],
    isAdmin: session.isAdmin,
    canSeeMoney: session.canPrices,
    canEdit: own && open && !job.paid_at,
    canDelete: session.isAdmin && open,
    canRestore: session.isAdmin && !!job.deleted_at,
  };
  return <JobDetail {...detail} />;
}
