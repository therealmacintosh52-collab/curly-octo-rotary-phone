import { describe, expect, it, vi } from "vitest";
import { DEMO_SITE, fakeFetchFor } from "@/lib/crawl/__fixtures__/demo-site";
import { crawlSite } from "@/lib/crawl/crawler";
import { MemorySnapshotStore, loadFixture } from "@/lib/providers/core";
import { summarizePagespeed, type PagespeedResult } from "@/lib/providers/pagespeed/client";
import { createWebsiteProvider } from "@/lib/providers/website/client";
import { listChecks, runChecks, type CheckContext } from "@/lib/checks";
import { findJargon, sectionStatus, scoreWord } from "./customer-language";

const agreement = (field: "name" | "phone" | "address", a: string, b: string) => ({ field, status: "mismatch" as const, values: [{ source: "website" as const, raw: a, normalized: a }, { source: "gbp" as const, raw: b, normalized: b }] });

describe("customer language", () => {
  it("every check headline reads without jargon", () => {
    const offenders = listChecks()
      .filter((c) => c.problem)
      .map((c) => [c.id, findJargon(c.problem!)] as const)
      .filter(([, j]) => j.length);
    expect(offenders).toEqual([]);
  });

  it("every finding the demo site and a mismatched identity produce reads without jargon and without fix instructions", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const website = createWebsiteProvider({ fetchImpl: fakeFetchFor(DEMO_SITE) });
    const crawl = await crawlSite(`${DEMO_SITE.origin}/`, website, { store: new MemorySnapshotStore(), mode: "live" }, { politeDelayMs: 0, sleep: async () => {}, maxPages: 20 });
    const fx = await loadFixture<PagespeedResult>("pagespeed", "runPagespeed");
    const psi = summarizePagespeed(fx!.response, "mobile");
    const ctx: CheckContext = {
      audit: { id: "a" },
      business: { name: "Demo Plumbing", canonicalDomain: "demo-plumbing.example", phone: "+19165550100", address: "1 Main St, Sacramento, CA 95814" },
      website: { pages: [{ url: crawl.canonicalUrl, final_url: crawl.canonicalUrl, status: 200, html: "<html><body>Call 916-555-0100</body></html>", fetched_at: "", redirect_chain: [], content_type: "text/html", blocked_by_robots: false } as never], crawl },
      pagespeed: { mobile: psi, desktop: { ...psi, strategy: "desktop", performanceScore: 55 } },
      services: ["plumbing", "water heaters"],
      city: "Sacramento, CA",
      identity: {
        comparison: { name: agreement("name", "Demo Plumbing", "Demo Plumbing Inc"), phone: agreement("phone", "+19165550100", "+19165550199"), address: agreement("address", "1 Main St", "1 Main Street Ste 2") },
        gbpInputGiven: true,
        gbpFound: true,
        gbpWebsiteHost: "old-demo.example",
        canonicalDomain: "demo-plumbing.example",
        websiteFetched: true,
        websitePhones: [],
        websiteAddresses: [],
      },
    };
    const r = await runChecks(ctx);
    expect(r.findings.length).toBeGreaterThan(60);
    const offenders = r.findings.map((f) => [f.check_id, findJargon(`${f.title} ${f.plain_english}`)] as const).filter(([, j]) => j.length);
    expect(offenders).toEqual([]);
    // Fixes belong in the vault, never in the problem text.
    const fixWords = /\b(add|remove|install|replace|embed|resize|cut to|use the|set up|put the|export as|link straight)\b/i;
    const fixers = r.findings.filter((f) => fixWords.test(f.plain_english)).map((f) => [f.check_id, f.plain_english]);
    expect(fixers).toEqual([]);
  });

  it("maps findings to words a customer understands", () => {
    expect(sectionStatus([{ severity: "high" }], true)).toBe("urgent");
    expect(sectionStatus([{ severity: "low" }], true)).toBe("attention");
    expect(sectionStatus([], true)).toBe("good");
    expect(sectionStatus([], false)).toBe("not_checked");
    expect(scoreWord(85)).toBe("Strong");
    expect(scoreWord(37)).toBe("Losing customers");
    expect(scoreWord(null)).toBe("Not scored yet");
  });
});
