import { inngest } from "../client";
import { AUDIT_REQUESTED, AuditRequested } from "../events";
import { markAuditFailed, setAuditProgress } from "@/lib/audits/progress";
import { runCrawlStep } from "@/lib/audits/crawl-step";
import { runResolveStep } from "@/lib/audits/resolve-step";
import { supabaseAuditRepo } from "@/lib/audits/repo";
import { createProviders } from "@/lib/providers";
import { supabaseSnapshotStore } from "@/lib/providers/core";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The audit pipeline as a durable function. Each `step.run` is checkpointed
 * by Inngest, so a crash or a timeout resumes at the next step instead of
 * starting over. Steps so far: mark running → resolve (Phase 1) → crawl
 * (Phase 2: website, PageSpeed, website checks, scores) → mark finished.
 * Phases 3–8 add gbp, yelp, citations, rankings, ai, offsite, analyse,
 * revenue and solutions, each updating progress.
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

    const resolved = await step.run("resolve", async () => {
      const admin = createAdminClient();
      return runResolveStep(auditId, {
        repo: supabaseAuditRepo(admin),
        providers: createProviders(),
        ctx: { store: supabaseSnapshotStore(admin) },
        progress: (pct, current_step) => setAuditProgress(auditId, { progress_pct: pct, current_step }),
      });
    });

    const crawled = await step.run("crawl", async () => {
      const admin = createAdminClient();
      return runCrawlStep(auditId, {
        repo: supabaseAuditRepo(admin),
        providers: createProviders(),
        ctx: { store: supabaseSnapshotStore(admin) },
        progress: (pct, current_step) => setAuditProgress(auditId, { progress_pct: pct, current_step }),
      });
    });

    await step.run("mark-finished", () =>
      setAuditProgress(auditId, { status: "succeeded", progress_pct: 100, current_step: "done", finished_at: new Date().toISOString() }),
    );

    return { auditId, status: "succeeded" as const, resolved, crawled };
  },
);
