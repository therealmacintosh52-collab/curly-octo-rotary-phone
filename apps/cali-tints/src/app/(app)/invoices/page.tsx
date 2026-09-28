import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon, WalletIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceListResult } from "@/lib/db/types";
import { EMPTY_INVOICE_LIST, invoiceFilterArgs, parseInvoiceFilters, resolveInvoiceFilters, STATUS_LABELS } from "@/lib/invoices/query";
import { formatMoney } from "@/lib/money";
import { formatDateOnly, todayIn } from "@/lib/dates";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { BulkDownloadBanner } from "@/components/invoices/bulk-download-banner";
import { CloverQueue, CloverSyncButton, type OpenInvoiceOption } from "@/components/invoices/clover-queue";
import { SendInvoicesButton, type UnsentGroup } from "@/components/invoices/send-invoices-button";
import { cloverContext } from "@/lib/clover/invoices";

export const metadata: Metadata = { title: "Invoices" };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * The one list. Every car logged is an invoice; this page finds it, shows
 * where the money stands and collects it. Detailers see their own cars.
 */
export default async function InvoicesPage(props: PageProps<"/invoices">) {
  const sp = await props.searchParams;
  const typed = parseInvoiceFilters(sp); // what the search box shows
  const session = await getSession();
  const today = todayIn(session.company.timezone);
  const filters = resolveInvoiceFilters(typed, today); // "9/27" in the box → that day
  const spansDays = !!filters.from && !!filters.to && filters.from !== filters.to; // the week, a month: show it day by day
  const supabase = await createClient();
  const created = typeof sp.created === "string" ? sp.created.split(",").filter(Boolean) : [];
  const clover = session.isAdmin ? cloverContext(session.company) : null;

  const [{ data: list, error }, { data: services }, { data: dealerships }, { data: owed }, { data: queue }, { data: openInvoices }, { data: unsent }] = await Promise.all([
    supabase.rpc("invoices_filtered", invoiceFilterArgs(filters)),
    supabase.from("services").select("id, name").order("sort_order"),
    supabase.from("dealerships").select("id, name").order("name"),
    // Everything owed across all open invoices (not just this filter), for "Collect all unpaid".
    session.isAdmin ? supabase.from("invoices").select("total, amount_paid").in("status", ["draft", "submitted", "partial"]) : Promise.resolve({ data: [] }),
    // Clover: payments waiting to be matched, and the open invoices they could belong to.
    clover ? supabase.from("clover_payments").select("id, clover_payment_id, amount, tip, paid_at, card_brand, last4, reference").eq("status", "unmatched").order("paid_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    clover ? supabase.from("invoices").select("id, display_number, total, amount_paid, dealership:dealerships(name)").in("status", ["draft", "submitted", "partial"]).order("number", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    // Unsent invoices by dealership, for "Send invoices".
    session.isAdmin ? supabase.from("invoices").select("id, total, dealership_id, dealership:dealerships(name, ap_emails)").eq("status", "draft").order("number").limit(200) : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(error.message);
  const result = (list as InvoiceListResult | null) ?? EMPTY_INVOICE_LIST;

  const unpaid = (owed ?? []).map((i) => Number(i.total) - Number(i.amount_paid)).filter((b) => b > 0);
  const unpaidTotal = unpaid.reduce((s, b) => s + b, 0);
  const unsentGroups: UnsentGroup[] = Object.values(
    (unsent ?? []).reduce<Record<string, UnsentGroup>>((acc, i) => {
      const d = i.dealership as unknown as { name: string; ap_emails: string[] } | null;
      const g = acc[i.dealership_id] ?? { dealership_id: i.dealership_id, name: d?.name ?? "", emails: d?.ap_emails ?? [], ids: [], total: 0 };
      g.ids.push(i.id);
      g.total += Number(i.total);
      acc[i.dealership_id] = g;
      return acc;
    }, {}),
  ).sort((a, b) => a.name.localeCompare(b.name));
  const openOptions: OpenInvoiceOption[] = (openInvoices ?? []).map((i) => ({
    id: i.id,
    display_number: i.display_number,
    dealership: (i.dealership as unknown as { name: string } | null)?.name ?? "",
    balance: Number(i.total) - Number(i.amount_paid),
  }));

  // Header line: what this view adds up to, and which filters shaped it.
  const scope = [
    filters.status !== "all" ? STATUS_LABELS[filters.status] : null,
    filters.dealership ? dealerships?.find((d) => d.id === filters.dealership)?.name : null,
    filters.service ? services?.find((s) => s.id === filters.service)?.name : null,
    filters.searchDate ? filters.searchDate.label : filters.from || filters.to ? `${filters.from ? formatDateOnly(filters.from, "MMM d, yyyy") : "…"} – ${filters.to ? formatDateOnly(filters.to, "MMM d, yyyy") : "…"}` : null,
  ].filter(Boolean);
  const filtered = scope.length > 0 || !!filters.q || !!filters.detailer;
  const summary = [
    plural(result.count, "car", "cars"),
    formatMoney(result.total),
    result.balance > 0 ? `${formatMoney(result.balance)} unpaid` : filters.status !== "void" && result.count > 0 ? "all paid" : null,
    ...scope,
  ].filter(Boolean);
  const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();

  return (
    <Page>
      <PageHeader
        title={session.isAdmin ? "Invoices" : "My cars"}
        description={summary.join(" · ")}
        actions={
          <>
            {clover && <CloverSyncButton lastSyncAt={session.company.clover_last_sync_at} />}
            {session.isAdmin && unpaid.length > 1 && (
              <Button asChild variant="soft">
                <Link href="/terminal?invoices=all">
                  <WalletIcon /> Collect all unpaid · {formatMoney(unpaidTotal)}
                </Link>
              </Button>
            )}
            {session.isAdmin && <SendInvoicesButton groups={unsentGroups} />}
            <Button asChild>
              <Link href="/jobs/new">
                <PlusIcon /> New invoice
              </Link>
            </Button>
          </>
        }
      />
      {created.length > 0 && <BulkDownloadBanner ids={created} />}
      {clover && (queue ?? []).length > 0 && (
        <div className="mt-5">
          <CloverQueue payments={queue ?? []} invoices={openOptions} />
        </div>
      )}
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
        <InvoiceList rows={result.rows} page={filters.page} count={result.count} params={params} isAdmin={session.isAdmin} filtered={filtered} groupByDay={spansDays ? today : null} />
      </div>
    </Page>
  );
}
