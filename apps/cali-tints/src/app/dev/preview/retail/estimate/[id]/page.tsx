import { notFound } from "next/navigation";
import DevEstimateEditPreview from "./edit/page";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { EstimateDetail } from "@/components/retail/estimate-detail";
import { ESTIMATE_TOKEN, estimateViewFixture, retailCatalogFixture, retailServicesFixture, visitFixture, fromLastTimeFixture, jobEstimatesFixture, signedDocumentsFixture, activityFixture, inspectionTemplatesFixture, retailTechniciansFixture, visitInspectionsFixture } from "@/test/retail-fixtures";
import { findingPricing } from "@/lib/retail/finding-quote";
import { RoNotes } from "@/components/jobs/ro-notes";
import { SendFindings } from "@/components/retail/send-findings";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of one estimate. */
export default async function DevEstimatePreview(props: PageProps<"/dev/preview/retail/estimate/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session, canPrices, isAdmin } = previewSession(sp);
  // Edit Mode is the same address with ?edit=1 (the guest demo shows the builder there too).
  if (sp.edit === "1" && canPrices) return <DevEstimateEditPreview params={props.params} searchParams={props.searchParams} />;
  const base = estimateViewFixture(id, canPrices);
  if (!base) notFound();
  // ?work=done|qc and ?pay=partial|paid|signed|closed walk the visit through its stages.
  const visit = visitFixture(id, canPrices, isAdmin, { work: sp.work, pay: sp.pay, unauth: sp.unauth });
  const e = visit && base.job ? { ...base, job: { ...base.job, paid_at: visit.payment.paid_at ?? base.job.paid_at, picked_up_at: visit.charge?.picked_up_at ?? base.job.picked_up_at ?? null, qc_at: visit.work.qcAt, completed_at: visit.work.completedAt } } : base;
  // Once there is a visit, the customer's link for the findings is the invoice page (the real page does the same).
  const findingsUrl = e.job_id ? "/r/demo-invoice-token-marcus-tesla-0002" : `/e/${ESTIMATE_TOKEN}`;
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
            visit={visit}
            documents={signedDocumentsFixture(e.id)}
            activity={isAdmin ? activityFixture(e.id, canPrices) : null}
            inspections={visitInspectionsFixture(e.id)}
            inspectionTemplates={inspectionTemplatesFixture()}
            technicians={canPrices ? retailTechniciansFixture() : []}
            supplements={e.job_id && e.kind === "quote" ? jobEstimatesFixture(e.job_id, canPrices) : []}
            findingsCount={(e.findings ?? []).length}
            notes={
              <RoNotes
                estimateId={e.id}
                jobId={e.job_id && e.kind === "quote" && e.status === "accepted" ? e.job_id : undefined}
                jobOpen={e.job ? !e.job.paid_at : undefined}
                estimates={e.job_id && e.kind === "quote" ? jobEstimatesFixture(e.job_id, canPrices) : undefined}
                roNumber={e.job?.ro_number ?? null}
                findings={e.findings ?? []}
                fromLastTime={e.job ? fromLastTimeFixture(e.job.id) : []}
                services={retailServicesFixture(false).filter((s) => s.retail).map((s) => ({ id: s.id, name: s.name }))}
                canWrite={e.status === "draft" || e.status === "sent" || e.status === "viewed" || canPrices}
                canDeleteAny={canPrices}
                userId="u2"
                canQuote={canPrices}
                large
                side
                pricing={canPrices ? findingPricing(retailCatalogFixture(true)) : null}
                share={canPrices ? { url: findingsUrl, firstName: e.customer.first_name, vehicle: e.vehicle?.name ?? null, phone: e.customer.phone ?? null, email: e.customer.email ?? null } : null}
                estimateSoFar={canPrices && e.subtotal ? { display_number: e.display_number, subtotal: e.subtotal, tax: e.tax ?? 0, total: e.total ?? e.subtotal } : null}
                estimateOpen={e.status === "draft" || e.status === "sent" || e.status === "viewed"}
                extra={canPrices ? <SendFindings estimateId={e.id} firstName={e.customer.first_name} vehicle={e.vehicle?.name ?? null} phone={e.customer.phone ?? null} email={e.customer.email ?? null} url={findingsUrl} sentAt={null} count={(e.findings ?? []).filter((f) => f.customer_visible !== false).length} /> : null}
              />
            }
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
