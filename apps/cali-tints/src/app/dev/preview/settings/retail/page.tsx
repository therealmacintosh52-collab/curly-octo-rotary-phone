import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { RetailCatalogManager } from "@/components/settings/retail-catalog-manager";
import { retailCatalogFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Settings → Shop menu. */
export default async function DevRetailSettingsPreview(props: PageProps<"/dev/preview/settings/retail">) {
  const sp = await props.searchParams;
  const { session } = previewSession(sp);
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
              <RetailCatalogManager catalog={retailCatalogFixture(true)} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
