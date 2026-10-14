import type { EstimateView, JobEstimate, JobFinding } from "@/lib/db/types";
import { RoNotes } from "@/components/jobs/ro-notes";
import { SendFindings } from "./send-findings";
import type { FindingPricing } from "@/lib/retail/finding-quote";

/**
 * The findings side tab for an estimate: what the tech found (notes, photos,
 * clips, recommendations), Send findings, and Add to this estimate. The same
 * panel sits beside the finished estimate and beside the invoice.
 */
export function EstimateFindingsPanel({ e, findings, services, canPrices, isAdmin, userId, findingsUrl, pricing, large, side, fromLastTime = [], estimates = [] }: { large?: boolean; side?: boolean; /** Open findings on this car from earlier visits. */ fromLastTime?: JobFinding[]; /** The extra-work estimates written on this visit. */ estimates?: JobEstimate[]; e: EstimateView; findings: JobFinding[]; services: { id: string; name: string }[]; canPrices: boolean; isAdmin: boolean; userId: string; findingsUrl: string | null; /** The shop's rates, so a finding can be priced beside it (owner, admin, advisor). */ pricing?: FindingPricing | null }) {
  const open = e.status === "draft" || e.status === "sent" || e.status === "viewed";
  // Once approved, the visit's notes belong to the visit: a finding can be quoted as extra work from here.
  const onVisit = !!e.job_id && e.kind === "quote" && e.status === "accepted";
  return (
    <RoNotes
      estimateId={e.id}
      jobId={onVisit ? (e.job_id ?? undefined) : undefined}
      jobOpen={onVisit ? !e.job?.paid_at : undefined}
      estimates={onVisit ? estimates : undefined}
      large={large}
      side={side}
      roNumber={e.job?.ro_number ?? null}
      findings={findings}
      fromLastTime={fromLastTime}
      services={services}
      canWrite={open || isAdmin}
      canDeleteAny={canPrices}
      userId={userId}
      canQuote={canPrices}
      estimateOpen={open}
      pricing={canPrices ? pricing : null}
      share={canPrices && findingsUrl ? { url: findingsUrl, firstName: e.customer.first_name, vehicle: e.vehicle?.name ?? null, phone: e.customer.phone ?? null, email: e.customer.email ?? null } : null}
      estimateSoFar={canPrices && e.subtotal !== null && e.subtotal > 0 ? { display_number: e.display_number, subtotal: e.subtotal, tax: e.tax ?? 0, total: e.total ?? e.subtotal } : null}
      extra={
        canPrices && findingsUrl ? (
          <SendFindings estimateId={e.id} firstName={e.customer.first_name} vehicle={e.vehicle?.name ?? null} phone={e.customer.phone ?? null} email={e.customer.email ?? null} url={findingsUrl} sentAt={e.findings_sent_at ?? null} count={findings.filter((f) => f.customer_visible !== false).length} />
        ) : null
      }
    />
  );
}
