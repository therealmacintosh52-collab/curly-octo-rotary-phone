import { z } from "zod";
import { createProvider, ProviderBlocked, ProviderHttpError, ProviderNetworkError, ProviderTimeout, type CallContext, type EnvLike, type ProviderResult } from "../core";
import { isAllowed, parseRobots } from "./robots";

/**
 * The business's own website, fetched politely: identified user agent,
 * robots.txt honored, bounded redirects and body size, no retries into a
 * bot wall. Phase 2 adds the Playwright crawler (rendering, screenshots,
 * many pages) behind the same interface.
 */
export const PageFetchSchema = z.looseObject({
  url: z.string(),
  final_url: z.string(),
  status: z.number(),
  html: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  fetched_at: z.string().optional(),
});
export type PageFetch = z.infer<typeof PageFetchSchema>;

export const CanonicalSchema = z.looseObject({
  input: z.string(),
  canonical_domain: z.string(),
  canonical_url: z.string(),
  https: z.boolean(),
  redirect_chain: z.array(z.string()).default([]),
  status: z.number().optional(),
});
export type Canonical = z.infer<typeof CanonicalSchema>;

export const ProbeSchema = z.looseObject({
  url: z.string(),
  final_url: z.string(),
  status: z.number(),
  content_type: z.string().nullable(),
  content_length: z.number().nullable(),
  redirect_chain: z.array(z.string()).default([]),
});
export type Probe = z.infer<typeof ProbeSchema>;

export const WEBSITE_USER_AGENT_TOKEN = "LocalAuditBot";
export const WEBSITE_USER_AGENT = `${WEBSITE_USER_AGENT_TOKEN}/0.1 (+https://github.com/therealmacintosh52-collab/curly-octo-rotary-phone; local business audit; contact via the agency)`;
const MAX_REDIRECTS = 10;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

async function timedFetch(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store", headers: { "user-agent": WEBSITE_USER_AGENT, accept: "text/html,*/*;q=0.8", ...(init.headers as Record<string, string> | undefined) } });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw new ProviderTimeout(timeoutMs);
    throw new ProviderNetworkError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(res: Response): Promise<string> {
  const text = await res.text();
  return text.length > MAX_BODY_BYTES ? text.slice(0, MAX_BODY_BYTES) : text;
}

export function createWebsiteProvider(opts: { env?: EnvLike; fetchImpl?: typeof fetch } = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const provider = createProvider({
    name: "website",
    label: "Business website (crawler)",
    docsUrl: "docs/MASTER_PLAN.md#step-2",
    envKeys: [],
    timeoutMs: 20_000,
    defaultTtlSeconds: 6 * 3600,
    phase: "0",
    env: opts.env,
    // A site that is down is down; one retry is plenty and never into a 4xx.
    retry: { retries: 1 },
  });

  const robotsCache = new Map<string, ReturnType<typeof parseRobots> | null>();
  async function robotsFor(origin: string, timeoutMs: number) {
    if (robotsCache.has(origin)) return robotsCache.get(origin)!;
    let groups: ReturnType<typeof parseRobots> | null = null;
    try {
      const res = await timedFetch(fetchImpl, `${origin}/robots.txt`, { method: "GET", redirect: "follow" }, Math.min(timeoutMs, 8_000));
      if (res.ok) groups = parseRobots(await readBody(res));
    } catch {
      groups = null; // unreachable robots.txt = no restrictions known
    }
    robotsCache.set(origin, groups);
    return groups;
  }

  /** Follows redirects by hand so the chain is recorded; prefers https. */
  async function followRedirects(start: string, timeoutMs: number): Promise<{ finalUrl: string; chain: string[]; status: number }> {
    const chain: string[] = [];
    let current = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      chain.push(current);
      const res = await timedFetch(fetchImpl, current, { method: "GET", redirect: "manual" }, timeoutMs);
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        throw new ProviderBlocked(`${current} answered ${res.status}; the site blocks automated fetches`);
      }
      if (!res.ok) throw new ProviderHttpError(res.status, null);
      return { finalUrl: current, chain, status: res.status };
    }
    throw new ProviderHttpError(310, "too many redirects");
  }

  return {
    provider,

    resolveCanonical(input: { url: string }, ctx: CallContext): Promise<ProviderResult<Canonical>> {
      return provider.call({
        endpoint: "resolveCanonical",
        request: input,
        ctx,
        schema: CanonicalSchema,
        async execute({ timeoutMs }) {
          const startUrl = new URL(input.url);
          let attempt = startUrl.toString();
          let result: Awaited<ReturnType<typeof followRedirects>>;
          try {
            result = await followRedirects(attempt, timeoutMs);
          } catch (err) {
            // https refused at the network level: try plain http once, the site may not have TLS.
            if (startUrl.protocol === "https:" && err instanceof ProviderNetworkError) {
              startUrl.protocol = "http:";
              attempt = startUrl.toString();
              result = await followRedirects(attempt, timeoutMs);
            } else throw err;
          }
          const finalUrl = new URL(result.finalUrl);
          const response: Canonical = {
            input: input.url,
            canonical_domain: finalUrl.hostname.toLowerCase().replace(/^www\./, ""),
            canonical_url: `${finalUrl.protocol}//${finalUrl.host}/`,
            https: finalUrl.protocol === "https:",
            redirect_chain: result.chain,
            status: result.status,
          };
          return { response, costUsd: 0 };
        },
      });
    },

    fetchPage(input: { url: string }, ctx: CallContext): Promise<ProviderResult<PageFetch>> {
      return provider.call({
        endpoint: "fetchPage",
        request: input,
        ctx,
        schema: PageFetchSchema,
        async execute({ timeoutMs }) {
          const url = new URL(input.url);
          const robots = await robotsFor(url.origin, timeoutMs);
          if (robots && !isAllowed(robots, WEBSITE_USER_AGENT_TOKEN, url.pathname + url.search)) {
            throw new ProviderBlocked(`${url.pathname} is disallowed by ${url.origin}/robots.txt`);
          }
          const res = await timedFetch(fetchImpl, url.toString(), { method: "GET", redirect: "follow" }, timeoutMs);
          if (res.status === 403 || res.status === 429 || res.status === 503) throw new ProviderBlocked(`${url} answered ${res.status}; the site blocks automated fetches`);
          if (!res.ok) throw new ProviderHttpError(res.status, null);
          const headers: Record<string, string> = {};
          for (const k of ["content-type", "server", "x-powered-by", "cache-control", "last-modified"]) {
            const v = res.headers.get(k);
            if (v) headers[k] = v;
          }
          const response: PageFetch = {
            url: input.url,
            final_url: res.url || url.toString(),
            status: res.status,
            html: await readBody(res),
            headers,
            fetched_at: new Date().toISOString(),
          };
          return { response, costUsd: 0 };
        },
      });
    },

    /** Status, type and size of a URL without storing its body (link checks, image weights). Follows redirects and records them. */
    probe(input: { url: string }, ctx: CallContext): Promise<ProviderResult<Probe>> {
      return provider.call({
        endpoint: "probe",
        request: input,
        ctx,
        schema: ProbeSchema,
        async execute({ timeoutMs }) {
          const chain: string[] = [];
          let current = input.url;
          for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            chain.push(current);
            let res = await timedFetch(fetchImpl, current, { method: "HEAD", redirect: "manual" }, Math.min(timeoutMs, 10_000));
            if (res.status === 405 || res.status === 501) res = await timedFetch(fetchImpl, current, { method: "GET", redirect: "manual", headers: { range: "bytes=0-0" } }, Math.min(timeoutMs, 10_000));
            const location = res.headers.get("location");
            if (res.status >= 300 && res.status < 400 && location) {
              current = new URL(location, current).toString();
              continue;
            }
            const len = Number(res.headers.get("content-length"));
            return {
              response: {
                url: input.url,
                final_url: current,
                status: res.status,
                content_type: res.headers.get("content-type"),
                content_length: Number.isFinite(len) && len > 0 ? len : null,
                redirect_chain: chain,
              },
              costUsd: 0,
            };
          }
          throw new ProviderHttpError(310, "too many redirects");
        },
      });
    },

    /** Expands a short link (maps.app.goo.gl, g.co) to its destination without fetching the destination's body. */
    expandShortLink(input: { url: string }, ctx: CallContext): Promise<ProviderResult<Canonical>> {
      return provider.call({
        endpoint: "expandShortLink",
        request: input,
        ctx,
        schema: CanonicalSchema,
        async execute({ timeoutMs }) {
          const chain: string[] = [];
          let current = input.url;
          for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            chain.push(current);
            const res = await timedFetch(fetchImpl, current, { method: "GET", redirect: "manual" }, timeoutMs);
            const location = res.headers.get("location");
            if (res.status >= 300 && res.status < 400 && location) {
              current = new URL(location, current).toString();
              continue;
            }
            const finalUrl = new URL(current);
            return {
              response: { input: input.url, canonical_domain: finalUrl.hostname.toLowerCase(), canonical_url: current, https: finalUrl.protocol === "https:", redirect_chain: chain, status: res.status },
              costUsd: 0,
            };
          }
          throw new ProviderHttpError(310, "too many redirects");
        },
      });
    },
  };
}
