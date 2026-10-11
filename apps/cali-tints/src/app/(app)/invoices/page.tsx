import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceListResult } from "@/lib/db/types";
import { EMPTY_INVOICE_LIST, invoiceFilterArgs, parseInvoiceFilters, resolveInvoiceFilters, STATUS_LABELS } from "@/lib/invoices/query";
import { formatMoney } from "@/lib/money";
import { formatDateOnly, todayIn } from "@/lib/dates";
import { Page, PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { BulkDownloadBanner } from "@/components/invoices/bulk-download-banner";
import { MonthSoFar, type MonthSoFarRow } from "@/components/invoices/month-so-far";
import { SendInvoicesButton, type UnsentGroup } from "@/components/invoices/send-invoices-button";

export const metadata: Metadata = { title: "Invoices" };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * One invoice per dealership per month, made on the 1st from that month's
 * jobs. This page lists them, shows the month in progress, and sends them.
 */
export default async function InvoicesPage(props: PageProps<"/invoices">) {
  const sp = await props.searchParams;
  const typed = parseInvoiceFilters(sp); // what the search box shows
  const session = await requireAdmin();
  const today = todayIn(session.company.timezone);
  const filters = resolveInvoiceFilters(typed, today); // "9/27" in the box → that day
  const supabase = await createClient();
  const created = typeof sp.created === "string" ? sp.created.split(",").filter(Boolean) : [];

  const [{ data: list, error }, { data: services }, { data: dealerships }, { data: unsent }, { data: openJobs }] = await Promise.all([
    supabase.rpc("invoices_filtered", invoiceFilterArgs(filters)),
    supabase.from("services").select("id, name").order("sort_order"),
    supabase.from("dealerships").select("id, name").eq("active", true).order("name"),
    // Unsent invoices by dealership, for "Send invoices".
    supabase.from("invoices").select("id, display_number, total, period_start, period_end, dealership_id, dealership:dealerships(name, ap_emails), invoice_items(tag_number, year, make, model)").eq("status", "draft").order("number").limit(200),
    // The month in progress: jobs not yet on an invoice, per dealership.
    supabase.from("jobs").select("dealership_id, job_services(price)").is("invoice_id", null).is("deleted_at", null),
  ]);
  if (error) throw new Error(error.message);
  const result = (list as InvoiceListResult | null) ?? EMPTY_INVOICE_LIST;

  const soFar: MonthSoFarRow[] = (dealerships ?? []).map((d) => {
    const mine = (openJobs ?? []).filter((j) => j.dealership_id === d.id);
    const total = mine.reduce((s, j) => s + (j.job_services as unknown as { price: number }[]).reduce((t, x) => t + Number(x.price), 0), 0);
    return { dealership_id: d.id, dealership: d.name, cars: mine.length, total };
  });

  const unsentGroups: UnsentGroup[] = Object.values(
    (unsent ?? []).reduce<Record<string, UnsentGroup>>((acc, i) => {
      const d = i.dealership as unknown as { name: string; ap_emails: string[] } | null;
      const items = (i.invoice_items as unknown as { tag_number: string; year: number | null; make: string | null; model: string | null }[] | null) ?? [];
      const cars = new Set(items.map((it) => it.tag_number)).size;
      const first = items[0];
      const g = acc[i.dealership_id] ?? { dealership_id: i.dealership_id, name: d?.name ?? "", emails: d?.ap_emails ?? [], invoices: [] };
      g.invoices.push({
        id: i.id,
        number: i.display_number,
        tag: cars === 1 && first ? first.tag_number : `${formatDateOnly(i.period_start, "MMM d")} – ${formatDateOnly(i.period_end, "MMM d")}`,
        vehicle: cars === 1 && first ? [first.year, first.make, first.model].filter(Boolean).join(" ") || null : `${cars} ${cars === 1 ? "car" : "cars"}`,
        total: Number(i.total),
      });
      acc[i.dealership_id] = g;
      return acc;
    }, {}),
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Header line: what this view adds up to, and which filters shaped it.
  const scope = [
    filters.status !== "all" ? STATUS_LABELS[filters.status] : null,
    filters.dealership ? dealerships?.find((d) => d.id === filters.dealership)?.name : null,
    filters.service ? services?.find((s) => s.id === filters.service)?.name : null,
    filters.searchDate ? filters.searchDate.label : filters.from || filters.to ? `${filters.from ? formatDateOnly(filters.from, "MMM d, yyyy") : "…"} – ${filters.to ? formatDateOnly(filters.to, "MMM d, yyyy") : "…"}` : null,
  ].filter(Boolean);
  const filtered = scope.length > 0 || !!filters.q || !!filters.detailer;
  const summary = [
    plural(result.count, "invoice", "invoices"),
    formatMoney(result.total),
    result.balance > 0 ? `${formatMoney(result.balance)} unpaid` : filters.status !== "void" && result.count > 0 ? "all paid" : null,
    ...scope,
  ].filter(Boolean);
  const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();

  return (
    <Page>
      <PageHeader title="Invoices" description={summary.join(" · ")} actions={<SendInvoicesButton groups={unsentGroups} />} />
      {created.length > 0 && <BulkDownloadBanner ids={created} />}
      {!filtered && <MonthSoFar rows={soFar} today={today} showMoney />}
      <div className="mt-5 flex flex-col gap-4">
        {/* useSearchParams streams this in after first paint; the fallback reserves the same height so nothing shifts. */}
        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full sm:w-96" />
            </div>
          }
        >
          <InvoiceFilters filters={typed} searchDate={filters.searchDate} services={services ?? []} dealerships={dealerships ?? []} isAdmin={session.isAdmin} />
        </Suspense>
        <InvoiceList rows={result.rows} page={filters.page} count={result.count} params={params} isAdmin={session.isAdmin} filtered={filtered} />
      </div>
    </Page>
  );
}
