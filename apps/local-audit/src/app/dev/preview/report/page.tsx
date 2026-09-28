import { ClientReportView } from "@/components/report/client-report-view";
import type { ClientReport } from "@/lib/reports/client-report";
import { runDemo, SCENARIOS } from "../_lib/run-demo";

export const dynamic = "force-dynamic";

/**
 * The customer report, fed by the same pipeline run as the audit preview and
 * shaped like get_client_report() output: findings, evidence without storage
 * paths, and one solution revealed so the unlocked state renders too.
 */
export default async function PreviewReport(props: PageProps<"/dev/preview/report">) {
  const sp = await props.searchParams;
  const scenario = SCENARIOS[typeof sp.scenario === "string" ? sp.scenario : "crawl"] ?? SCENARIOS.crawl!;
  const run = await runDemo(scenario);
  const first = run.findings[0];
  const report: ClientReport = {
    audit: { id: run.audit.id, status: run.audit.status, progress_pct: run.audit.progress_pct, finished_at: run.audit.finished_at, scores: run.audit.scores, revenue_model: run.audit.revenue_model, version: run.audit.version },
    business: { name: run.business.name, canonical_domain: run.business.canonical_domain, primary_category: run.business.primary_category, address: run.business.address },
    findings: run.findings.map((f) => {
      const { audit_id, ...rest } = f;
      void audit_id;
      return rest as unknown as Record<string, unknown>;
    }),
    solutions: first
      ? [
          {
            id: "solution-1",
            finding_id: first.id,
            steps: ["Synthetic preview step one: what the agency would do first.", "Synthetic preview step two.", "Synthetic preview step three: how to confirm it worked."],
            assets: {},
            code_snippets: [],
            time_estimate_hrs: 1,
            suggested_price: 150,
            priority_rank: 1,
            roadmap_phase: 30,
            revealed_at: run.audit.finished_at,
          },
        ]
      : [],
    solution_counts: { revealed: first ? 1 : 0, total: run.findings.length },
    competitors: [],
    ai_visibility: [],
    rank_grid: [],
    citations: [],
    social_profiles: [],
    backlink_metrics: [],
    brand_mentions: [],
    evidence: run.evidence.map((e) => {
      const { storage_path, audit_id, ...rest } = e;
      void storage_path;
      void audit_id;
      return rest as unknown as Record<string, unknown>;
    }),
    share: { expires_at: null, view_count: 3 },
  };
  return <ClientReportView report={report} />;
}
