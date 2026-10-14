import type { EstimateView, JobFinding } from "@/lib/db/types";
import { RoNotes } from "@/components/jobs/ro-notes";
import { SendFindings } from "./send-findings";

/**
 * The findings side tab for an estimate: what the tech found (notes, photos,
 * clips, recommendations), Send findings, and Add to this estimate. The same
 * panel sits beside the finished estimate and beside the invoice.
 */
export function EstimateFindingsPanel({ e, findings, services, canPrices, isAdmin, userId, findingsUrl }: { e: EstimateView; findings: JobFinding[]; services: { id: string; name: string }[]; canPrices: boolean; isAdmin: boolean; userId: string; findingsUrl: string | null }) {
  const open = e.status === "draft" || e.status === "sent" || e.status === "viewed";
  return (
    <RoNotes
      estimateId={e.id}
      roNumber={e.job?.ro_number ?? null}
      findings={findings}
      fromLastTime={[]}
      services={services}
      canWrite={open || isAdmin}
      canDeleteAny={canPrices}
      userId={userId}
      canQuote={canPrices}
      estimateOpen={open}
      extra={
        canPrices && findingsUrl ? (
          <SendFindings estimateId={e.id} firstName={e.customer.first_name} vehicle={e.vehicle?.name ?? null} phone={e.customer.phone ?? null} email={e.customer.email ?? null} url={findingsUrl} sentAt={e.findings_sent_at ?? null} count={findings.filter((f) => f.customer_visible !== false).length} />
        ) : null
      }
    />
  );
}
