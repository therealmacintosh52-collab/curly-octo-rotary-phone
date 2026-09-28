import { describe, expect, it } from "vitest";
import type { Audit, Business, Json } from "@/lib/db/types";
import { createProviders } from "@/lib/providers";
import { MemorySnapshotStore } from "@/lib/providers/core";
import { MemoryAuditRepo } from "./repo";
import { runResolveStep } from "./resolve-step";

const audit = (inputs: Record<string, unknown>): Audit => ({
  id: "30000000-0000-4000-8000-000000000001",
  business_id: "20000000-0000-4000-8000-000000000001",
  status: "running",
  progress_pct: 5,
  current_step: "start",
  started_at: null,
  finished_at: null,
  total_cost_usd: 0,
  inputs: inputs as Json,
  scores: {},
  revenue_model: {},
  version: 1,
  created_at: "",
  updated_at: "",
});
const business: Business = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "pending",
  canonical_domain: null,
  phone: null,
  address: null,
  lat: null,
  lng: null,
  place_id: null,
  yelp_alias: null,
  primary_category: null,
  service_area: {},
  avg_ticket: null,
  created_by: null,
  created_at: "",
  updated_at: "",
};

function deps(repo: MemoryAuditRepo) {
  const store = new MemorySnapshotStore();
  return { repo, providers: createProviders({ env: {} }), ctx: { store, mode: "mock" as const }, store };
}

describe("runResolveStep (mock providers, fixtures)", () => {
  it("resolves website + Maps URL + Yelp into one consistent entity with no NAP findings", async () => {
    const repo = new MemoryAuditRepo(
      audit({
        website: "testplumbing.example",
        gbp: "https://www.google.com/maps/place/Test+Plumbing/@38.5816,-121.4944,17z/data=!3m1!4b1!4m6!3m5!1s0x1:0x2!8m2!3d38.5816!4d-121.4944",
        yelp: "https://www.yelp.com/biz/test-plumbing-sacramento",
        avgTicket: 300,
      }),
      business,
    );
    const d = deps(repo);
    const progress: string[] = [];
    const summary = await runResolveStep(audit({}).id, { ...d, progress: async (_p, s) => void progress.push(s) });

    expect(summary.sources).toEqual({ website: "ok", gbp: "ok", yelp: "ok" });
    expect(summary.nap).toEqual({ name: "match", phone: "match", address: "match" });
    expect(summary.place_id).toBe("ChIJsynthetic000000000001");
    expect(summary.findings).toBe(0);
    expect(summary.unavailable).toEqual([]);

    const patch = repo.businessPatches[0]!;
    expect(patch).toMatchObject({ name: "Test Plumbing", canonical_domain: "testplumbing.example", phone: "+19165550100", place_id: "ChIJsynthetic000000000001", yelp_alias: "test-plumbing-sacramento", avg_ticket: 300 });
    expect(patch.lat).toBeCloseTo(38.5816, 3);

    expect(repo.evidence.map((e) => JSON.parse(e.excerpt).source)).toEqual(["website", "gbp", "yelp"]);
    expect(repo.findings).toEqual([]);
    expect(repo.summaries[0]).toMatchObject({ phase: 1, assessed: expect.arrayContaining(["identity_nap", "conversion"]) });
    expect(progress.at(-1)).toBe("resolve: done");
    // Fixtures cost nothing and are cached snapshots, so no spend is recorded.
    expect(await d.store.sumCost(audit({}).id)).toBe(0);
  });

  it("records UNAVAILABLE sources as evidence and raises gbp_not_found when Google is not configured", async () => {
    const repo = new MemoryAuditRepo(audit({ gbp: "Test Plumbing, Sacramento CA" }), business);
    const d = deps(repo);
    // Live mode without keys: every provider is not_configured.
    const summary = await runResolveStep(audit({}).id, { ...d, ctx: { store: d.store, mode: "live" } });
    expect(summary.sources.gbp).toBe("unavailable");
    expect(summary.unavailable[0]).toMatchObject({ source: "gbp", reason: "not_configured" });
    expect(repo.evidence.some((e) => e.excerpt.includes('"status":"UNAVAILABLE"'))).toBe(true);
    expect(repo.findings.map((f) => f.check_id)).toEqual(["identity_nap.gbp_not_found"]);
    expect(repo.findings[0]!.severity).toBe("critical");
    // With nothing resolved, the business row is left alone except for the name from the text input.
    expect(repo.businessPatches[0]).toEqual({ name: "Test Plumbing, Sacramento CA" });
  });

  it("flags a real phone mismatch between website and Google", async () => {
    // Website fixture says (916) 555-0100; feed Google a different number through a pre-seeded snapshot.
    const repo = new MemoryAuditRepo(audit({ website: "testplumbing.example", gbp: "Test Plumbing" }), business);
    const d = deps(repo);
    const providers = d.providers;
    const { cacheKey } = await import("@/lib/providers/core");
    // Put a fresh snapshot in the store under the exact key the adapter will compute; the cache wins over the fixture.
    const fields = ["id", "displayName", "formattedAddress", "shortFormattedAddress", "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri", "googleMapsUri", "rating", "userRatingCount", "primaryType", "primaryTypeDisplayName", "types", "location", "businessStatus", "addressComponents"];
    const key = cacheKey("google-places", "searchText", { textQuery: "Test Plumbing 1 Main St, Sacramento, CA, 95814", maxResultCount: 5, fieldMask: fields });
    await d.store.save({
      audit_id: null,
      provider: "google-places",
      endpoint: "searchText",
      cache_key: key,
      request: {},
      response: { places: [{ id: "ChIJother", displayName: { text: "Test Plumbing" }, nationalPhoneNumber: "(916) 555-0199", formattedAddress: "1 Main St, Sacramento, CA 95814", websiteUri: "https://testplumbing.example/" }] },
      fetched_at: new Date().toISOString(),
      cost_usd: 0,
      expires_at: null,
    });
    const summary = await runResolveStep(audit({}).id, { repo, providers, ctx: { store: d.store, mode: "mock" } });
    expect(summary.sources.gbp).toBe("ok");
    expect(summary.nap.phone).toBe("mismatch");
    expect(repo.findings.map((f) => f.check_id)).toEqual(["identity_nap.phone_mismatch"]);
    const f = repo.findings[0]!;
    expect(f.evidence_ids).toHaveLength(2);
    const ev = repo.evidence.filter((e) => f.evidence_ids.includes(e.id)).map((e) => e.excerpt);
    expect(ev).toEqual(["your website: (916) 555-0100", "your Google Business Profile: (916) 555-0199"]);
  });
});
