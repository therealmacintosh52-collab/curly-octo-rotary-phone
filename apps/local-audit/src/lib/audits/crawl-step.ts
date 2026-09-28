import type { CallContext, ProviderResult } from "@/lib/providers/core";
import type { Providers } from "@/lib/providers";
import { summarizePagespeed, type PagespeedResult, type PagespeedSummary } from "@/lib/providers/pagespeed/client";
import { listChecks, runChecks, WEBSITE_CATEGORIES, type CheckCategory, type CheckContext } from "@/lib/checks";
import { crawlSite, summarizeCrawl, type CrawlOptions } from "@/lib/crawl/crawler";
import type { Json } from "@/lib/db/types";
import { parseInputs, type RawInputs } from "@/lib/resolve/inputs";
import { computeScores } from "@/lib/scoring/score";
import type { AuditRepo, FindingRow } from "./repo";

export interface CrawlStepDeps {
  repo: AuditRepo;
  providers: Providers;
  ctx: Omit<CallContext, "auditId">;
  progress?: (pct: number, step: string) => Promise<void>;
  crawl?: CrawlOptions;
}

export type PagespeedOutcome = { status: "ok"; summary: PagespeedSummary } | { status: "unavailable"; reason: string; message: string };

function pagespeedOutcome(r: ProviderResult<PagespeedResult>, strategy: "mobile" | "desktop"): PagespeedOutcome {
  return r.ok ? { status: "ok", summary: summarizePagespeed(r.data, strategy) } : { status: "unavailable", reason: r.reason, message: r.message };
}

/** "Sacramento, CA" from "1 Main St, Sacramento, CA 95814" or "Sacramento, CA 95814, USA"; null when the shape is not recognisable. */
export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = address.match(/,\s*([A-Za-z .'-]+),\s*([A-Z]{2})\b/);
  return m ? `${m[1]!.trim()}, ${m[2]}` : null;
}

/**
 * The Phase 2 pipeline step: crawl the website → PageSpeed (mobile + desktop)
 * → website checks → findings with evidence → category and headline scores.
 * Returns a serializable summary (no HTML) so it can be an Inngest step result.
 */
export async function runCrawlStep(auditId: string, deps: CrawlStepDeps) {
  const { audit, business } = await deps.repo.load(auditId);
  const inputs = parseInputs((audit.inputs ?? {}) as RawInputs);
  const startUrl = business.canonical_domain ? `https://${business.canonical_domain}/` : (inputs.website?.url ?? null);
  const ctx: CallContext = { ...deps.ctx, auditId };

  if (!startUrl) {
    await deps.repo.mergeScores(auditId, { crawl: { status: "skipped", reason: "no website given or resolved" } });
    await deps.progress?.(80, "crawl: skipped (no website)");
    return { status: "skipped" as const, reason: "no website given or resolved", findings: 0, passed: 0, checks_unavailable: 0 };
  }

  await deps.progress?.(52, "crawl: fetching pages");
  const crawl = await crawlSite(startUrl, deps.providers.website, ctx, deps.crawl);
  const crawlSummary = summarizeCrawl(crawl);

  await deps.progress?.(65, "crawl: PageSpeed Insights");
  const psiUrl = crawl.canonicalUrl;
  const [mobileRes, desktopRes] = await Promise.all([deps.providers.pagespeed.run({ url: psiUrl, strategy: "mobile" }, ctx), deps.providers.pagespeed.run({ url: psiUrl, strategy: "desktop" }, ctx)]);
  const pagespeed = { mobile: pagespeedOutcome(mobileRes, "mobile"), desktop: pagespeedOutcome(desktopRes, "desktop") };

  // Evidence for the crawl itself and for every UNAVAILABLE source, so the gaps are on record.
  const gapRows = [
    ...crawl.failures.map((f) => ({ type: "html" as const, excerpt: JSON.stringify({ source: "crawl", status: "UNAVAILABLE", url: f.url, reason: f.reason, message: f.message }), source_url: f.url })),
    ...(["mobile", "desktop"] as const).filter((s) => pagespeed[s].status === "unavailable").map((s) => {
      const o = pagespeed[s] as Extract<PagespeedOutcome, { status: "unavailable" }>;
      return { type: "api_field" as const, excerpt: JSON.stringify({ source: `pagespeed_${s}`, status: "UNAVAILABLE", reason: o.reason, message: o.message }), source_url: psiUrl };
    }),
  ];
  await deps.repo.insertEvidence(auditId, [{ type: "html", excerpt: JSON.stringify({ source: "crawl", ...crawlSummary, pages: crawlSummary.pages.length }), source_url: crawl.canonicalUrl }, ...gapRows]);

  await deps.progress?.(72, "crawl: running website checks");
  const serviceArea = business.service_area && typeof business.service_area === "object" && !Array.isArray(business.service_area) ? (business.service_area as { area?: unknown; services?: unknown }) : {};
  const services = inputs.services.length ? inputs.services : Array.isArray(serviceArea.services) ? serviceArea.services.filter((s): s is string => typeof s === "string") : [];
  const city = cityFromAddress(business.address) ?? inputs.serviceArea ?? (typeof serviceArea.area === "string" ? serviceArea.area : null);
  const checkCtx: CheckContext = {
    audit: { id: auditId },
    business: { name: business.name, canonicalDomain: business.canonical_domain ?? crawl.host, phone: business.phone, address: business.address },
    website: { pages: [], crawl },
    pagespeed: { mobile: pagespeed.mobile.status === "ok" ? pagespeed.mobile.summary : undefined, desktop: pagespeed.desktop.status === "ok" ? pagespeed.desktop.summary : undefined },
    services,
    city,
  };
  const run = await runChecks(
    checkCtx,
    listChecks().filter((c) => WEBSITE_CATEGORIES.includes(c.category)),
  );

  const findingRows: FindingRow[] = [];
  for (const f of run.findings) {
    const ids = await deps.repo.insertEvidence(auditId, f.evidence.map((e) => ({ type: e.type, excerpt: e.excerpt, source_url: e.source_url ?? null })));
    findingRows.push({ check_id: f.check_id, category: f.category, title: f.title, plain_english: f.plain_english, severity: f.severity, impact_score: f.impact_score, fix_difficulty: f.fix_difficulty, evidence_ids: ids });
  }
  await deps.repo.insertFindings(auditId, findingRows);

  // Scores over everything found so far (identity findings from Phase 1 included).
  const all = await deps.repo.listFindings(auditId);
  const priorAssessed = readAssessed(audit.scores);
  const assessed = new Set<CheckCategory>([...priorAssessed, ...run.assessed]);
  const scores = computeScores(all.map((f) => ({ category: f.category as CheckCategory, severity: f.severity })), assessed);

  const psiJson = (o: PagespeedOutcome): Json => (o.status === "ok" ? ({ status: "ok", ...o.summary } as unknown as Json) : { status: "unavailable", reason: o.reason, message: o.message });
  await deps.repo.mergeScores(auditId, {
    crawl: { status: "ok", ...crawlSummary } as unknown as Json,
    pagespeed: { mobile: psiJson(pagespeed.mobile), desktop: psiJson(pagespeed.desktop) },
    checks_website: { phase: 2, ran_at: new Date().toISOString(), passed: run.passed, unavailable: run.unavailable, assessed: run.assessed },
    categories: scores.categories,
    visibility: scores.visibility,
    conversion: scores.conversion,
    assessed: [...assessed],
  });
  await deps.progress?.(80, "crawl: done");

  return {
    status: "ok" as const,
    canonical_url: crawl.canonicalUrl,
    pages_crawled: crawl.pages.length,
    truncated: crawl.truncated,
    pagespeed: { mobile: pagespeed.mobile.status === "ok" ? pagespeed.mobile.summary.performanceScore : `UNAVAILABLE: ${pagespeed.mobile.reason}`, desktop: pagespeed.desktop.status === "ok" ? pagespeed.desktop.summary.performanceScore : `UNAVAILABLE: ${pagespeed.desktop.reason}` },
    findings: findingRows.length,
    passed: run.passed.length,
    checks_unavailable: run.unavailable.length,
    scores: { visibility: scores.visibility, conversion: scores.conversion },
  };
}

function readAssessed(scores: Json): CheckCategory[] {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return [];
  const s = scores as Record<string, Json | undefined>;
  const fromTop = Array.isArray(s.assessed) ? s.assessed : [];
  const checks = s.checks && typeof s.checks === "object" && !Array.isArray(s.checks) ? (s.checks as Record<string, Json | undefined>) : {};
  const fromChecks = Array.isArray(checks.assessed) ? checks.assessed : [];
  return [...fromTop, ...fromChecks].filter((x): x is CheckCategory => typeof x === "string");
}
