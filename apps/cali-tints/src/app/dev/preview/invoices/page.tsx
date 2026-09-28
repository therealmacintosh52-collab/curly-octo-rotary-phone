import { Suspense } from "react";
import Link from "next/link";
import { PlusIcon, WalletIcon } from "lucide-react";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { CloverSyncButton } from "@/components/invoices/clover-queue";
import { SendInvoicesButton, type EmailPreview, type UnsentGroup } from "@/components/invoices/send-invoices-button";
import { invoiceEmailEnvelope, invoiceEmailHtml } from "@/lib/invoices/email";
import { invoiceBundleFixture } from "@/test/fixtures";
import { parseInvoiceFilters, resolveInvoiceFilters, STATUS_LABELS } from "@/lib/invoices/query";
import { invoiceListFixture } from "@/test/fixtures";
import type { Company, Profile } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { isoDaysAgo, toDateInput } from "@/lib/dates";

const SERVICES = [
  { id: "s1", name: "PDI" },
  { id: "s2", name: "Sold" },
  { id: "s3", name: "Used" },
  { id: "s4", name: "Service Loaner Detail" },
  { id: "s5", name: "Touch Up Detail" },
  { id: "s7", name: "Paint Correction (1-step)" },
];
const DEALERSHIPS = [
  { id: "d1", name: "Mercedes-Benz of El Dorado Hills" },
  { id: "d2", name: "Mercedes-Benz of Sacramento" },
];

/** Fixture preview of the one list (guest demo in production). Filters come from the URL so the segmented control, chips and sheet behave like the real page. */
export default async function DevInvoicesPreview(props: PageProps<"/dev/preview/invoices">) {
  const typed = parseInvoiceFilters(await props.searchParams);
  const company = { id: "c1", name: "Cali Tints", payment_terms: "Net 30", tax_rate: 0, invoice_prefix: "INV-", next_invoice_number: 1, reminder_days: 30, timezone: "America/Los_Angeles", clover_enabled: true, auto_invoice: true } as Company;
  const profile = { id: "u1", company_id: "c1", role: "owner", full_name: "Owner (preview)", email: null, active: true } as Profile;

  // Apply the URL filters to the fixture the way the RPC would (a date in the search box becomes a range).
  const today = toDateInput(new Date());
  const filters = resolveInvoiceFilters(typed, today); // the fixture dates rows by the server's local day
  const spansDays = !!filters.from && !!filters.to && filters.from !== filters.to;
  const q = filters.q?.toUpperCase();
  const rows = invoiceListFixture().filter((r) => {
    const st = filters.status;
    if (st === "all" && r.status === "void") return false;
    if (st === "unpaid" && !["draft", "submitted", "partial"].includes(r.status)) return false;
    if (st === "outstanding" && !["submitted", "partial"].includes(r.status)) return false;
    if (st === "overdue" && !r.overdue) return false;
    if (["draft", "submitted", "partial", "paid", "void"].includes(st) && r.status !== st) return false;
    if (filters.dealership && r.dealership_id !== filters.dealership) return false;
    if (filters.service && !r.services.includes(SERVICES.find((s) => s.id === filters.service)?.name ?? "")) return false;
    if (filters.from && r.period_end < filters.from) return false;
    if (filters.to && r.period_start > filters.to) return false;
    if (q && !(r.display_number.includes(q) || r.services.some((s) => s.toUpperCase().includes(q)) || r.cars.some((c) => c.tag.includes(q) || (c.vin ?? "").includes(q) || (c.vehicle ?? "").toUpperCase().includes(q)))) return false;
    return true;
  });
  const total = rows.reduce((s, r) => s + r.total, 0);
  const balance = rows.filter((r) => r.status !== "void" && r.status !== "paid").reduce((s, r) => s + r.balance, 0);
  const drafts = invoiceListFixture().filter((r) => r.status === "draft");
  const emailsFor = (dealershipId: string) => (dealershipId === "d1" ? ["ap@mbeldoradohills.example"] : ["ap@mbsacramento.example", "controller@mbsacramento.example"]);
  const unsentGroups: UnsentGroup[] = Object.values(
    drafts.reduce<Record<string, UnsentGroup>>((acc, r) => {
      const g = acc[r.dealership_id] ?? { dealership_id: r.dealership_id, name: r.dealership, emails: emailsFor(r.dealership_id), invoices: [] };
      g.invoices.push({ id: r.id, number: r.display_number, tag: r.cars[0]?.tag ?? "—", vehicle: r.cars[0]?.vehicle ?? null, total: r.total });
      acc[r.dealership_id] = g;
      return acc;
    }, {}),
  );
  // The email each one would be, built from the fixture (the real page asks the server on demand).
  const base = invoiceBundleFixture();
  const emailPreviews: Record<string, EmailPreview> = Object.fromEntries(
    drafts.map((r) => {
      const b = {
        ...base,
        invoice: { ...base.invoice, id: r.id, display_number: r.display_number, period_start: r.period_start, period_end: r.period_end, ro_po_number: r.ro_po_number, total: r.total, payment_terms: r.dealership_id === "d2" ? "Net 45" : "Net 30" },
        dealership: { ...base.dealership, id: r.dealership_id, name: r.dealership, ap_emails: emailsFor(r.dealership_id) },
      };
      const env = invoiceEmailEnvelope(b);
      return [r.id, { to: env.to, cc: env.cc, subject: env.subject, html: invoiceEmailHtml(b, "cali-tints-demo.vercel.app", null), attachments: [{ name: `${env.stem}.pdf`, href: null }, { name: `${env.stem}.csv`, href: null }] }];
    }),
  );
  const unpaidAll = invoiceListFixture().filter((r) => r.status !== "void" && r.status !== "paid").reduce((s, r) => s + r.balance, 0);
  const scope = [filters.status !== "all" ? STATUS_LABELS[filters.status] : null, filters.dealership ? DEALERSHIPS.find((d) => d.id === filters.dealership)?.name : null, filters.service ? SERVICES.find((s) => s.id === filters.service)?.name : null, filters.searchDate?.label ?? null].filter(Boolean);
  const filtered = scope.length > 0 || !!filters.q || !!filters.from || !!filters.to;
  const summary = [`${rows.length} ${rows.length === 1 ? "car" : "cars"}`, formatMoney(total), balance > 0 ? `${formatMoney(balance)} unpaid` : rows.length ? "all paid" : null, ...scope].filter(Boolean);

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <Page>
            <PageHeader
              title="Invoices"
              description={summary.join(" · ")}
              actions={
                <>
                  <CloverSyncButton lastSyncAt={isoDaysAgo(0)} />
                  <Button asChild variant="soft">
                    <Link href="/terminal?invoices=all">
                      <WalletIcon /> Collect all unpaid · {formatMoney(unpaidAll)}
                    </Link>
                  </Button>
                  <SendInvoicesButton groups={unsentGroups} previews={emailPreviews} />
                  <Button asChild>
                    <Link href="/jobs/new">
                      <PlusIcon /> New invoice
                    </Link>
                  </Button>
                </>
              }
            />
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
                <InvoiceFilters filters={typed} searchDate={filters.searchDate} services={SERVICES} dealerships={DEALERSHIPS} isAdmin />
              </Suspense>
              <InvoiceList rows={rows} page={1} count={rows.length} params="" isAdmin filtered={filtered} groupByDay={spansDays ? today : null} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
