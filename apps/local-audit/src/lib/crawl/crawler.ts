import type { CallContext } from "@/lib/providers/core";
import type { createWebsiteProvider } from "@/lib/providers/website/client";
import { isAllowed, parseRobots, type RobotsGroup } from "@/lib/providers/website/robots";
import { analyzePage, classifyPath, type PageAnalysis, type PageKind } from "./page-analysis";

export type WebsiteProvider = ReturnType<typeof createWebsiteProvider>;

export interface CrawlOptions {
  maxPages?: number;
  /** Internal links to probe for status (HEAD). */
  maxLinkProbes?: number;
  /** Images to probe for byte size (HEAD). */
  maxImageProbes?: number;
  /** Minimum delay between fetches to the same host, in ms. */
  politeDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RobotsInfo {
  status: "ok" | "missing" | "unavailable";
  text: string | null;
  groups: RobotsGroup[];
  sitemaps: string[];
  /** Crawlers that are disallowed from "/" (or the whole site) by name. */
  blockedAgents: string[];
  blocksAll: boolean;
}

export interface SitemapInfo {
  status: "ok" | "missing" | "unavailable" | "invalid";
  url: string | null;
  urls: string[];
  /** Sitemap URLs that answered 4xx/5xx when probed (sampled). */
  brokenSample: { url: string; status: number }[];
}

export interface LinkProbe {
  url: string;
  status: number;
  redirectChain: string[];
  foundOn: string[];
}

export interface ImageProbe {
  src: string;
  bytes: number | null;
  contentType: string | null;
  foundOn: string;
}

export interface SiteCrawl {
  startUrl: string;
  canonicalUrl: string;
  host: string;
  https: boolean;
  pages: PageAnalysis[];
  kinds: Record<string, PageKind>;
  robots: RobotsInfo;
  sitemap: SitemapInfo;
  llmsTxt: { status: "present" | "missing" | "unavailable" };
  softNotFound: { probedPath: string; status: number | null; isSoft404: boolean | null };
  linkProbes: LinkProbe[];
  imageProbes: ImageProbe[];
  /** Pages the crawler could not fetch, with the provider's reason. */
  failures: { url: string; reason: string; message: string }[];
  discovered: number;
  truncated: boolean;
  fetchedAt: string;
}

const AI_AGENTS = ["gptbot", "chatgpt-user", "oai-searchbot", "claudebot", "anthropic-ai", "perplexitybot", "google-extended", "applebot-extended", "ccbot", "bytespider", "amazonbot", "meta-externalagent"];
const PRIORITY: PageKind[] = ["home", "contact", "service", "about", "location", "pricing", "reviews", "faq", "blog", "other", "legal"];
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|css|js|json|xml|zip|mp4|mp3|webm|woff2?|ttf|eot|txt)(\?|$)/i;

function normalizeCrawlUrl(href: string): string | null {
  try {
    const u = new URL(href);
    u.hash = "";
    // Drop tracking noise so the same page is not crawled twice.
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    if (SKIP_EXT.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function parseSitemapXml(xml: string): { urls: string[]; children: string[] } {
  const urls = [...xml.matchAll(/<url>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
  const children = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
  return { urls, children };
}

/**
 * Crawls one site through the website provider. Same-host only, polite,
 * robots.txt respected (the provider enforces it per fetch too), bounded by
 * maxPages with high-value page kinds first. Never bypasses a bot wall: a
 * blocked page is a failure with reason "blocked", which becomes a finding.
 */
export async function crawlSite(startUrl: string, website: WebsiteProvider, ctx: CallContext, opts: CrawlOptions = {}): Promise<SiteCrawl> {
  const maxPages = opts.maxPages ?? 50;
  const maxLinkProbes = opts.maxLinkProbes ?? 40;
  const maxImageProbes = opts.maxImageProbes ?? 12;
  const politeDelayMs = opts.politeDelayMs ?? 500;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const noStore = { ...ctx };

  const start = new URL(startUrl);
  const host = start.hostname.replace(/^www\./, "");
  const origin = start.origin;
  const sameHost = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "") === host;
    } catch {
      return false;
    }
  };

  let lastFetch = 0;
  const polite = async () => {
    const wait = lastFetch + politeDelayMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastFetch = Date.now();
  };

  // robots.txt
  const robots: RobotsInfo = { status: "missing", text: null, groups: [], sitemaps: [], blockedAgents: [], blocksAll: false };
  await polite();
  const robotsRes = await website.fetchPage({ url: `${origin}/robots.txt` }, noStore);
  if (robotsRes.ok && robotsRes.data.status === 200 && !/^\s*<(!doctype|html)/i.test(robotsRes.data.html)) {
    robots.status = "ok";
    robots.text = robotsRes.data.html;
    robots.groups = parseRobots(robotsRes.data.html);
    robots.sitemaps = [...robotsRes.data.html.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]!);
    robots.blocksAll = !isAllowed(robots.groups, "SomeGenericCrawler", "/");
    robots.blockedAgents = AI_AGENTS.filter((a) => !isAllowed(robots.groups, a, "/") && !robots.blocksAll);
  } else if (!robotsRes.ok && robotsRes.reason !== "http_error") {
    robots.status = "unavailable";
  }

  // sitemap.xml (from robots or the default location; one level of index nesting)
  const sitemap: SitemapInfo = { status: "missing", url: null, urls: [], brokenSample: [] };
  const sitemapCandidates = robots.sitemaps.length ? robots.sitemaps : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  for (const candidate of sitemapCandidates) {
    await polite();
    const res = await website.fetchPage({ url: candidate }, noStore);
    if (!res.ok) {
      if (res.reason !== "http_error") sitemap.status = "unavailable";
      continue;
    }
    if (!/<urlset|<sitemapindex/i.test(res.data.html)) {
      sitemap.status = "invalid";
      sitemap.url = candidate;
      continue;
    }
    sitemap.status = "ok";
    sitemap.url = candidate;
    const { urls, children } = parseSitemapXml(res.data.html);
    sitemap.urls.push(...urls);
    for (const child of children.slice(0, 5)) {
      await polite();
      const c = await website.fetchPage({ url: child }, noStore);
      if (c.ok) sitemap.urls.push(...parseSitemapXml(c.data.html).urls);
    }
    break;
  }

  // llms.txt
  await polite();
  const llms = await website.fetchPage({ url: `${origin}/llms.txt` }, noStore);
  const llmsTxt: SiteCrawl["llmsTxt"] = { status: llms.ok && llms.data.status === 200 && !/^\s*<(!doctype|html)/i.test(llms.data.html) ? "present" : !llms.ok && llms.reason !== "http_error" ? "unavailable" : "missing" };

  // Crawl
  const pages: PageAnalysis[] = [];
  const kinds: Record<string, PageKind> = {};
  const failures: SiteCrawl["failures"] = [];
  const seen = new Set<string>();
  const queue: { url: string; kind: PageKind; depth: number }[] = [];
  const enqueue = (url: string, depth: number) => {
    const n = normalizeCrawlUrl(url);
    if (!n || seen.has(n) || !sameHost(n)) return;
    if (robots.status === "ok" && !isAllowed(robots.groups, "LocalAuditBot", new URL(n).pathname)) return;
    seen.add(n);
    queue.push({ url: n, kind: classifyPath(n), depth });
    queue.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || a.depth - b.depth);
  };
  enqueue(start.toString(), 0);
  for (const u of sitemap.urls.slice(0, 200)) enqueue(u, 1);

  const outgoing = new Map<string, Set<string>>(); // internal link → pages linking to it
  const linkProbes: LinkProbe[] = [];
  const foundOn = (u: string) => [...(outgoing.get(u) ?? [])];
  let canonicalUrl = start.toString();
  let httpsSeen = start.protocol === "https:";

  while (queue.length && pages.length < maxPages) {
    const next = queue.shift()!;
    await polite();
    const res = await website.fetchPage({ url: next.url }, ctx);
    if (!res.ok) {
      if (res.reason === "http_error" && res.status) {
        // A linked page that answers 4xx/5xx is a broken link, not a crawl failure.
        linkProbes.push({ url: next.url, status: res.status, redirectChain: [next.url], foundOn: foundOn(next.url) });
        continue;
      }
      failures.push({ url: next.url, reason: res.reason, message: res.message });
      if (res.reason === "blocked" && pages.length === 0) break; // walled site: stop, report
      continue;
    }
    if (res.data.final_url !== next.url) {
      // Redirected: record the exact chain (cheap HEAD walk) and do not analyze the same destination twice.
      const chain = await website.probe({ url: next.url }, ctx);
      linkProbes.push({ url: next.url, status: 301, redirectChain: chain.ok ? chain.data.redirect_chain : [next.url, res.data.final_url], foundOn: foundOn(next.url) });
      if (pages.some((p) => p.finalUrl === res.data.final_url)) continue;
    }
    const page = analyzePage(res.data.html, { url: next.url, finalUrl: res.data.final_url, status: res.data.status, contentType: res.data.headers?.["content-type"] ?? null });
    if (!page.isHtml) continue;
    if (pages.length === 0) {
      canonicalUrl = page.finalUrl;
      httpsSeen = page.finalUrl.startsWith("https://");
    }
    pages.push(page);
    kinds[page.finalUrl] = classifyPath(page.finalUrl);
    for (const link of page.links) {
      if (!link.internal) continue;
      const n = normalizeCrawlUrl(link.href);
      if (!n) continue;
      if (!outgoing.has(n)) outgoing.set(n, new Set());
      outgoing.get(n)!.add(page.finalUrl);
      enqueue(link.href, next.depth + 1);
    }
  }
  const truncated = queue.length > 0;

  // Link probes: internal links not already crawled (status only).
  const crawled = new Set([...pages.flatMap((p) => [p.url, p.finalUrl]), ...linkProbes.map((l) => l.url)]);
  const toProbe = [...outgoing.keys()].filter((u) => !crawled.has(u)).slice(0, maxLinkProbes);
  for (const url of toProbe) {
    await polite();
    const res = await website.probe({ url }, ctx);
    if (res.ok) linkProbes.push({ url, status: res.data.status, redirectChain: res.data.redirect_chain, foundOn: foundOn(url) });
    else if (res.reason === "http_error" && res.status) linkProbes.push({ url, status: res.status, redirectChain: [url], foundOn: foundOn(url) });
  }

  // Sitemap URLs: anything already seen broken counts; a few unknown ones are probed.
  const pageUrls = new Set(pages.flatMap((p) => [p.url, p.finalUrl]));
  const knownStatus = new Map(linkProbes.map((l) => [l.url, l.status] as const));
  let probedSitemap = 0;
  for (const url of sitemap.urls.filter((u) => sameHost(u) && !pageUrls.has(u))) {
    const known = knownStatus.get(url);
    if (known !== undefined) {
      if (known >= 400) sitemap.brokenSample.push({ url, status: known });
      continue;
    }
    if (probedSitemap++ >= 5) break;
    await polite();
    const res = await website.probe({ url }, ctx);
    const status = res.ok ? res.data.status : res.reason === "http_error" ? (res.status ?? 0) : 0;
    if (status >= 400) sitemap.brokenSample.push({ url, status });
  }

  // Image weights: the first images of the home page and the biggest declared ones.
  const imageProbes: ImageProbe[] = [];
  const home = pages[0];
  if (home) {
    const candidates = [...home.images].slice(0, maxImageProbes);
    for (const img of candidates) {
      if (!/^https?:/.test(img.src)) continue;
      await polite();
      const res = await website.probe({ url: img.src }, ctx);
      if (res.ok) imageProbes.push({ src: img.src, bytes: res.data.content_length, contentType: res.data.content_type, foundOn: home.finalUrl });
    }
  }

  // Soft 404: a path that cannot exist should not answer 200.
  const probedPath = `/local-audit-404-check-${Date.now().toString(36)}`;
  await polite();
  const nf = await website.probe({ url: `${origin}${probedPath}` }, ctx);
  const softNotFound: SiteCrawl["softNotFound"] = nf.ok
    ? { probedPath, status: nf.data.status, isSoft404: nf.data.status === 200 }
    : nf.reason === "http_error"
      ? { probedPath, status: nf.status ?? null, isSoft404: false }
      : { probedPath, status: null, isSoft404: null };

  return {
    startUrl,
    canonicalUrl,
    host,
    https: httpsSeen,
    pages,
    kinds,
    robots,
    sitemap,
    llmsTxt,
    softNotFound,
    linkProbes,
    imageProbes,
    failures,
    discovered: seen.size,
    truncated,
    fetchedAt: new Date().toISOString(),
  };
}

/** Compact, serializable digest for job step results and the audit page. */
export function summarizeCrawl(c: SiteCrawl) {
  return {
    canonical_url: c.canonicalUrl,
    https: c.https,
    pages_crawled: c.pages.length,
    pages_discovered: c.discovered,
    truncated: c.truncated,
    failures: c.failures.length,
    blocked: c.failures.filter((f) => f.reason === "blocked").length,
    robots: c.robots.status,
    robots_blocks_all: c.robots.blocksAll,
    ai_agents_blocked: c.robots.blockedAgents,
    sitemap: c.sitemap.status,
    sitemap_urls: c.sitemap.urls.length,
    llms_txt: c.llmsTxt.status,
    soft_404: c.softNotFound.isSoft404,
    broken_links: c.linkProbes.filter((l) => l.status >= 400).length,
    pages: c.pages.map((p) => ({ url: p.finalUrl, kind: c.kinds[p.finalUrl] ?? "other", status: p.status, title: p.title, words: p.wordCount })),
    fetched_at: c.fetchedAt,
  };
}
