import { describe, expect, it } from "vitest";
import { ClientReportSchema, loadClientReport, type ClientReport } from "./client-report";

const valid: ClientReport = {
  audit: { id: "a", status: "succeeded", progress_pct: 100, finished_at: null, scores: {}, revenue_model: {}, version: 1 },
  business: { name: "Test Plumbing", canonical_domain: "testplumbing.example", primary_category: null, address: null },
  findings: [{ id: "f", category: "conversion", severity: "high", title: "x" }],
  solutions: [
    { id: "s", finding_id: "f", steps: ["do this"], assets: {}, code_snippets: [], time_estimate_hrs: 1, suggested_price: 250, priority_rank: 1, roadmap_phase: 30, revealed_at: "2026-09-27T00:00:00Z" },
  ],
  solution_counts: { revealed: 1, total: 3 },
  competitors: [],
  ai_visibility: [],
  rank_grid: [],
  citations: [],
  social_profiles: [],
  backlink_metrics: [],
  brand_mentions: [],
  evidence: [{ id: "e", type: "html", excerpt: "…" }],
  share: { expires_at: null, view_count: 1 },
};

const rpcReturning = (data: unknown) => async () => ({ data: data as never, error: null });

describe("ClientReportSchema", () => {
  it("accepts the RPC shape", () => {
    expect(ClientReportSchema.parse(valid)).toEqual(valid);
  });
  it("rejects a solution row that carries is_revealed or any unexpected key", () => {
    const leaked = { ...valid, solutions: [{ ...valid.solutions[0]!, is_revealed: false }] };
    expect(() => ClientReportSchema.parse(leaked)).toThrow();
    const extra = { ...valid, solutions: [{ ...valid.solutions[0]!, internal_notes: "secret" }] };
    expect(() => ClientReportSchema.parse(extra)).toThrow();
  });
  it("rejects audit inputs, cost, and evidence storage paths", () => {
    expect(() => ClientReportSchema.parse({ ...valid, audit: { ...valid.audit, inputs: {} } })).toThrow();
    expect(() => ClientReportSchema.parse({ ...valid, audit: { ...valid.audit, total_cost_usd: 1 } })).toThrow();
    expect(() => ClientReportSchema.parse({ ...valid, evidence: [{ id: "e", storage_path: "private/x.png" }] })).toThrow();
  });
  it("rejects unknown top-level keys", () => {
    expect(() => ClientReportSchema.parse({ ...valid, vault: [] })).toThrow();
  });
});

describe("loadClientReport", () => {
  it("returns null for unknown tokens and malformed tokens without calling the RPC", async () => {
    expect(await loadClientReport("t_missing", rpcReturning(null))).toBeNull();
    let called = false;
    expect(
      await loadClientReport("../etc", async () => {
        called = true;
        return { data: null, error: null };
      }),
    ).toBeNull();
    expect(called).toBe(false);
  });
  it("returns the parsed report", async () => {
    const r = await loadClientReport("t_ok", rpcReturning(valid));
    expect(r?.business.name).toBe("Test Plumbing");
    expect(r?.solutions).toHaveLength(1);
  });
  it("throws on RPC errors and on drifted shapes", async () => {
    await expect(loadClientReport("t_ok", async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow(/boom/);
    await expect(loadClientReport("t_ok", rpcReturning({ ...valid, solutions: [{ ...valid.solutions[0]!, is_revealed: true }] }))).rejects.toThrow();
  });
});
