import type { SiteCrawl } from "@/lib/crawl/crawler";
import type { PageAnalysis, PageKind } from "@/lib/crawl/page-analysis";
import type { FindingSeverity, FixDifficulty } from "@/lib/db/types";
import { registerCheck, type Check, type CheckCategory, type CheckContext, type CheckOutcome, type EvidenceInput } from "../registry";

/**
 * Compact way to declare a site check. `run` gets the crawl and returns
 * "pass", `{ unavailable }`, or a finding body; severity/impact/fix come
 * from the spec unless the finding overrides them.
 */
export type Verdict =
  | "pass"
  | { unavailable: string }
  | { plain_english: string; evidence: EvidenceInput[]; title?: string; severity?: FindingSeverity; impact_score?: number; fix_difficulty?: FixDifficulty };

export interface SiteCheckSpec {
  id: string;
  category: CheckCategory;
  /** What the check verifies (registry / pass list). */
  title: string;
  /** The finding's headline when the check fails: the problem, stated plainly. */
  problem: string;
  description: string;
  severity: FindingSeverity;
  impact: number;
  fix: FixDifficulty;
  run(site: SiteCrawl, ctx: CheckContext): Verdict;
}

export function siteCheck(spec: SiteCheckSpec): Check {
  return registerCheck({
    id: `${spec.category}.${spec.id}`,
    category: spec.category,
    title: spec.title,
    description: spec.description,
    problem: spec.problem,
    run(ctx): CheckOutcome {
      const site = ctx.website?.crawl;
      if (!site) return { status: "unavailable", reason: "website was not crawled" };
      if (!site.pages.length) return { status: "unavailable", reason: site.failures[0] ? `no page could be fetched (${site.failures[0].reason}: ${site.failures[0].message})` : "no page could be fetched" };
      const v = spec.run(site, ctx);
      if (v === "pass") return { status: "pass" };
      if ("unavailable" in v) return { status: "unavailable", reason: v.unavailable };
      return {
        status: "finding",
        title: v.title ?? spec.problem,
        plain_english: v.plain_english,
        severity: v.severity ?? spec.severity,
        impact_score: v.impact_score ?? spec.impact,
        fix_difficulty: v.fix_difficulty ?? spec.fix,
        evidence: v.evidence,
      };
    },
  });
}

export const ev = (excerpt: string, source_url?: string, type: EvidenceInput["type"] = "html"): EvidenceInput => ({ type, excerpt: excerpt.slice(0, 500), source_url });

export function home(site: SiteCrawl): PageAnalysis {
  return site.pages[0]!;
}
export function kindOf(site: SiteCrawl, p: PageAnalysis): PageKind {
  return site.kinds[p.finalUrl] ?? "other";
}
export function pagesOfKind(site: SiteCrawl, ...kinds: PageKind[]): PageAnalysis[] {
  return site.pages.filter((p) => kinds.includes(kindOf(site, p)));
}
/** Pages that matter for indexing and conversion: everything but legal boilerplate. */
export function keyPages(site: SiteCrawl): PageAnalysis[] {
  return site.pages.filter((p) => kindOf(site, p) !== "legal");
}
export function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}
export function listUrls(pages: PageAnalysis[], max = 5): string {
  const urls = pages.map((p) => shortUrl(p.finalUrl));
  return urls.slice(0, max).join(", ") + (urls.length > max ? ` and ${urls.length - max} more` : "");
}
export function shortUrl(u: string): string {
  try {
    const x = new URL(u);
    return x.pathname === "/" && !x.search ? x.host : x.pathname + x.search;
  } catch {
    return u;
  }
}
export function cityTokens(ctx: CheckContext): string[] {
  const out = new Set<string>();
  const add = (s: string | null | undefined) => {
    if (!s) return;
    // "Sacramento, CA 95814" → sacramento ; "Elk Grove, CA" → elk grove
    const m = s.match(/([A-Za-z][A-Za-z .'-]+?),\s*[A-Z]{2}\b/);
    if (m) out.add(m[1]!.trim().toLowerCase());
    else if (s.length < 40) out.add(s.split(",")[0]!.trim().toLowerCase());
  };
  add(ctx.city ?? null);
  add(ctx.business.address);
  return [...out].filter((c) => c.length >= 3 && !/^\d/.test(c));
}
export function mentionsAny(text: string, tokens: string[]): string | null {
  const t = text.toLowerCase();
  return tokens.find((tok) => t.includes(tok)) ?? null;
}
export function serviceTokens(ctx: CheckContext): string[] {
  return (ctx.services ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
}

/** True when every word of the service (singular or plural) appears in the haystack. "water heaters" matches "Water Heater Repair". */
export function mentionsService(haystack: string, service: string): boolean {
  const h = haystack.toLowerCase();
  const stem = (w: string) => w.replace(/(ies|es|s)$/, (m) => (m === "ies" ? "i" : ""));
  const words = service.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return words.length > 0 && words.every((w) => h.includes(stem(w)));
}

const AI_AGENT_LABELS: Record<string, string> = {
  gptbot: "ChatGPT",
  "chatgpt-user": "ChatGPT",
  "oai-searchbot": "ChatGPT search",
  claudebot: "Claude",
  "anthropic-ai": "Claude",
  perplexitybot: "Perplexity",
  "google-extended": "Google Gemini",
  "applebot-extended": "Apple Intelligence",
  ccbot: "Common Crawl (used to train many assistants)",
  bytespider: "TikTok's assistant",
  amazonbot: "Amazon Alexa",
  "meta-externalagent": "Meta AI",
};
/** "ChatGPT, Claude and Perplexity" from robots.txt agent tokens. */
export function aiAgentNames(agents: string[]): string {
  const names = [...new Set(agents.map((a) => AI_AGENT_LABELS[a.toLowerCase()] ?? a))];
  return names.length <= 1 ? (names[0] ?? "AI assistants") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const OPPORTUNITY_LABELS: Record<string, string> = {
  "render-blocking-resources": "files that stop the page from drawing until they finish loading",
  "modern-image-formats": "pictures saved in old, heavy formats",
  "uses-optimized-images": "pictures that are not compressed",
  "uses-responsive-images": "pictures far larger than the space they fill",
  "offscreen-images": "pictures loading before anyone scrolls to them",
  "server-response-time": "a slow web server",
  "total-byte-weight": "too much to download",
  "unused-javascript": "add-on code that is loaded but never used",
  "unused-css-rules": "styling that is loaded but never used",
  "uses-text-compression": "files sent uncompressed",
  "uses-long-cache-ttl": "files that visitors have to download again on every visit",
  "unminified-javascript": "add-on code that was never shrunk",
  "unminified-css": "styling that was never shrunk",
  "third-party-summary": "outside widgets and trackers",
  "largest-contentful-paint-element": "a slow main image or headline",
  "font-display": "fonts that hide the text until they load",
};
/** Lighthouse opportunity id → words a business owner understands. */
export function describeOpportunity(id: string): string {
  return OPPORTUNITY_LABELS[id] ?? id.replace(/-/g, " ");
}

/** "1 page" / "3 pages" / "2 page names": counts read as a sentence, never "page(s)". */
export function count(n: number, noun: string, plural = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : plural}`;
}

/** The city as the business wrote it ("Sacramento"), for display; `cityTokens` is for matching. */
export function cityLabel(ctx: CheckContext): string | null {
  for (const s of [ctx.city, ctx.business.address]) {
    if (!s) continue;
    const m = s.match(/([A-Za-z][A-Za-z .'-]+?),\s*[A-Z]{2}\b/);
    if (m) return m[1]!.trim();
    if (s.length < 40) return s.split(",")[0]!.trim();
  }
  return null;
}

/** Verb agreement after a count: v(1, "are") → "is", v(3, "have") → "have", v(1, "carry") → "carries". */
export function v(n: number, plural: string): string {
  if (n !== 1) return plural;
  const irregular: Record<string, string> = { are: "is", have: "has", do: "does" };
  if (irregular[plural]) return irregular[plural]!;
  if (/[^aeiou]y$/.test(plural)) return `${plural.slice(0, -1)}ies`;
  if (/(s|sh|ch|x|z|o)$/.test(plural)) return `${plural}es`;
  return `${plural}s`;
}
