import { InngestTestEngine } from "@inngest/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIT_REQUESTED } from "../events";

vi.mock("@/lib/audits/progress", () => ({
  setAuditProgress: vi.fn(async () => {}),
  markAuditFailed: vi.fn(async () => {}),
}));

const { setAuditProgress } = await import("@/lib/audits/progress");
const { auditRun } = await import("./audit-run");

const auditId = "30000000-0000-4000-8000-000000000001";
const businessId = "20000000-0000-4000-8000-000000000001";

describe("audit-run", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the audit running, collects, then marks it finished", async () => {
    const t = new InngestTestEngine({ function: auditRun, events: [{ name: AUDIT_REQUESTED, data: { auditId, businessId } }] });
    const { result, ctx } = await t.execute();
    expect(result).toMatchObject({ auditId, status: "succeeded", collected: { skipped: true } });

    const stepIds = (ctx.step.run as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0]);
    expect(stepIds).toEqual(["mark-running", "collect", "mark-finished"]);

    const calls = vi.mocked(setAuditProgress).mock.calls;
    expect(calls[0]![0]).toBe(auditId);
    expect(calls[0]![1]).toMatchObject({ status: "running", progress_pct: 5 });
    expect(calls[1]![1]).toMatchObject({ status: "succeeded", progress_pct: 100 });
  });

  it("rejects an event with a bad payload before touching the database", async () => {
    const t = new InngestTestEngine({ function: auditRun, events: [{ name: AUDIT_REQUESTED, data: { auditId: "nope" } }] });
    const { error } = await t.execute();
    expect(error).toBeTruthy();
    expect(setAuditProgress).not.toHaveBeenCalled();
  });
});
