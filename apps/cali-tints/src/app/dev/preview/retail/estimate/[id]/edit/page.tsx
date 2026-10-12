import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { EstimateBuilder } from "@/components/retail/estimate-builder";
import { estimateViewFixture, pickedCustomersFixture, retailCatalogFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of editing an estimate. */
export default async function DevEstimateEditPreview(props: PageProps<"/dev/preview/retail/estimate/[id]/edit">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session, canPrices } = previewSession(sp);
  const e = estimateViewFixture(id, canPrices);
  if (!e) notFound();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <EstimateBuilder catalog={retailCatalogFixture(canPrices)} recent={pickedCustomersFixture()} estimate={e} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
