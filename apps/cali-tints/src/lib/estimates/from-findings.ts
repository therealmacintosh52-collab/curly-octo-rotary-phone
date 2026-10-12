import type { JobFinding, RetailCatalog } from "@/lib/db/types";
import { emptyLine, type EstimateLineDraft } from "@/lib/retail/quote";

/** The findings picked on the notes tab become estimate lines: the suggested menu service, else an hour of labor to price (0044). */
export function linesFromFindings(findings: JobFinding[], ids: string[], catalog: Pick<RetailCatalog, "services">): EstimateLineDraft[] {
  const wanted = findings.filter((f) => f.kind === "finding" && ids.includes(f.id));
  return wanted.map((f) => {
    const svc = f.recommended_service_id ? catalog.services.find((s) => s.id === f.recommended_service_id && s.active && s.retail && !s.open_amount) : null;
    return svc ? emptyLine("service", { service_id: svc.id, finding_id: f.id }) : emptyLine("labor", { label: f.title, hours: 1, finding_id: f.id });
  });
}
