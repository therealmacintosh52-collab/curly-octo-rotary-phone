import { describe, expect, it, vi } from "vitest";
import { MemorySnapshotStore } from "./core";
import { createGooglePlacesProvider, PLACES_COST_USD } from "./google-places/client";
import { createWebsiteProvider, WEBSITE_USER_AGENT_TOKEN } from "./website/client";
import { isAllowed, parseRobots } from "./website/robots";
import { createYelpProvider, YELP_COST_USD, yelpAddress } from "./yelp/client";

const live = () => ({ store: new MemorySnapshotStore(), mode: "live" as const });
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

describe("google-places live", () => {
  it("POSTs searchText with key, field mask and location bias, and logs the Pro cost", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => json({ places: [{ id: "ChIJx", displayName: { text: "Test Plumbing" } }] }));
    const p = createGooglePlacesProvider({ env: { GOOGLE_PLACES_API_KEY: "k123" }, fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await p.searchText({ textQuery: "Test Plumbing Sacramento", locationBias: { latitude: 38.5, longitude: -121.4, radiusMeters: 5000 } }, live());
    expect(res.ok && res.data.places[0]!.id).toBe("ChIJx");
    expect(res.ok && res.meta.cost_usd).toBe(PLACES_COST_USD.textSearchPro.usd);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://places.googleapis.com/v1/places:searchText");
    const headers = init!.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("k123");
    expect(headers["x-goog-fieldmask"]).toContain("places.id");
    expect(headers["x-goog-fieldmask"]).not.toContain("reviews");
    expect(JSON.parse(String(init!.body))).toEqual({ textQuery: "Test Plumbing Sacramento", maxResultCount: 5, locationBias: { circle: { center: { latitude: 38.5, longitude: -121.4 }, radius: 5000 } } });
  });

  it("GETs place details and surfaces HTTP errors as UNAVAILABLE", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => (String(url).endsWith("/places/ChIJok") ? json({ id: "ChIJok", displayName: { text: "Ok" } }) : json({ error: { message: "not found" } }, { status: 404 })));
    const p = createGooglePlacesProvider({ env: { GOOGLE_PLACES_API_KEY: "k" }, fetchImpl: fetchImpl as unknown as typeof fetch });
    const ok = await p.getPlace({ placeId: "ChIJok" }, live());
    expect(ok.ok && ok.data.id).toBe("ChIJok");
    expect(ok.ok && ok.meta.cost_usd).toBe(PLACES_COST_USD.placeDetailsPro.usd);
    const missing = await p.getPlace({ placeId: "ChIJmissing" }, live());
    expect(missing).toMatchObject({ ok: false, reason: "http_error", status: 404 });
  });

  it("is not_configured without a key and never calls fetch", async () => {
    const fetchImpl = vi.fn();
    const p = createGooglePlacesProvider({ env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await p.searchText({ textQuery: "x" }, live())).toMatchObject({ ok: false, reason: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("yelp live", () => {
  it("GETs a business with the bearer token and logs the per-call cost", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => json({ id: "y1", alias: "test-plumbing-sacramento", name: "Test Plumbing", location: { display_address: ["1 Main St", "Sacramento, CA 95814"] } }));
    const p = createYelpProvider({ env: { YELP_API_KEY: "ytoken" }, fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await p.getBusiness({ idOrAlias: "test-plumbing-sacramento" }, live());
    expect(res.ok && res.data.name).toBe("Test Plumbing");
    expect(res.ok && yelpAddress(res.data)).toBe("1 Main St, Sacramento, CA 95814");
    expect(res.ok && res.meta.cost_usd).toBe(YELP_COST_USD.perCall.usd);
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://api.yelp.com/v3/businesses/test-plumbing-sacramento");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer ytoken");
  });
});

describe("robots", () => {
  const groups = parseRobots(`
    User-agent: *
    Disallow: /private/
    Allow: /private/ok
    Disallow: /*.pdf$

    User-agent: LocalAuditBot
    Disallow: /no-audit/
  `);
  it("applies the most specific group and longest match", () => {
    expect(isAllowed(groups, WEBSITE_USER_AGENT_TOKEN, "/")).toBe(true);
    expect(isAllowed(groups, WEBSITE_USER_AGENT_TOKEN, "/no-audit/x")).toBe(false);
    // Our specific group wins entirely, so the * rules do not apply to us…
    expect(isAllowed(groups, WEBSITE_USER_AGENT_TOKEN, "/private/x")).toBe(true);
    // …but they do apply to a generic agent.
    expect(isAllowed(groups, "SomeBot", "/private/x")).toBe(false);
    expect(isAllowed(groups, "SomeBot", "/private/ok/1")).toBe(true);
    expect(isAllowed(groups, "SomeBot", "/file.pdf")).toBe(false);
    expect(isAllowed(groups, "SomeBot", "/file.pdfx")).toBe(true);
  });
  it("treats an empty file as allow-all", () => {
    expect(isAllowed(parseRobots(""), WEBSITE_USER_AGENT_TOKEN, "/anything")).toBe(true);
  });
});

describe("website live", () => {
  function fakeSite(routes: Record<string, () => Response>) {
    return vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      const handler = routes[u];
      return handler ? handler() : new Response("nf", { status: 404 });
    }) as unknown as typeof fetch;
  }

  it("resolveCanonical follows the redirect chain and strips www", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = fakeSite({
      "http://www.testplumbing.example/": () => new Response(null, { status: 301, headers: { location: "https://www.testplumbing.example/" } }),
      "https://www.testplumbing.example/": () => new Response(null, { status: 302, headers: { location: "/home" } }),
      "https://www.testplumbing.example/home": () => new Response("<html></html>", { status: 200 }),
    });
    const w = createWebsiteProvider({ fetchImpl });
    const res = await w.resolveCanonical({ url: "http://www.testplumbing.example/" }, live());
    expect(res.ok && res.data).toMatchObject({ canonical_domain: "testplumbing.example", canonical_url: "https://www.testplumbing.example/", https: true, status: 200 });
    expect(res.ok && res.data.redirect_chain).toEqual(["http://www.testplumbing.example/", "https://www.testplumbing.example/", "https://www.testplumbing.example/home"]);
  });

  it("fetchPage honors robots.txt and reports bot walls as blocked", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = fakeSite({
      "https://site.example/robots.txt": () => new Response("User-agent: *\nDisallow: /secret/", { status: 200 }),
      "https://site.example/": () => new Response("<html><body>hi</body></html>", { status: 200, headers: { "content-type": "text/html" } }),
      "https://walled.example/robots.txt": () => new Response("", { status: 404 }),
      "https://walled.example/": () => new Response("blocked", { status: 403 }),
    });
    const w = createWebsiteProvider({ fetchImpl });
    const ok = await w.fetchPage({ url: "https://site.example/" }, live());
    expect(ok.ok && ok.data.html).toContain("hi");
    expect(ok.ok && ok.data.headers?.["content-type"]).toBe("text/html");
    expect(await w.fetchPage({ url: "https://site.example/secret/x" }, live())).toMatchObject({ ok: false, reason: "blocked" });
    expect(await w.fetchPage({ url: "https://walled.example/" }, live())).toMatchObject({ ok: false, reason: "blocked" });
    const sent = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find((c) => c[0] === "https://site.example/")!;
    expect((sent[1].headers as Record<string, string>)["user-agent"]).toContain(WEBSITE_USER_AGENT_TOKEN);
  });

  it("expandShortLink returns the destination without following into it", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = fakeSite({
      "https://maps.app.goo.gl/AbC": () => new Response(null, { status: 302, headers: { location: "https://www.google.com/maps/place/Test+Plumbing/@38.5,-121.4,17z/data=!4m2!3m1!1s0x1:0x2" } }),
      "https://www.google.com/maps/place/Test+Plumbing/@38.5,-121.4,17z/data=!4m2!3m1!1s0x1:0x2": () => new Response("<html>maps</html>", { status: 200 }),
    });
    const w = createWebsiteProvider({ fetchImpl });
    const res = await w.expandShortLink({ url: "https://maps.app.goo.gl/AbC" }, live());
    expect(res.ok && res.data.canonical_url).toContain("/maps/place/Test+Plumbing/");
    expect(res.ok && res.data.redirect_chain).toHaveLength(2);
  });
});
