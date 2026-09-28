import { AuditDetail } from "@/components/audits/audit-detail";
import { runDemo, SCENARIOS } from "../_lib/run-demo";

export const dynamic = "force-dynamic";

/** Runs the real resolve (and crawl) steps against fixtures and renders the real detail view. */
export default async function PreviewAudit(props: PageProps<"/dev/preview/audit">) {
  const sp = await props.searchParams;
  const scenario = SCENARIOS[typeof sp.scenario === "string" ? sp.scenario : "default"] ?? SCENARIOS.default!;
  const run = await runDemo(scenario);
  return <AuditDetail audit={run.audit} business={run.business} findings={run.findings} evidence={run.evidence} />;
}
