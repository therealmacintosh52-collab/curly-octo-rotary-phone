import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { RetailDashboard, type DashboardTab } from "@/components/retail/retail-dashboard";
import { estimateListFixture, retailTodayFixture, textQueueFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

const TABS: DashboardTab[] = ["action", "board", "open", "closed"];

/** Fixture preview of the Retail dashboard (guest demo in production). */
export default async function DevRetailPreview(props: PageProps<"/dev/preview/retail">) {
  const sp = await props.searchParams;
  const { session, canPrices } = previewSession(sp);
  const view = sp.view === "stage" ? "stage" : "tech";
  const tab: DashboardTab = (TABS as string[]).includes(String(sp.tab)) ? (sp.tab as DashboardTab) : "action";
  const today = retailTodayFixture(canPrices);
  const open = estimateListFixture(canPrices, "", "open");
  const closed = estimateListFixture(canPrices, "", "closed");
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <RetailDashboard
            data={{ tab, view, customers: today.customers, open: open.rows, closed: closed.rows, counts: open.counts ?? {}, leads: today.leads, holds: today.holds, appointments: today.appointments, texts: textQueueFixture(), showMoney: canPrices, money: today.money ?? null }}
            shopName="Cali Tint · Fulton Ave"
            tz="America/Los_Angeles"
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
