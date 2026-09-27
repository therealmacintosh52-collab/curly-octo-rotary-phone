import { inngest } from "../client";
import { AUDIT_REQUESTED, AuditRequested } from "../events";
import { markAuditFailed, setAuditProgress } from "@/lib/audits/progress";

/**
 * The audit pipeline as a durable function. Each `step.run` is checkpointed
 * by Inngest, so a crash or a timeout resumes at the next step instead of
 * starting over. Phase 0 ships the frame: mark running → collect (placeholder)
 * → mark finished. Phases 1–8 replace "collect" with the real steps
 * (resolve, crawl, gbp, yelp, citations, rankings, ai, offsite, analyse,
 * revenue, solutions), each updating progress_pct / current_step.
 */
export const auditRun = inngest.createFunction(
  {
    id: "audit-run",
    name: "Run audit",
    triggers: [{ event: AUDIT_REQUESTED }],
    retries: 2,
    concurrency: { limit: 2 },
    onFailure: async ({ event, error }) => {
      const original = (event as { data?: { event?: { data?: unknown } } }).data?.event?.data;
      const parsed = AuditRequested.safeParse(original);
      if (parsed.success) await markAuditFailed(parsed.data.auditId, error.message);
    },
  },
  async ({ event, step }) => {
    const { auditId } = AuditRequested.parse(event.data);

    await step.run("mark-running", () =>
      setAuditProgress(auditId, { status: "running", progress_pct: 5, current_step: "start", started_at: new Date().toISOString() }),
    );

    const collected = await step.run("collect", async () => ({
      skipped: true as const,
      reason: "Phase 0 skeleton: collectors arrive in Phase 1",
    }));

    await step.run("mark-finished", () =>
      setAuditProgress(auditId, { status: "succeeded", progress_pct: 100, current_step: "done", finished_at: new Date().toISOString() }),
    );

    return { auditId, status: "succeeded" as const, collected };
  },
);
