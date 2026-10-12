import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { loadInvoiceBundle } from "@/lib/invoices/load";
import type { PriceListRow } from "@/lib/db/types";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice" };

type CarRow = {
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
  deleted_at: string | null;
  detailer: { full_name: string } | null;
  job_services: { id: string; service_id: string; label: string | null; service: { name: string } | null }[];
};

/**
 * One invoice: a dealership's month (older invoices may carry one car). The
 * owner sends it, records payments and fixes a car while it is still an
 * unsent draft. Owner only. Rendering lives in InvoiceDetail, shared with
 * the guest demo.
 */
export default async function InvoiceDetailPage(props: PageProps<"/invoices/[id]">) {
  const { id } = await props.params;
  const session = await requireOwner();
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) notFound();
  const { invoice, items, dealership, company, payments, submissions } = bundle;
  const supabase = await createClient();

  // The cars on this invoice (for Edit / Delete). Usually one.
  const { data: carRows } = await supabase
    .from("jobs")
    .select("id, dealership_id, detailer_id, tag_number, vin, year, make, model, color, performed_at, ro_po_number, notes, deleted_at, detailer:profiles!jobs_detailer_id_fkey(full_name), job_services(id, service_id, label, service:services(name))")
    .eq("invoice_id", id)
    .is("deleted_at", null);
  const cars = (carRows ?? []) as unknown as CarRow[];
  const car = cars.length === 1 ? cars[0] : null;
  // Line prices come from the owner's view (job_services.price is not readable directly).
  const { data: priceRows } = car ? await supabase.from("job_service_prices_v").select("job_service_id, price, override_reason").eq("job_id", car.id) : { data: [] as { job_service_id: string; price: number; override_reason: string | null }[] };
  const priceOf = new Map((priceRows ?? []).map((r) => [r.job_service_id, r]));
  // Deleted with "Delete invoice": void, and the car it carried is soft-deleted. Lives in the archive.
  const itemJobIds = items.map((it) => it.job_id).filter((x): x is string => !!x);
  const { data: deletedJobs } = invoice.status === "void" && itemJobIds.length ? await supabase.from("jobs").select("id").in("id", itemJobIds).not("deleted_at", "is", null) : { data: [] };
  const archived = invoice.status === "void" && (deletedJobs ?? []).length > 0;

  const [priceListRes, { data: detailers }, submissionsWithUrls] = await Promise.all([
    car ? supabase.rpc("dealership_price_list", { p_dealership_id: car.dealership_id }) : Promise.resolve({ data: [] as PriceListRow[] }),
    session.isAdmin && car ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    // Signed URLs for uploaded confirmations.
    Promise.all(
      submissions.map(async (s) => {
        if (!s.confirmation_path) return { ...s, confirmation_url: null };
        const { data } = await supabase.storage.from("submission-confirmations").createSignedUrl(s.confirmation_path, 3600);
        return { ...s, confirmation_url: data?.signedUrl ?? null };
      }),
    ),
  ]);

  // Car edits: only while nothing has left the building.
  const isDraft = invoice.status === "draft" && Number(invoice.amount_paid) === 0;
  const ownCar = !!car && (session.isAdmin || car.detailer_id === session.userId);
  const canEdit = !!car && isDraft && ownCar;
  const canDelete = !!car && isDraft && session.isAdmin;
  const lockedReason = car && ownCar && !isDraft ? (invoice.status === "void" ? null : Number(invoice.amount_paid) > 0 ? "A payment is recorded, so the car is locked" : "Sent to the dealership, so the car is locked") : null;

  return (
    <InvoiceDetail
      invoice={invoice}
      items={items}
      dealership={dealership}
      company={company}
      payments={payments}
      submissions={submissionsWithUrls}
      car={
        car
          ? {
              id: car.id,
              dealership_id: car.dealership_id,
              detailer_id: car.detailer_id,
              tag_number: car.tag_number,
              vin: car.vin,
              year: car.year,
              make: car.make,
              model: car.model,
              color: car.color,
              performed_at: car.performed_at,
              ro_po_number: car.ro_po_number,
              notes: car.notes,
              detailer_name: car.detailer?.full_name ?? null,
              services: car.job_services.map((s) => ({ service_id: s.service_id, name: s.service?.name ?? "", price: Number(priceOf.get(s.id)?.price ?? 0), override_reason: priceOf.get(s.id)?.override_reason ?? null, label: s.label })),
            }
          : null
      }
      priceList={(priceListRes.data ?? []) as PriceListRow[]}
      detailers={detailers ?? []}
      isAdmin={session.isAdmin}
      canEdit={canEdit}
      canDelete={canDelete}
      lockedReason={lockedReason}
      archived={archived}
      reminderDays={session.company.reminder_days}
    />
  );
}
