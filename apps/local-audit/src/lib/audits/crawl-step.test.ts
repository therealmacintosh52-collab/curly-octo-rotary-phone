import { describe, expect, it, vi } from "vitest";
import type { Audit, Business, Json } from "@/lib/db/types";
import { DEMO_SITE, GOOD_SITE, fakeFetchFor } from "@/lib/crawl/__fixtures__/demo-site";
import { createProviders, createWebsiteProvider } from "@/lib/providers";
import { cacheKey, loadFixture, MemorySnapshotStore } from "@/lib/providers/core";
import { cityFromAddress, runCrawlStep } from "./crawl-step";
import { MemoryAuditRepo } from "./repo";

const AUDIT_ID = "30000000-0000-4000-8000-000000000001";
const audit = (inputs: Record<string, unknown>): Audit => ({ id: AUDIT_ID, business_id: "b", status: "running", progress_pct: 50, current_step: "resolve: done", started_at: null, finished_at: null, total_cost_usd: 0, inputs: inputs as Json, scores: {}, revenue_model: {}, version: 1, created_at: "", updated_at: "" });
const business = (over: Partial<Business>): Business => ({ id: "b", name: "Demo Plumbing", canonical_domain: null, phone: "+19165550100", address: "1 Main St, Sacramento, CA 95814", lat: null, lng: null, place_id: null, yelp_alias: null, primary_category: null, service_area: {}, avg_ticket: null, created_by: null, created_at: "", updated_at: "", ...over });

/** Providers with the website served from a fake site and PageSpeed answered from the fixture through the snapshot cache. */
async function depsFor(site: typeof DEMO_SITE, repo: MemoryAuditRepo, withPsi = true) {
  vi.spyOn(console, "info").mockImplementation(() => {});
  const store = new MemorySnapshotStore();
  if (withPsi) {
    const fx = await loadFixture("pagespeed", "runPagespeed");
    for (const strategy of ["mobile", "desktop"] as const) {
      const request = { url: `${site.origin}/`, strategy };
      await store.save({ audit_id: null, provider: "pagespeed", endpoint: "runPagespeed", cache_key: cacheKey("pagespeed", "runPagespeed", request), request, response: fx!.response as Json, fetched_at: new Date().toISOString(), cost_usd: 0, expires_at: null });
    }
  }
  const providers = { ...createProviders({ env: {} }), website: createWebsiteProvider({ fetchImpl: fakeFetchFor(site) }) };
  const progress: string[] = [];
  return { deps: { repo, providers, ctx: { store, mode: "live" as const }, progress: async (_p: number, s: string) => void progress.push(s), crawl: { politeDelayMs: 0, sleep: async () => {}, maxPages: 20 } }, progress, store };
}

describe("runCrawlStep", () => {
  it("crawls the flawed demo site, runs PageSpeed from the cache, persists findings with evidence and scores", async () => {
    const repo = new MemoryAuditRepo(audit({ website: "https://demo-plumbing.example/", services: "plumbing, water heaters" }), business({ canonical_domain: "demo-plumbing.example" }));
    await repo.mergeScores(AUDIT_ID, { checks: { phase: 1, assessed: ["identity_nap"] } });
    const { deps, progress } = await depsFor(DEMO_SITE, repo);
    const out = await runCrawlStep(AUDIT_ID, deps);

    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.pages_crawled).toBe(7);
    expect(out.pagespeed).toEqual({ mobile: 42, desktop: 42 });
    expect(out.findings).toBeGreaterThanOrEqual(50);
    expect(progress.at(-1)).toBe("crawl: done");

    // Every finding links to stored evidence rows.
    expect(repo.findings.length).toBe(out.findings);
    for (const f of repo.findings) {
      expect(f.evidence_ids.length).toBeGreaterThan(0);
      for (const id of f.evidence_ids) expect(repo.evidence.find((e) => e.id === id)).toBeTruthy();
    }
    // The crawl summary is on record as evidence.
    const crawlEv = repo.evidence.find((e) => e.excerpt.startsWith('{"source":"crawl"'));
    expect(crawlEv?.source_url).toBe("https://demo-plumbing.example/");

    // Scores: all seven website categories assessed, identity_nap carried over, headline numbers present.
    const s = repo.scores as Record<string, Json>;
    expect(s.assessed).toEqual(expect.arrayContaining(["identity_nap", "technical_seo", "local_onsite", "schema", "aeo", "images", "conversion", "content_keywords"]));
    const categories = s.categories as Record<string, number | null>;
    expect(categories.technical_seo).toBeLessThan(40);
    expect(categories.gbp).toBeNull();
    expect(typeof s.visibility).toBe("number");
    expect(typeof s.conversion).toBe("number");
    expect((s.crawl as Record<string, Json>).pages_crawled).toBe(7);
    expect((s.pagespeed as Record<string, Record<string, Json>>).mobile!.status).toBe("ok");
  });

  it("records PageSpeed as UNAVAILABLE (not_configured) instead of guessing, and the PSI checks stay unavailable", async () => {
    const repo = new MemoryAuditRepo(audit({ website: "https://good-plumbing.example/" }), business({ name: "Good Plumbing", canonical_domain: "good-plumbing.example" }));
    const { deps } = await depsFor(GOOD_SITE, repo, false);
    const out = await runCrawlStep(AUDIT_ID, deps);
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.pagespeed.mobile).toBe("UNAVAILABLE: not_configured");
    const gap = repo.evidence.filter((e) => e.excerpt.includes('"source":"pagespeed_mobile"'));
    expect(gap).toHaveLength(1);
    expect(gap[0]!.excerpt).toContain("UNAVAILABLE");
    const psiChecks = (repo.scores.checks_website as { unavailable: { check_id: string }[] }).unavailable.map((u) => u.check_id);
    expect(psiChecks).toEqual(expect.arrayContaining(["technical_seo.psi_lcp", "conversion.slow_mobile_bounce"]));
    // Clean site: no website findings at all.
    expect(repo.findings).toEqual([]);
    expect(out.scores.visibility).toBe(100);
  });

  it("skips cleanly when there is no website", async () => {
    const repo = new MemoryAuditRepo(audit({ gbp: "Demo Plumbing" }), business({}));
    const { deps } = await depsFor(DEMO_SITE, repo, false);
    const out = await runCrawlStep(AUDIT_ID, deps);
    expect(out).toMatchObject({ status: "skipped", findings: 0 });
    expect(repo.scores.crawl).toMatchObject({ status: "skipped" });
    expect(repo.findings).toEqual([]);
  });

  it("derives the city from a US address", () => {
    expect(cityFromAddress("1 Main St, Sacramento, CA 95814")).toBe("Sacramento, CA");
    expect(cityFromAddress("1 Main St, Elk Grove, CA 95624, USA")).toBe("Elk Grove, CA");
    expect(cityFromAddress("somewhere")).toBeNull();
    expect(cityFromAddress(null)).toBeNull();
  });
});
