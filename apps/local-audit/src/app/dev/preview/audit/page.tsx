import { AuditDetail } from "@/components/audits/audit-detail";
import { runCrawlStep } from "@/lib/audits/crawl-step";
import { MemoryAuditRepo } from "@/lib/audits/repo";
import { runResolveStep } from "@/lib/audits/resolve-step";
import { DEMO_SITE, fakeFetchFor } from "@/lib/crawl/__fixtures__/demo-site";
import type { Audit, Business, Evidence, Finding, Json } from "@/lib/db/types";
import { createProviders, createWebsiteProvider } from "@/lib/providers";
import { cacheKey, loadFixture, MemorySnapshotStore } from "@/lib/providers/core";

export const dynamic = "force-dynamic";

const AUDIT_ID = "30000000-0000-4000-8000-000000000001";
const BUSINESS_ID = "20000000-0000-4000-8000-000000000001";

const SCENARIOS: Record<string, { inputs: Record<string, unknown>; mode: "mock" | "live"; seedGooglePhone?: string; crawlSite?: typeof DEMO_SITE }> = {
  default: {
    inputs: {
      website: "testplumbing.example",
      gbp: "https://www.google.com/maps/place/Test+Plumbing/@38.5816,-121.4944,17z/data=!3m1!4b1!4m6!3m5!1s0x1:0x2!8m2!3d38.5816!4d-121.4944",
      yelp: "https://www.yelp.com/biz/test-plumbing-sacramento",
      extraUrls: "https://www.facebook.com/testplumbing",
      serviceArea: "Sacramento, CA",
      services: "plumbing, water heaters",
      avgTicket: 300,
    },
    mode: "mock",
  },
  mismatch: { inputs: { website: "testplumbing.example", gbp: "Test Plumbing" }, mode: "mock", seedGooglePhone: "(916) 555-0199" },
  unavailable: { inputs: { gbp: "Test Plumbing, Sacramento CA", website: "testplumbing.example" }, mode: "live" },
  /** Full pipeline on the synthetic flawed site: resolve (Google/Yelp unconfigured → UNAVAILABLE) → crawl → PageSpeed from the fixture → website checks → scores. */
  crawl: { inputs: { website: "https://demo-plumbing.example/", serviceArea: "Sacramento, CA", services: "plumbing, water heaters, drain cleaning", avgTicket: 350 }, mode: "live", crawlSite: DEMO_SITE },
};

/** Runs the real resolve step against fixtures and renders the real detail view. */
export default async function PreviewAudit(props: PageProps<"/dev/preview/audit">) {
  const sp = await props.searchParams;
  const scenario = SCENARIOS[typeof sp.scenario === "string" ? sp.scenario : "default"] ?? SCENARIOS.default!;
  const now = new Date().toISOString();

  const audit: Audit = {
    id: AUDIT_ID,
    business_id: BUSINESS_ID,
    status: "running",
    progress_pct: 5,
    current_step: "start",
    started_at: now,
    finished_at: null,
    total_cost_usd: 0,
    inputs: scenario.inputs as Json,
    scores: {},
    revenue_model: {},
    version: 1,
    created_at: now,
    updated_at: now,
  };
  const business: Business = {
    id: BUSINESS_ID,
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
    created_at: now,
    updated_at: now,
  };

  const repo = new MemoryAuditRepo(audit, business);
  const store = new MemorySnapshotStore();
  if (scenario.seedGooglePhone) {
    const fields = ["id", "displayName", "formattedAddress", "shortFormattedAddress", "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri", "googleMapsUri", "rating", "userRatingCount", "primaryType", "primaryTypeDisplayName", "types", "location", "businessStatus", "addressComponents"];
    await store.save({
      audit_id: null,
      provider: "google-places",
      endpoint: "searchText",
      cache_key: cacheKey("google-places", "searchText", { textQuery: "Test Plumbing 1 Main St, Sacramento, CA, 95814", maxResultCount: 5, fieldMask: fields }),
      request: {},
      response: {
        places: [
          {
            id: "ChIJsynthetic000000000001",
            displayName: { text: "Test Plumbing" },
            nationalPhoneNumber: scenario.seedGooglePhone,
            formattedAddress: "1 Main St, Sacramento, CA 95814, USA",
            websiteUri: "https://testplumbing.example/",
            rating: 4.6,
            userRatingCount: 128,
            primaryTypeDisplayName: { text: "Plumber" },
            location: { latitude: 38.5816, longitude: -121.4944 },
            googleMapsUri: "https://maps.google.com/?cid=synthetic",
          },
        ],
      },
      fetched_at: now,
      cost_usd: 0,
      expires_at: null,
    });
  }

  const providers = scenario.crawlSite ? { ...createProviders({ env: {} }), website: createWebsiteProvider({ fetchImpl: fakeFetchFor(scenario.crawlSite) }) } : createProviders({ env: {} });
  if (scenario.crawlSite) {
    const fx = await loadFixture("pagespeed", "runPagespeed");
    for (const strategy of ["mobile", "desktop"] as const) {
      const request = { url: `${scenario.crawlSite.origin}/`, strategy };
      await store.save({ audit_id: null, provider: "pagespeed", endpoint: "runPagespeed", cache_key: cacheKey("pagespeed", "runPagespeed", request), request, response: fx!.response as Json, fetched_at: now, cost_usd: 0, expires_at: null });
    }
  }
  const summary = await runResolveStep(AUDIT_ID, { repo, providers, ctx: { store, mode: scenario.mode } });
  if (scenario.crawlSite) await runCrawlStep(AUDIT_ID, { repo, providers, ctx: { store, mode: scenario.mode }, crawl: { politeDelayMs: 0, sleep: async () => {} } });
  const resolvedBusiness = { ...business, ...repo.businessPatches.reduce((acc, p) => ({ ...acc, ...p }), {}) } as Business;
  const evidence: Evidence[] = repo.evidence.map((e) => ({ id: e.id, audit_id: AUDIT_ID, type: e.type, excerpt: e.excerpt, source_url: e.source_url ?? null, storage_path: null, captured_at: now }));
  const findings: Finding[] = repo.findings.map((f, i) => ({
    id: `finding-${i + 1}`,
    audit_id: AUDIT_ID,
    category: f.category,
    check_id: f.check_id,
    title: f.title,
    plain_english: f.plain_english,
    severity: f.severity,
    impact_score: f.impact_score,
    fix_difficulty: f.fix_difficulty,
    est_monthly_loss_low: null,
    est_monthly_loss_mid: null,
    est_monthly_loss_high: null,
    evidence_ids: f.evidence_ids,
    status: "open",
    created_at: now,
    updated_at: now,
  }));
  const done: Audit = { ...audit, status: "succeeded", progress_pct: 100, current_step: "done", finished_at: now, total_cost_usd: summary.cost_usd, scores: repo.scores as Json };

  return <AuditDetail audit={done} business={resolvedBusiness} findings={findings} evidence={evidence} />;
}
