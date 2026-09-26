import { NextResponse } from "next/server";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { toCsv, type CsvValue } from "@/lib/csv";

/**
 * GET /api/export/{jobs|job-services|invoices|invoice-items|payments}.csv
 * Full-table exports for the company (admin only via RLS). Paginated reads
 * so large histories never hit the 1000-row PostgREST default.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/export/[file]">) {
  const { file } = await ctx.params;
  const kind = file.replace(/\.csv$/, "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || profile.role === "detailer") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const out: T[] = [];
    const page = 1000;
    for (let i = 0; ; i += page) {
      const { data, error } = await build(i, i + page - 1);
      if (error) throw new Error(error.message);
      out.push(...(data ?? []));
      if (!data || data.length < page) break;
    }
    return out;
  }

  let csv: string;
  try {
    switch (kind) {
      case "jobs": {
        type Row = {
          id: string; tag_number: string; vin: string | null; year: number | null; make: string | null; model: string | null; color: string | null;
          performed_at: string; ro_po_number: string | null; notes: string | null; status: string; deleted_at: string | null; delete_reason: string | null; created_at: string;
          dealership: { name: string } | null; detailer: { full_name: string } | null; invoice: { display_number: string } | null; job_services: { price: number }[];
        };
        const rows = await all<Row>((f, t) =>
          supabase
            .from("jobs")
            .select("id, tag_number, vin, year, make, model, color, performed_at, ro_po_number, notes, status, deleted_at, delete_reason, created_at, dealership:dealerships(name), detailer:profiles!jobs_detailer_id_fkey(full_name), invoice:invoices(display_number), job_services(price)")
            .order("performed_at")
            .range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
        );
        csv = toCsv(
          rows.map((r) => ({
            job_id: r.id, performed_at: r.performed_at, tag_number: r.tag_number, vin: r.vin, year: r.year, make: r.make, model: r.model, color: r.color,
            dealership: r.dealership?.name ?? null, detailer: r.detailer?.full_name ?? null, ro_po_number: r.ro_po_number, notes: r.notes,
            total: r.job_services.reduce((a, s) => a + Number(s.price), 0).toFixed(2), status: r.status, invoice_number: r.invoice?.display_number ?? null,
            deleted_at: r.deleted_at, delete_reason: r.delete_reason, created_at: r.created_at,
          })),
          cols(["job_id", "performed_at", "tag_number", "vin", "year", "make", "model", "color", "dealership", "detailer", "ro_po_number", "notes", "total", "status", "invoice_number", "deleted_at", "delete_reason", "created_at"]),
        );
        break;
      }
      case "job-services": {
        type Row = { id: string; job_id: string; price: number; override_reason: string | null; created_at: string; service: { name: string } | null; job: { tag_number: string; performed_at: string } | null };
        const rows = await all<Row>((f, t) =>
          supabase.from("job_services").select("id, job_id, price, override_reason, created_at, service:services(name), job:jobs(tag_number, performed_at)").order("created_at").range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
        );
        csv = toCsv(
          rows.map((r) => ({ line_id: r.id, job_id: r.job_id, performed_at: r.job?.performed_at ?? null, tag_number: r.job?.tag_number ?? null, service: r.service?.name ?? null, price: Number(r.price).toFixed(2), override_reason: r.override_reason })),
          cols(["line_id", "job_id", "performed_at", "tag_number", "service", "price", "override_reason"]),
        );
        break;
      }
      case "invoices": {
        type Row = { id: string; display_number: string; period_start: string; period_end: string; ro_po_number: string | null; subtotal: number; tax_rate: number; tax: number; total: number; amount_paid: number; status: string; payment_terms: string; submitted_at: string | null; paid_at: string | null; voided_at: string | null; void_reason: string | null; created_at: string; dealership: { name: string } | null };
        const rows = await all<Row>((f, t) => supabase.from("invoices").select("id, display_number, period_start, period_end, ro_po_number, subtotal, tax_rate, tax, total, amount_paid, status, payment_terms, submitted_at, paid_at, voided_at, void_reason, created_at, dealership:dealerships(name)").order("number").range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>);
        csv = toCsv(
          rows.map((r) => ({ invoice_id: r.id, invoice_number: r.display_number, dealership: r.dealership?.name ?? null, period_start: r.period_start, period_end: r.period_end, ro_po_number: r.ro_po_number, subtotal: Number(r.subtotal).toFixed(2), tax_rate: r.tax_rate, tax: Number(r.tax).toFixed(2), total: Number(r.total).toFixed(2), amount_paid: Number(r.amount_paid).toFixed(2), balance: (Number(r.total) - Number(r.amount_paid)).toFixed(2), status: r.status, payment_terms: r.payment_terms, created_at: r.created_at, submitted_at: r.submitted_at, paid_at: r.paid_at, voided_at: r.voided_at, void_reason: r.void_reason })),
          cols(["invoice_id", "invoice_number", "dealership", "period_start", "period_end", "ro_po_number", "subtotal", "tax_rate", "tax", "total", "amount_paid", "balance", "status", "payment_terms", "created_at", "submitted_at", "paid_at", "voided_at", "void_reason"]),
        );
        break;
      }
      case "invoice-items": {
        type Row = { id: string; invoice_id: string; job_id: string | null; sort_order: number; performed_at: string; tag_number: string; vin: string | null; year: number | null; make: string | null; model: string | null; color: string | null; ro_po_number: string | null; detailer_name: string | null; service_name: string; price: number; invoice: { display_number: string; status: string; dealership: { name: string } | null } | null };
        const rows = await all<Row>((f, t) => supabase.from("invoice_items").select("id, invoice_id, job_id, sort_order, performed_at, tag_number, vin, year, make, model, color, ro_po_number, detailer_name, service_name, price, invoice:invoices(display_number, status, dealership:dealerships(name))").order("invoice_id").order("sort_order").range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>);
        csv = toCsv(
          rows.map((r) => ({ invoice_number: r.invoice?.display_number ?? null, invoice_status: r.invoice?.status ?? null, dealership: r.invoice?.dealership?.name ?? null, line: r.sort_order, job_id: r.job_id, service_date: r.performed_at, tag_number: r.tag_number, vin: r.vin, year: r.year, make: r.make, model: r.model, color: r.color, ro_po_number: r.ro_po_number, service: r.service_name, detailer: r.detailer_name, amount: Number(r.price).toFixed(2) })),
          cols(["invoice_number", "invoice_status", "dealership", "line", "job_id", "service_date", "tag_number", "vin", "year", "make", "model", "color", "ro_po_number", "service", "detailer", "amount"]),
        );
        break;
      }
      case "payments": {
        type Row = { id: string; amount: number; paid_at: string; method: string; reference: string | null; note: string | null; created_at: string; invoice: { display_number: string; dealership: { name: string } | null } | null };
        const rows = await all<Row>((f, t) => supabase.from("invoice_payments").select("id, amount, paid_at, method, reference, note, created_at, invoice:invoices(display_number, dealership:dealerships(name))").order("paid_at").range(f, t) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>);
        csv = toCsv(
          rows.map((r) => ({ payment_id: r.id, invoice_number: r.invoice?.display_number ?? null, dealership: r.invoice?.dealership?.name ?? null, paid_at: r.paid_at, amount: Number(r.amount).toFixed(2), method: r.method, reference: r.reference, note: r.note, recorded_at: r.created_at })),
          cols(["payment_id", "invoice_number", "dealership", "paid_at", "amount", "method", "reference", "note", "recorded_at"]),
        );
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown export" }, { status: 404 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Export failed" }, { status: 500 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cali-tints-${kind}-${format(new Date(), "yyyy-MM-dd")}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Column spec from a key list: header = key. Keys are stable identifiers, so they double as machine-readable headers. */
function cols<const K extends string>(keys: readonly K[]): { key: K; header: string }[] {
  return keys.map((k) => ({ key: k, header: k }));
}

// Keep the CsvValue import used for typing map results.
export type { CsvValue };
