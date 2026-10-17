import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { PartsManager, type PartsTab } from "@/components/retail/parts-manager";
import { inventoryFixture, partOrdersFixture, vendorsFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Retail → Parts (guest demo). */
export default async function DevPartsPreview(props: PageProps<"/dev/preview/retail/parts">) {
  const sp = await props.searchParams;
  const { session, canPrices } = previewSession(sp);
  const tab: PartsTab = canPrices && (sp.tab === "orders" || sp.tab === "vendors") ? sp.tab : "parts";
  const q = typeof sp.q === "string" ? sp.q : "";
  const low = sp.low === "1";
  const orders = partOrdersFixture();
  const open = typeof sp.open === "string" ? (orders.find((o) => o.id === sp.open) ?? null) : null;
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <PartsManager tab={tab} items={inventoryFixture(canPrices, q, low)} orders={orders} vendors={vendorsFixture()} q={q} low={low} canEdit={canPrices} showMoney={canPrices} openOrder={open} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
