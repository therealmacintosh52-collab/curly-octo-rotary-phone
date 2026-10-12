import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { RetailNav } from "@/components/retail/retail-nav";
import { EstimateList, type EstimateFilter } from "@/components/retail/estimate-list";
import { estimateListFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Retail → Estimates. */
export default async function DevEstimatesPreview(props: PageProps<"/dev/preview/retail/estimates">) {
  const sp = await props.searchParams;
  const { session, canPrices } = previewSession(sp);
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (typeof sp.status === "string" ? sp.status : "open") as EstimateFilter;
  const data = estimateListFixture(canPrices, q, status);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <Page>
            <PageHeader title="Estimates" description="Quotes for walk-in customers: write it, send the link, they pick and sign." />
            <div className="mt-5">
              <EstimateList rows={data.rows} count={data.count} page={1} q={q} status={status} showMoney={canPrices} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
