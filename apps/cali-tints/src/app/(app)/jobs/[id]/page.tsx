import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JobEstimate, JobFinding, PriceListRow, RoAuthorization } from "@/lib/db/types";
import { signedUrls } from "@/lib/media/signed";
import { withoutPrices } from "@/lib/jobs/price-list";
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
  ro_number: string | null;
  retail_invoice_number: string | null;
  invoiced_at: string | null;
  customer_concern: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: "clover" | "cash" | "check" | "other" | null;
  payment_ref: string | null;
  created_at: string;
  dealership: { name: string; retail: boolean } | null;
  customer: { id: string; display_name: string | null } | null;
  vehicle: { id: string; year: number | null; make: string | null; model: string | null } | null;
  invoice: { display_number: string; status: string } | null;
  job_services: { id: string; service_id: string; label: string | null; needs_price: boolean; authorization_id: string | null; service: { name: string } | null }[];
};

/**
 * One job: the car, the services, the photos, where it stands (open, on an
 * invoice, deleted). Editable until it is on an invoice; RLS limits detailers
 * to their own jobs.
 */
export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const session = await getSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      // No prices on a job: job_services.price stays unread (column privileges); the lines carry only name, label and the Needs-a-price flag.
      "id, dealership_id, detailer_id, tag_number, vin, year, make, model, color, performed_at, ro_po_number, notes, invoice_id, deleted_at, delete_reason, quickbooks_doc_number, ro_number, retail_invoice_number, invoiced_at, customer_concern, paid_at, paid_amount, payment_method, payment_ref, created_at, dealership:dealerships(name, retail), customer:customers(id, display_name), vehicle:vehicles(id, year, make, model), invoice:invoices(display_number, status), job_services(id, service_id, label, needs_price, authorization_id, service:services(name))",
    )
    .eq("id", id)
    .maybeSingle();
  const job = data as unknown as JobRow | null;
  if (!job) notFound();

  const open = !job.invoice_id && !job.deleted_at;
  const retail = !!job.dealership?.retail;
  const own = session.isAdmin || job.detailer_id === session.userId;
  const [{ data: photoRows }, priceListRes, { data: detailers }, { data: charge }, { data: invoiceNumber }, { data: findingRows }, { data: lastTimeRows }, { data: catalog }, { data: estimateRows }, { data: authRows }, { data: odoRows }] = await Promise.all([
    supabase.from("job_photos").select("id, kind, storage_path, created_at, finding_id").eq("job_id", id).order("created_at"),
    supabase.rpc("dealership_price_list", { p_dealership_id: job.dealership_id }),
    session.isAdmin ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name") : Promise.resolve({ data: [{ id: session.profile.id, full_name: session.profile.full_name }] }),
    // A retail job: the balance the counter collects, the deposit, the ledger and the receipt state.
    retail && !job.deleted_at ? supabase.rpc("retail_charge", { p_job_id: id }) : Promise.resolve({ data: null }),
    // Invoices are the owner's; everyone else still learns which invoice the car is on.
    job.invoice_id && !job.invoice ? supabase.rpc("job_invoice_number", { p_job_id: id }) : Promise.resolve({ data: null as string | null }),
    // The notes tab of a retail job: this visit's notes and findings, what was found last time, the menu to suggest from.
    retail ? supabase.rpc("job_findings", { p_job: id }) : Promise.resolve({ data: [] as JobFinding[] }),
    retail && job.vehicle ? supabase.rpc("vehicle_open_findings", { p_vehicle: job.vehicle.id, p_exclude_job: id }) : Promise.resolve({ data: [] as JobFinding[] }),
    retail ? supabase.rpc("retail_catalog") : Promise.resolve({ data: null }),
    retail ? supabase.rpc("job_estimates", { p_job: id }) : Promise.resolve({ data: [] as JobEstimate[] }),
    retail ? supabase.rpc("ro_authorizations", { p_job: id }) : Promise.resolve({ data: [] as RoAuthorization[] }),
    retail ? supabase.from("odometer_readings").select("reading").eq("job_id", id).order("read_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] as { reading: number }[] }),
  ]);
  const findings = (findingRows ?? []) as JobFinding[];
  const fromLastTime = (lastTimeRows ?? []) as JobFinding[];
  // Plain job photos are the before/after gallery; media on a finding shows on the notes tab.
  const gallery = (photoRows ?? []).filter((p) => !p.finding_id);
  const urls = await signedUrls(supabase, "job-photos", [...gallery.map((p) => p.storage_path), ...findings.flatMap((f) => f.media.map((m) => m.storage_path)), ...fromLastTime.flatMap((f) => f.media.map((m) => m.storage_path))]);
  const photos = gallery.map((p) => ({ id: p.id, kind: p.kind as "photo" | "before" | "after", url: urls.get(p.storage_path) ?? null, created_at: p.created_at }));
  const withUrls = (f: JobFinding): JobFinding => ({ ...f, media: f.media.map((m) => ({ ...m, url: urls.get(m.storage_path) ?? null })) });

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
      services: job.job_services.map((s) => ({ service_id: s.service_id, name: s.service?.name ?? "", price: 0, override_reason: null, label: s.label, needs_price: s.needs_price, authorized: s.authorization_id !== null })),
      dealership_name: job.dealership?.name ?? "",
      customer: job.customer ? { id: job.customer.id, name: job.customer.display_name ?? "Customer" } : null,
      vehicle: job.vehicle ? { id: job.vehicle.id, name: [job.vehicle.year, job.vehicle.make, job.vehicle.model].filter(Boolean).join(" ") || "Vehicle" } : null,
      invoice: job.invoice_id ? { id: job.invoice_id, display_number: job.invoice?.display_number ?? invoiceNumber ?? "", status: job.invoice?.status ?? "" } : null,
      quickbooks_doc_number: job.quickbooks_doc_number,
      retail,
      ro_number: job.ro_number,
      retail_invoice_number: job.retail_invoice_number,
      invoiced_at: job.invoiced_at,
      customer_concern: job.customer_concern,
      mileage_in: odoRows?.[0]?.reading ?? null,
      payment: { paid_at: job.paid_at, paid_amount: job.paid_amount === null ? null : Number(job.paid_amount), payment_method: job.payment_method, payment_ref: job.payment_ref },
      deleted_at: job.deleted_at,
      deleted_reason: job.delete_reason,
      created_at: job.created_at,
    },
    photos,
    priceList: withoutPrices((priceListRes.data ?? []) as PriceListRow[]),
    detailers: detailers ?? [],
    isAdmin: session.isAdmin,
    canSetAmount: session.canPrices,
    charge: charge ?? null,
    canEdit: own && open && !job.paid_at,
    canDelete: session.isAdmin && open,
    canRestore: session.isAdmin && !!job.deleted_at,
    findings: findings.map(withUrls),
    fromLastTime: fromLastTime.map(withUrls),
    retailServices: (catalog?.services ?? []).filter((s) => s.retail).map((s) => ({ id: s.id, name: s.name })),
    canNote: own && !job.deleted_at,
    userId: session.userId,
    initialTab: sp.tab === "notes" ? "notes" : "job",
    estimates: (estimateRows ?? []) as JobEstimate[],
    authorizations: (authRows ?? []) as RoAuthorization[],
    unauthorized: job.invoiced_at ? 0 : job.job_services.filter((s) => s.authorization_id === null).length,
    canConvert: session.canPrices && retail && !job.deleted_at,
  };
  return <JobDetail {...detail} />;
}
