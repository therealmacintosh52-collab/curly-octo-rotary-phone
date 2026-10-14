import { notFound, redirect } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { EstimateBuilder } from "@/components/retail/estimate-builder";
import { ESTIMATE_TOKEN, estimateViewFixture, pickedCustomersFixture, retailCatalogFixture, retailServicesFixture } from "@/test/retail-fixtures";
import { EstimateFindingsPanel } from "@/components/retail/estimate-findings-panel";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of editing an estimate. */
export default async function DevEstimateEditPreview(props: PageProps<"/dev/preview/retail/estimate/[id]/edit">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session, canPrices } = previewSession(sp);
  const e = estimateViewFixture(id, canPrices);
  if (!e) notFound();
  if (e.status === "accepted" || e.status === "declined" || e.applied_at || (e.kind !== "supplement" && e.job_id)) redirect(`/retail/estimates/${id}${sp.as ? `?as=${String(sp.as)}` : ""}`);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <EstimateBuilder
            catalog={retailCatalogFixture(canPrices)}
            recent={pickedCustomersFixture()}
            estimate={e}
            findingsCount={(e.findings ?? []).length}
            findingsPanel={
              <EstimateFindingsPanel
                e={e}
                findings={e.findings ?? []}
                services={retailServicesFixture(false).filter((s) => s.retail).map((s) => ({ id: s.id, name: s.name }))}
                canPrices={canPrices}
                isAdmin={canPrices}
                userId="u2"
                findingsUrl={canPrices ? `/e/${ESTIMATE_TOKEN}` : null}
                large
              />
            }
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
