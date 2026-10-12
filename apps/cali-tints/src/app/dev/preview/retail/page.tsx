import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { RetailToday } from "@/components/retail/retail-today";
import { retailTodayFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Retail → Today (guest demo in production). */
export default async function DevRetailPreview(props: PageProps<"/dev/preview/retail">) {
  const sp = await props.searchParams;
  const { session } = previewSession(sp);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <RetailToday data={retailTodayFixture()} shopName="Cali Tint · Fulton Ave" />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
