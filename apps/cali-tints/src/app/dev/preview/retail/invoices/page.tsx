import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { RetailNav } from "@/components/retail/retail-nav";
import { RetailInvoiceList, type RetailInvoiceFilter } from "@/components/retail/retail-invoice-list";
import { retailInvoiceListFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Retail → Invoices (owner, admin, advisor; anyone else gets the Retail home). */
export default async function DevRetailInvoicesPreview(props: PageProps<"/dev/preview/retail/invoices">) {
  const sp = await props.searchParams;
  const { session } = previewSession(sp);
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (typeof sp.status === "string" ? sp.status : "open") as RetailInvoiceFilter;
  const data = retailInvoiceListFixture(q, status);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <Page>
            <PageHeader title="Invoices" description="The shop's own invoices: one per repair order, paid at the counter. Apart from the dealerships and QuickBooks." />
            <div className="mt-5">
              <RetailInvoiceList data={data} page={1} q={q} status={status} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
