import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus, JobStatus } from "@/lib/db/types";

export const PAGE_SIZE = 50;

export interface JobFilters {
  q?: string;
  service?: string;
  detailer?: string;
  dealership?: string;
  from?: string;
  to?: string;
  status?: "all" | "uninvoiced" | "invoiced" | "deleted";
  page?: number;
}

/** One row of the job list: job + joined names + per-service lines. */
export interface JobListRow {
  id: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  performed_at: string;
  ro_po_number: string | null;
  status: JobStatus;
  invoice_id: string | null;
  deleted_at: string | null;
  dealership: { name: string } | null;
  detailer: { full_name: string } | null;
  invoice: { display_number: string; status: InvoiceStatus } | null;
  job_services: { price: number; service: { name: string } | null }[];
}

/** Parse raw searchParams into typed filters. */
export function parseJobFilters(sp: Record<string, string | string[] | undefined>): JobFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status = s("status");
  return {
    q: s("q")?.trim() || undefined,
    service: s("service") || undefined,
    detailer: s("detailer") || undefined,
    dealership: s("dealership") || undefined,
    from: s("from") || undefined,
    to: s("to") || undefined,
    status: status === "uninvoiced" || status === "invoiced" || status === "deleted" ? status : "all",
    page: Math.max(1, Number(s("page") ?? 1) || 1),
  };
}

/** Escape PostgREST `or`/`ilike` metacharacters in user input. */
function likeTerm(q: string) {
  return `%${q.replace(/[%_,().]/g, (m) => `\\${m}`)}%`;
}

export async function queryJobs(filters: JobFilters): Promise<{ rows: JobListRow[]; total: number; page: number; pages: number }> {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const fromIdx = (page - 1) * PAGE_SIZE;

  // job_services!inner only when filtering by service, otherwise a job with no
  // services would disappear from the list.
  const servicesSel = filters.service ? "job_services!inner(price, service_id, service:services(name))" : "job_services(price, service_id, service:services(name))";

  let query = supabase
    .from("jobs")
    .select(
      `id, tag_number, vin, year, make, model, color, performed_at, ro_po_number, status, invoice_id, deleted_at,
       dealership:dealerships(name), detailer:profiles!jobs_detailer_id_fkey(full_name),
       invoice:invoices(display_number, status), ${servicesSel}`,
      { count: "exact" },
    )
    .order("performed_at", { ascending: false })
    .range(fromIdx, fromIdx + PAGE_SIZE - 1);

  if (filters.status === "deleted") query = query.not("deleted_at", "is", null);
  else query = query.is("deleted_at", null);
  if (filters.status === "uninvoiced") query = query.is("invoice_id", null);
  if (filters.status === "invoiced") query = query.not("invoice_id", "is", null);
  if (filters.q) {
    const t = likeTerm(filters.q);
    query = query.or(`tag_number.ilike.${t},vin.ilike.${t},model.ilike.${t},ro_po_number.ilike.${t}`);
  }
  if (filters.service) query = query.eq("job_services.service_id", filters.service);
  if (filters.detailer) query = query.eq("detailer_id", filters.detailer);
  if (filters.dealership) query = query.eq("dealership_id", filters.dealership);
  if (filters.from) query = query.gte("performed_at", `${filters.from}T00:00:00`);
  if (filters.to) query = query.lte("performed_at", `${filters.to}T23:59:59.999`);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as JobListRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
