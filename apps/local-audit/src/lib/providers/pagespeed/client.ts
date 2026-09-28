import { z } from "zod";
import { createProvider, fetchJson, type CallContext, type EnvLike, type ProviderResult } from "../core";

/**
 * Google PageSpeed Insights v5. Free with an API key (the keyless shared
 * quota is exhausted in practice).
 *   GET https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=&strategy=&category=&key=
 * One call per strategy; results are cached 24 h like every snapshot.
 */
export const PAGESPEED_BASE = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

const AuditSchema = z.looseObject({
  id: z.string().optional(),
  score: z.number().nullable().optional(),
  numericValue: z.number().optional(),
  displayValue: z.string().optional(),
  details: z.looseObject({ items: z.array(z.looseObject({})).optional() }).optional(),
});

export const PagespeedResultSchema = z.looseObject({
  lighthouseResult: z
    .looseObject({
      finalUrl: z.string().optional(),
      categories: z.looseObject({ performance: z.looseObject({ score: z.number().nullable() }).optional() }).optional(),
      audits: z.record(z.string(), AuditSchema).optional(),
    })
    .optional(),
  loadingExperience: z
    .looseObject({
      overall_category: z.string().optional(),
      metrics: z.record(z.string(), z.looseObject({ percentile: z.number().optional(), category: z.string().optional() })).optional(),
    })
    .optional(),
  analysisUTCTimestamp: z.string().optional(),
});
export type PagespeedResult = z.infer<typeof PagespeedResultSchema>;

export interface RunPagespeedInput {
  url: string;
  strategy: "mobile" | "desktop";
  categories?: ("performance" | "accessibility" | "best-practices" | "seo")[];
}

/** The numbers the checks use, pulled out of the (very large) raw result. */
export interface PagespeedSummary {
  strategy: "mobile" | "desktop";
  finalUrl: string | null;
  performanceScore: number | null; // 0–100
  lab: { lcpMs: number | null; clsScore: number | null; tbtMs: number | null; ttfbMs: number | null; speedIndexMs: number | null; fcpMs: number | null };
  field: { lcpMs: number | null; inpMs: number | null; cls: number | null; ttfbMs: number | null; overall: string | null };
  /** Mobile usability audits (0..1 score, null when not applicable). */
  usability: { tapTargets: number | null; fontSize: number | null; contentWidth: number | null };
  /** Byte-heavy resources called out by Lighthouse. */
  opportunities: { id: string; displayValue: string | null }[];
}

export function summarizePagespeed(r: PagespeedResult, strategy: "mobile" | "desktop"): PagespeedSummary {
  const lr = r.lighthouseResult;
  const a = lr?.audits ?? {};
  const num = (id: string) => a[id]?.numericValue ?? null;
  const score = (id: string) => (a[id]?.score ?? null) as number | null;
  const m = r.loadingExperience?.metrics ?? {};
  const pct = (k: string) => m[k]?.percentile ?? null;
  const opportunityIds = ["render-blocking-resources", "unused-javascript", "unused-css-rules", "modern-image-formats", "uses-optimized-images", "uses-responsive-images", "offscreen-images", "server-response-time", "uses-text-compression", "unminified-javascript", "unminified-css", "total-byte-weight", "largest-contentful-paint-element", "font-display"];
  return {
    strategy,
    finalUrl: lr?.finalUrl ?? null,
    performanceScore: lr?.categories?.performance?.score != null ? Math.round(lr.categories.performance.score * 100) : null,
    lab: {
      lcpMs: num("largest-contentful-paint"),
      clsScore: num("cumulative-layout-shift"),
      tbtMs: num("total-blocking-time"),
      ttfbMs: num("server-response-time"),
      speedIndexMs: num("speed-index"),
      fcpMs: num("first-contentful-paint"),
    },
    field: {
      lcpMs: pct("LARGEST_CONTENTFUL_PAINT_MS"),
      inpMs: pct("INTERACTION_TO_NEXT_PAINT"),
      cls: pct("CUMULATIVE_LAYOUT_SHIFT_SCORE") != null ? pct("CUMULATIVE_LAYOUT_SHIFT_SCORE")! / 100 : null,
      ttfbMs: pct("EXPERIMENTAL_TIME_TO_FIRST_BYTE"),
      overall: r.loadingExperience?.overall_category ?? null,
    },
    usability: { tapTargets: score("tap-targets"), fontSize: score("font-size"), contentWidth: score("content-width") },
    opportunities: opportunityIds.filter((id) => a[id] && (a[id]!.score ?? 1) < 0.9).map((id) => ({ id, displayValue: a[id]!.displayValue ?? null })),
  };
}

export function createPagespeedProvider(opts: { env?: EnvLike; fetchImpl?: typeof fetch } = {}) {
  const env = opts.env ?? process.env;
  const provider = createProvider({
    name: "pagespeed",
    label: "Google PageSpeed Insights",
    docsUrl: "https://developers.google.com/speed/docs/insights/v5/get-started",
    envKeys: ["GOOGLE_PAGESPEED_API_KEY"],
    timeoutMs: 90_000,
    defaultTtlSeconds: 24 * 3600,
    phase: "0",
    env,
    retry: { retries: 2, baseMs: 2_000 },
  });

  return {
    provider,
    run(input: RunPagespeedInput, ctx: CallContext): Promise<ProviderResult<PagespeedResult>> {
      return provider.call({
        endpoint: "runPagespeed",
        request: input,
        ctx,
        schema: PagespeedResultSchema,
        async execute({ timeoutMs }) {
          const params = new URLSearchParams({ url: input.url, strategy: input.strategy, key: env.GOOGLE_PAGESPEED_API_KEY ?? "" });
          for (const c of input.categories ?? ["performance"]) params.append("category", c);
          const res = await fetchJson<unknown>(`${PAGESPEED_BASE}?${params}`, { method: "GET" }, { timeoutMs, fetchImpl: opts.fetchImpl });
          return { response: res.body as PagespeedResult, costUsd: 0 };
        },
      });
    },
  };
}
