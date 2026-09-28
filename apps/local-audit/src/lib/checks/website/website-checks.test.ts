import { beforeAll, describe, expect, it, vi } from "vitest";
import { DEMO_SITE, GOOD_SITE, fakeFetchFor } from "@/lib/crawl/__fixtures__/demo-site";
import { crawlSite, type SiteCrawl } from "@/lib/crawl/crawler";
import { MemorySnapshotStore, loadFixture } from "@/lib/providers/core";
import { summarizePagespeed, type PagespeedResult, type PagespeedSummary } from "@/lib/providers/pagespeed/client";
import { createWebsiteProvider } from "@/lib/providers/website/client";
import { listChecks, runChecks, type CheckCategory, type CheckContext } from "..";
import { type CheckRunResult } from "../run";

const WEBSITE_CATEGORIES: CheckCategory[] = ["technical_seo", "local_onsite", "schema", "aeo", "images", "conversion", "content_keywords"];
const websiteChecks = () => listChecks().filter((c) => WEBSITE_CATEGORIES.includes(c.category));

async function crawl(site: typeof DEMO_SITE): Promise<SiteCrawl> {
  vi.spyOn(console, "info").mockImplementation(() => {});
  const website = createWebsiteProvider({ fetchImpl: fakeFetchFor(site) });
  return crawlSite(`${site.origin}/`, website, { store: new MemorySnapshotStore(), mode: "live" }, { politeDelayMs: 0, sleep: async () => {}, maxPages: 20 });
}

function ctxFor(crawl: SiteCrawl, name: string, pagespeed?: PagespeedSummary): CheckContext {
  return {
    audit: { id: "30000000-0000-4000-8000-000000000001" },
    business: { name, canonicalDomain: new URL(crawl.canonicalUrl).host, phone: "+19165550100", address: "1 Main St, Sacramento, CA 95814" },
    website: { pages: [], crawl },
    pagespeed: pagespeed ? { mobile: pagespeed, desktop: { ...pagespeed, strategy: "desktop", performanceScore: pagespeed.performanceScore === null ? null : Math.min(100, pagespeed.performanceScore + 13) } } : undefined,
    services: ["plumbing", "water heaters", "drain cleaning"],
    city: "Sacramento, CA",
  };
}

const ids = (r: CheckRunResult) => r.findings.map((f) => f.check_id.split(".")[1]!);

describe("website checks on the flawed demo site", () => {
  let result: CheckRunResult;
  let slowPsi: PagespeedSummary;
  beforeAll(async () => {
    const fx = await loadFixture<PagespeedResult>("pagespeed", "runPagespeed");
    slowPsi = summarizePagespeed(fx!.response, "mobile");
    result = await runChecks(ctxFor(await crawl(DEMO_SITE), "Demo Plumbing", slowPsi), websiteChecks());
  });

  it("finds the technical SEO problems", () => {
    expect(ids(result)).toEqual(
      expect.arrayContaining([
        "mixed_content",
        "title_generic",
        "meta_description_missing",
        "h1_multiple",
        "heading_order",
        "canonical_missing",
        "noindex_key_page",
        "sitemap_not_in_robots",
        "sitemap_broken_urls",
        "broken_internal_links",
        "redirect_chains",
        "soft_404",
        "lang_missing",
        "psi_performance_mobile",
        "psi_lcp",
        "psi_cls",
        "psi_ttfb",
        "psi_inp",
        "psi_desktop_gap",
      ]),
    );
  });

  it("finds the local, schema and AEO problems", () => {
    expect(ids(result)).toEqual(
      expect.arrayContaining([
        "phone_in_header",
        "map_embed_missing",
        "hours_missing",
        "service_area_page_missing",
        "city_in_home_title",
        "invalid_json",
        "localbusiness_generic_type",
        "localbusiness_incomplete",
        "self_serving_rating",
        "sameas_missing",
        "service_schema_missing",
        "breadcrumb_schema_missing",
        "entity_statement_missing",
        "faq_content_missing",
        "ai_crawlers_blocked",
        "llms_txt_missing",
      ]),
    );
  });

  it("finds the image, conversion and content problems", () => {
    expect(ids(result)).toEqual(
      expect.arrayContaining([
        "alt_missing",
        "generic_filenames",
        "oversized_files",
        "phone_above_fold",
        "form_too_long",
        "social_proof_missing",
        "trust_badges_missing",
        "pricing_transparency",
        "mobile_tap_targets",
        "mobile_horizontal_scroll",
        "slow_mobile_bounce",
        "no_analytics",
        "thin_pages",
        "copyright_outdated",
        "stale_content",
        "keyword_stuffed_title",
      ]),
    );
  });

  it("does not report what the demo site gets right, and never guesses without data", () => {
    expect(ids(result)).not.toContain("https_missing");
    expect(ids(result)).not.toContain("viewport_missing");
    expect(ids(result)).not.toContain("robots_txt_missing");
    expect(ids(result)).not.toContain("sitemap_missing");
    expect(ids(result)).not.toContain("contact_page_missing");
    expect(ids(result)).not.toContain("localbusiness_missing");
    // No FAQ-style content on the demo site, so the FAQ schema check cannot judge it: unavailable, not a finding.
    expect(result.unavailable.map((u) => u.check_id)).toContain("schema.faq_schema_missing");
    expect(ids(result)).not.toContain("faq_schema_missing");
    // Every finding carries evidence pointing at a crawled URL.
    for (const f of result.findings) {
      expect(f.evidence.length, f.check_id).toBeGreaterThan(0);
      expect(f.evidence[0]!.excerpt.length, f.check_id).toBeGreaterThan(0);
    }
    // Findings come in all seven website categories.
    expect(new Set(result.findings.map((f) => f.category))).toEqual(new Set(WEBSITE_CATEGORIES));
    expect(result.findings.length).toBeGreaterThanOrEqual(50);
  });

  it("marks PageSpeed-driven checks unavailable when no PageSpeed data exists", async () => {
    const r = await runChecks(ctxFor(await crawl(DEMO_SITE), "Demo Plumbing"), websiteChecks());
    const un = r.unavailable.map((u) => u.check_id.split(".")[1]);
    expect(un).toEqual(expect.arrayContaining(["psi_performance_mobile", "psi_lcp", "mobile_tap_targets", "slow_mobile_bounce"]));
    expect(ids(r)).not.toContain("psi_lcp");
  });
});

describe("website checks on the clean site", () => {
  it("produces no findings", async () => {
    const fx = await loadFixture<PagespeedResult>("pagespeed", "runPagespeed");
    const fast: PagespeedSummary = { ...summarizePagespeed(fx!.response, "mobile"), performanceScore: 94, lab: { lcpMs: 1800, clsScore: 0.02, tbtMs: 80, ttfbMs: 300, speedIndexMs: 2000, fcpMs: 1200 }, field: { lcpMs: 1900, inpMs: 120, cls: 0.03, ttfbMs: 400, overall: "FAST" }, usability: { tapTargets: 1, fontSize: 1, contentWidth: 1 }, opportunities: [] };
    const r = await runChecks(ctxFor(await crawl(GOOD_SITE), "Good Plumbing", fast), websiteChecks());
    expect(ids(r)).toEqual([]);
    expect(r.passed.length).toBeGreaterThan(60);
  });

  it("returns unavailable for every check when nothing was crawled", async () => {
    const r = await runChecks({ audit: { id: "x" }, business: { name: "x", canonicalDomain: null, phone: null, address: null } }, websiteChecks());
    expect(r.findings).toEqual([]);
    expect(r.passed).toEqual([]);
    expect(r.unavailable.length).toBe(websiteChecks().length);
  });
});
