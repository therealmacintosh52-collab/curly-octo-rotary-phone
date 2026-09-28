import { describe, expect, it, vi } from "vitest";
import { MemorySnapshotStore } from "@/lib/providers/core";
import { createWebsiteProvider } from "@/lib/providers/website/client";
import { DEMO_SITE, GOOD_SITE, fakeFetchFor } from "./__fixtures__/demo-site";
import { crawlSite, summarizeCrawl } from "./crawler";
import { analyzePage, classifyPath } from "./page-analysis";

const noWait = { politeDelayMs: 0, sleep: async () => {} };

function crawler(site: typeof DEMO_SITE) {
  vi.spyOn(console, "info").mockImplementation(() => {});
  const website = createWebsiteProvider({ fetchImpl: fakeFetchFor(site) });
  return { website, ctx: { store: new MemorySnapshotStore(), mode: "live" as const } };
}

describe("analyzePage", () => {
  it("extracts the facts the checks need", () => {
    const html = DEMO_SITE.routes["/"]!.body!;
    const p = analyzePage(html, { url: "https://demo-plumbing.example/" });
    expect(p.title).toBe("Home");
    expect(p.metaDescription).toBeNull();
    expect(p.h1s).toEqual(["Welcome", "Demo Plumbing"]);
    expect(p.headings.map((h) => h.level)).toEqual([1, 1, 3]);
    expect(p.images).toHaveLength(3);
    expect(p.images[0]!.alt).toBeNull();
    expect(p.mixedContent).toEqual(["http://demo-plumbing.example/badge.png"]);
    expect(p.jsonLd).toHaveLength(2);
    expect(p.jsonLd[0]!.types).toEqual(["LocalBusiness"]);
    expect(p.jsonLd[1]!.error).toBeTruthy();
    expect(p.telLinks).toEqual([]);
    expect(p.phones).toEqual(["+19165550100"]);
    expect(p.copyrightYear).toBe(2021);
    expect(p.lang).toBeNull();
    expect(p.viewport).toContain("width=device-width");
    expect(p.links.filter((l) => l.internal).map((l) => new URL(l.href).pathname)).toContain("/services");
    expect(p.links.find((l) => l.href.endsWith("/services"))!.region).toBe("nav");
    expect(p.scripts.external).toBe(2);
  });
  it("reads the good page's structured data, forms and trust phrases", () => {
    const p = analyzePage(GOOD_SITE.routes["/contact"]!.body!, { url: "https://good-plumbing.example/contact" });
    expect(p.forms[0]).toMatchObject({ fields: 3, hasPhoneField: true, hasTextarea: true });
    expect(p.telLinks).toContain("+19165550100");
    expect(p.hasAddressTag).toBe(true);
    expect(p.hasMapEmbed).toBe(true);
    expect(p.trustPhrases).toEqual(expect.arrayContaining(["licensed", "insured", "license number"]));
    expect(p.hoursMentioned).toBe(true);
    expect(p.ctaAboveFold).toContain("get a free quote");
  });
  it("classifies paths", () => {
    expect(classifyPath("https://x.example/")).toBe("home");
    expect(classifyPath("https://x.example/contact-us/")).toBe("contact");
    expect(classifyPath("https://x.example/services/water-heaters")).toBe("service");
    expect(classifyPath("https://x.example/service-areas")).toBe("location");
    expect(classifyPath("https://x.example/blog/2024/tips")).toBe("blog");
    expect(classifyPath("https://x.example/privacy-policy")).toBe("legal");
  });
});

describe("crawlSite on the flawed demo site", () => {
  it("crawls same-host pages, reads robots and sitemap, probes links and images, detects the soft 404", async () => {
    const { website, ctx } = crawler(DEMO_SITE);
    const c = await crawlSite("https://demo-plumbing.example/", website, ctx, { ...noWait, maxPages: 20 });
    const paths = c.pages.map((p) => new URL(p.finalUrl).pathname).sort();
    expect(paths).toEqual(["/", "/about", "/blog/old-post", "/contact", "/services", "/services/drain-cleaning", "/services/water-heaters"].sort());
    expect(c.robots.status).toBe("ok");
    expect(c.robots.blockedAgents).toEqual(expect.arrayContaining(["gptbot", "claudebot"]));
    expect(c.robots.blocksAll).toBe(false);
    expect(c.sitemap.status).toBe("ok");
    expect(c.sitemap.urls).toHaveLength(3);
    expect(c.sitemap.brokenSample).toEqual([{ url: "https://demo-plumbing.example/gone-forever", status: 404 }]);
    expect(c.llmsTxt.status).toBe("missing");
    expect(c.softNotFound.isSoft404).toBe(true);
    const broken = c.linkProbes.find((l) => l.url.endsWith("/broken"));
    expect(broken?.status).toBe(404);
    expect(broken?.foundOn.length).toBeGreaterThan(0);
    const chain = c.linkProbes.find((l) => l.url.endsWith("/old-page"));
    expect(chain?.redirectChain).toHaveLength(3);
    expect(c.imageProbes.find((i) => i.src.endsWith("/hero.jpg"))?.bytes).toBe(1_850_000);
    expect(c.failures).toEqual([]);
    const s = summarizeCrawl(c);
    expect(s.pages_crawled).toBe(7);
    expect(s.broken_links).toBe(2); // the linked /broken page and the sitemap-only /gone-forever
  });

  it("stores every fetched page as a snapshot (the raw evidence)", async () => {
    const { website, ctx } = crawler(DEMO_SITE);
    await crawlSite("https://demo-plumbing.example/", website, ctx, { ...noWait, maxPages: 3 });
    const store = ctx.store as MemorySnapshotStore;
    expect(store.rows.filter((r) => r.endpoint === "fetchPage").length).toBeGreaterThanOrEqual(3);
  });

  it("respects maxPages and reports truncation", async () => {
    const { website, ctx } = crawler(DEMO_SITE);
    const c = await crawlSite("https://demo-plumbing.example/", website, ctx, { ...noWait, maxPages: 2 });
    expect(c.pages).toHaveLength(2);
    expect(c.truncated).toBe(true);
    // Home first, then the contact page: high-value kinds jump the queue.
    expect(c.pages.map((p) => new URL(p.finalUrl).pathname)).toEqual(["/", "/contact"]);
  });
});

describe("crawlSite on the clean site", () => {
  it("finds llms.txt, a referenced sitemap, a real 404 and no broken links", async () => {
    const { website, ctx } = crawler(GOOD_SITE);
    const c = await crawlSite("https://good-plumbing.example/", website, ctx, noWait);
    expect(c.pages.length).toBeGreaterThanOrEqual(8);
    expect(c.robots.sitemaps).toEqual(["https://good-plumbing.example/sitemap.xml"]);
    expect(c.llmsTxt.status).toBe("present");
    expect(c.softNotFound.isSoft404).toBe(false);
    expect(c.linkProbes.filter((l) => l.status >= 400)).toEqual([]);
    expect(c.robots.blockedAgents).toEqual([]);
  });
});
