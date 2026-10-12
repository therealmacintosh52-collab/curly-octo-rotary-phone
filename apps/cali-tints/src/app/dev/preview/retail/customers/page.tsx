import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { RetailNav } from "@/components/retail/retail-nav";
import { CustomerList } from "@/components/retail/customer-list";
import { customerListFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Retail → Customers. */
export default async function DevCustomersPreview(props: PageProps<"/dev/preview/retail/customers">) {
  const sp = await props.searchParams;
  const { session, canPrices } = previewSession(sp);
  const q = typeof sp.q === "string" ? sp.q : "";
  const archived = sp.archived === "1";
  const rows = customerListFixture(canPrices, q, archived);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <Page>
            <PageHeader title="Customers" description="Walk-in customers at the shop and their cars." />
            <div className="mt-5">
              <CustomerList rows={rows} count={rows.length} page={1} q={q} archived={archived} showMoney={canPrices} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
