import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceConflictRow } from "@/lib/db/types";
import { Page, PageHeader } from "@/components/app/page-header";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { presetRange } from "@/lib/dates";
import { sumPrices } from "@/lib/money";

export const metadata: Metadata = { title: "New invoice" };

export interface PreviewJob {
  id: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  performed_at: string;
  ro_po_number: string | null;
  detailer: string;
  services: { name: string; price: number }[];
  total: number;
  dup_review_note: string | null;
}

/**
 * Builder page. The preview is server-rendered from the URL
 * (?dealership&from&to) so it is shareable and always consistent with what
 * generate_invoice() will pick up. Every candidate job is checked for
 * double-billing (same VIN/tag already invoiced or repeated in this batch).
 */
export default async function NewInvoicePage(props: PageProps<"/invoices/new">) {
  const sp = await props.searchParams;
  const session = await requireAdmin();
  const supabase = await createClient();

  const { data: dealerships } = await supabase.from("dealerships").select("*").eq("active", true).order("name");
  const list = dealerships ?? [];
  const dealershipId = typeof sp.dealership === "string" && list.some((d) => d.id === sp.dealership) ? sp.dealership : (list[0]?.id ?? null);
  const dealership = list.find((d) => d.id === dealershipId) ?? null;

  const defaults = presetRange("last_month");
  const from = typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : defaults.start;
  const to = typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : defaults.end;

  let preview: PreviewJob[] = [];
  let conflicts: InvoiceConflictRow[] = [];
  if (dealership) {
    const sel =
      "id, tag_number, vin, year, make, model, performed_at, ro_po_number, dup_review_note, detailer:profiles!jobs_detailer_id_fkey(full_name), job_services(price, service:services(name))";
    const base = supabase.from("jobs").select(sel).eq("dealership_id", dealership.id).is("deleted_at", null).is("invoice_id", null).order("performed_at");
    // Batch mode previews the range; per-job mode shows everything pending.
    const { data } =
      dealership.invoice_mode === "per_job" ? await base : await base.gte("performed_at", `${from}T00:00:00`).lte("performed_at", `${to}T23:59:59.999`);
    preview = (data ?? []).map((j) => {
      const services = (j.job_services as unknown as { price: number; service: { name: string } | null }[]).map((s) => ({ name: s.service?.name ?? "", price: Number(s.price) }));
      return {
        id: j.id,
        tag_number: j.tag_number,
        vin: j.vin,
        year: j.year,
        make: j.make,
        model: j.model,
        performed_at: j.performed_at,
        ro_po_number: j.ro_po_number,
        detailer: (j.detailer as unknown as { full_name: string } | null)?.full_name ?? "",
        services,
        total: sumPrices(services),
        dup_review_note: (j as { dup_review_note?: string | null }).dup_review_note ?? null,
      };
    });
    if (preview.length > 0) {
      const { data: c } = await supabase.rpc("find_invoice_conflicts", { p_job_ids: preview.map((p) => p.id), p_days: 30 });
      conflicts = c ?? [];
    }
  }

  return (
    <Page>
      <PageHeader title="New invoice" description="Preview uninvoiced jobs, resolve any double-billing flags, then generate. Jobs on an invoice are locked." />
      <div className="mt-5">
        <InvoiceBuilder
          dealerships={list}
          dealershipId={dealershipId}
          from={from}
          to={to}
          preview={preview}
          conflicts={conflicts}
          taxRate={dealership?.tax_rate ?? session.company.tax_rate}
        />
      </div>
    </Page>
  );
}
