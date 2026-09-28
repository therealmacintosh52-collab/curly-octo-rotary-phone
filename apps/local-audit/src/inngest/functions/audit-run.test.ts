import { InngestTestEngine } from "@inngest/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIT_REQUESTED } from "../events";

vi.mock("@/lib/audits/progress", () => ({
  setAuditProgress: vi.fn(async () => {}),
  markAuditFailed: vi.fn(async () => {}),
}));
vi.mock("@/lib/audits/resolve-step", () => ({
  runResolveStep: vi.fn(async () => ({ name: "Test Plumbing", sources: { website: "ok", gbp: "ok", yelp: "not_given" }, findings: 0 })),
}));
vi.mock("@/lib/audits/crawl-step", () => ({
  runCrawlStep: vi.fn(async () => ({ status: "ok", pages_crawled: 7, findings: 12, scores: { visibility: 40, conversion: 55 } })),
}));
vi.mock("@/lib/audits/repo", () => ({ supabaseAuditRepo: vi.fn(() => ({})) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/providers/core", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/providers/core")>()), supabaseSnapshotStore: vi.fn(() => ({})) }));

const { setAuditProgress } = await import("@/lib/audits/progress");
const { runResolveStep } = await import("@/lib/audits/resolve-step");
const { runCrawlStep } = await import("@/lib/audits/crawl-step");
const { auditRun } = await import("./audit-run");

const auditId = "30000000-0000-4000-8000-000000000001";
const businessId = "20000000-0000-4000-8000-000000000001";

describe("audit-run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the audit running, resolves, crawls, then marks it finished", async () => {
    const t = new InngestTestEngine({ function: auditRun, events: [{ name: AUDIT_REQUESTED, data: { auditId, businessId } }] });
    const { result, ctx } = await t.execute();
    expect(result).toMatchObject({ auditId, status: "succeeded", resolved: { name: "Test Plumbing" }, crawled: { pages_crawled: 7 } });

    const stepIds = (ctx.step.run as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0]);
    expect(stepIds).toEqual(["mark-running", "resolve", "crawl", "mark-finished"]);
    expect(vi.mocked(runResolveStep)).toHaveBeenCalledWith(auditId, expect.objectContaining({ repo: expect.anything(), providers: expect.anything() }));
    expect(vi.mocked(runCrawlStep)).toHaveBeenCalledWith(auditId, expect.objectContaining({ repo: expect.anything(), providers: expect.anything() }));

    const calls = vi.mocked(setAuditProgress).mock.calls;
    expect(calls[0]![1]).toMatchObject({ status: "running", progress_pct: 5 });
    expect(calls.at(-1)![1]).toMatchObject({ status: "succeeded", progress_pct: 100 });
  });

  it("rejects an event with a bad payload before touching the database", async () => {
    const t = new InngestTestEngine({ function: auditRun, events: [{ name: AUDIT_REQUESTED, data: { auditId: "nope" } }] });
    const { error } = await t.execute();
    expect(error).toBeTruthy();
    expect(setAuditProgress).not.toHaveBeenCalled();
    expect(runResolveStep).not.toHaveBeenCalled();
    expect(runCrawlStep).not.toHaveBeenCalled();
  });
});
