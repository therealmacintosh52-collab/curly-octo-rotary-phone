import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { BookingSettings } from "@/components/settings/booking-settings";
import { automationLogFixture, automationRulesFixture, retailCatalogFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Settings → Booking. */
export default async function DevBookingSettingsPreview(props: PageProps<"/dev/preview/settings/booking">) {
  const sp = await props.searchParams;
  const { session } = previewSession(sp);
  const cat = retailCatalogFixture(true);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <Page>
            <PageHeader title="Settings" description="Company profile, dealerships, users; for the owner also the price list and data export." />
            <div className="mt-5">
              <SettingsNav />
            </div>
            <div className="mt-5">
              <BookingSettings data={{ settings: cat.settings!, hours: cat.hours, resources: cat.resources, blackouts: cat.blackouts, timeOff: cat.time_off, people: [{ id: "u2", full_name: "Victor" }, { id: "u3", full_name: "Dee One" }, { id: "u5", full_name: "Sam" }], rules: automationRulesFixture(), log: automationLogFixture() }} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
