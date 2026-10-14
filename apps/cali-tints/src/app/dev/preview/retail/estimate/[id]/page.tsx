import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { EstimateDetail } from "@/components/retail/estimate-detail";
import { ESTIMATE_TOKEN, estimateViewFixture, retailServicesFixture } from "@/test/retail-fixtures";
import { RoNotes } from "@/components/jobs/ro-notes";
import { SendFindings } from "@/components/retail/send-findings";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of one estimate. */
export default async function DevEstimatePreview(props: PageProps<"/dev/preview/retail/estimate/[id]">) {
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
          <EstimateDetail
            e={e}
            showMoney={canPrices}
            publicUrl={canPrices ? `/e/${ESTIMATE_TOKEN}` : null}
            findingsCount={(e.findings ?? []).length}
            notes={
              <RoNotes
                estimateId={e.id}
                roNumber={e.job?.ro_number ?? null}
                findings={e.findings ?? []}
                fromLastTime={[]}
                services={retailServicesFixture(false).filter((s) => s.retail).map((s) => ({ id: s.id, name: s.name }))}
                canWrite={e.status === "draft" || e.status === "sent" || e.status === "viewed" || canPrices}
                canDeleteAny={canPrices}
                userId="u2"
                canQuote={canPrices}
                estimateOpen={e.status === "draft" || e.status === "sent" || e.status === "viewed"}
                extra={canPrices ? <SendFindings estimateId={e.id} firstName={e.customer.first_name} vehicle={e.vehicle?.name ?? null} phone={e.customer.phone ?? null} email={e.customer.email ?? null} url={`/e/${ESTIMATE_TOKEN}`} sentAt={null} count={(e.findings ?? []).filter((f) => f.customer_visible !== false).length} /> : null}
              />
            }
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
