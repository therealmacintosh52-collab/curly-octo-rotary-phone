import { describe, expect, it } from "vitest";
import { createProviders, providerStatus } from "./index";
import { MemorySnapshotStore } from "./core";

describe("providerStatus", () => {
  it("lists every provider with boolean env flags and never a value", () => {
    const rows = providerStatus({ ANTHROPIC_API_KEY: "sk-secret-value", PROVIDER_MODE: "mock" });
    const names = rows.map((r) => r.name);
    expect(names).toEqual(["supabase", "inngest", "anthropic", "google-places", "pagespeed", "dataforseo", "yelp", "social", "website"]);
    const anthropic = rows.find((r) => r.name === "anthropic")!;
    expect(anthropic.configured).toBe(true);
    expect(anthropic.envKeys).toEqual([{ key: "ANTHROPIC_API_KEY", set: true }]);
    expect(JSON.stringify(rows)).not.toContain("sk-secret-value");
    expect(rows.every((r) => r.mode === "mock")).toBe(true);
  });

  it("marks providers without env as not configured, except the keyless ones", () => {
    const rows = providerStatus({});
    expect(rows.find((r) => r.name === "dataforseo")!.configured).toBe(false);
    expect(rows.find((r) => r.name === "social")!.configured).toBe(true);
    expect(rows.find((r) => r.name === "website")!.configured).toBe(true);
  });
});

describe("stub adapters", () => {
  it("serve their fixtures in mock mode; stubs say not_implemented live", async () => {
    const p = createProviders({ env: { GOOGLE_PLACES_API_KEY: "k", GOOGLE_PAGESPEED_API_KEY: "k", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p", YELP_API_KEY: "y" } });
    const mock = () => ({ store: new MemorySnapshotStore(), mode: "mock" as const });
    const liveCtx = () => ({ store: new MemorySnapshotStore(), mode: "live" as const });

    const places = await p.googlePlaces.searchText({ textQuery: "Test Plumbing Sacramento CA" }, mock());
    expect(places.ok && places.data.places[0]!.displayName?.text).toBe("Test Plumbing");

    const psi = await p.pagespeed.run({ url: "https://testplumbing.example/", strategy: "mobile" }, mock());
    expect(psi.ok && psi.data.lighthouseResult?.categories?.performance?.score).toBe(0.42);

    const serp = await p.dataforseo.serp.googleOrganic({ keyword: "plumber sacramento" }, mock());
    expect(serp.ok && serp.data.tasks[0]!.cost).toBe(0.002);
    const backlinks = await p.dataforseo.backlinks.summary({ target: "testplumbing.example" }, mock());
    expect(backlinks.ok && backlinks.data.tasks[0]!.result![0]!.referring_domains).toBe(38);
    const llm = await p.dataforseo.aiOptimization.llmResponses({ llm: "chatgpt", prompt: "Best plumber in Sacramento" }, mock());
    expect(llm.ok).toBe(true);
    expect(await p.dataforseo.backlinks.summary({ target: "x" }, liveCtx())).toMatchObject({ ok: false, reason: "not_implemented" });

    const yelp = await p.yelp.getBusiness({ idOrAlias: "test-plumbing-sacramento" }, mock());
    expect(yelp.ok && yelp.data.review_count).toBe(87);

    const social = await p.social.profilePresence({ network: "facebook", urlOrHandle: "https://www.facebook.com/testplumbing" }, mock());
    expect(social.ok && social.data.exists).toBe(true);

    const page = await p.website.fetchPage({ url: "https://testplumbing.example/" }, mock());
    expect(page.ok && page.data.html).toContain("tel:+19165550100");
    const canon = await p.website.resolveCanonical({ url: "http://www.testplumbing.example" }, mock());
    expect(canon.ok && canon.data.canonical_domain).toBe("testplumbing.example");
  });
});
