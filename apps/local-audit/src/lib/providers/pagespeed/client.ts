import { z } from "zod";
import { createProvider, ProviderNotImplemented, type CallContext, type EnvLike, type ProviderResult } from "../core";

/**
 * Google PageSpeed Insights v5. Free with an API key. Live call arrives in Phase 2:
 *   GET https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=&strategy=&key=
 */
export const PagespeedResultSchema = z.looseObject({
  lighthouseResult: z
    .looseObject({
      categories: z.looseObject({ performance: z.looseObject({ score: z.number().nullable() }).optional() }).optional(),
      audits: z.record(z.string(), z.looseObject({ numericValue: z.number().optional(), score: z.number().nullable().optional() })).optional(),
    })
    .optional(),
  loadingExperience: z
    .looseObject({
      overall_category: z.string().optional(),
      metrics: z.record(z.string(), z.looseObject({ percentile: z.number().optional(), category: z.string().optional() })).optional(),
    })
    .optional(),
});
export type PagespeedResult = z.infer<typeof PagespeedResultSchema>;

export interface RunPagespeedInput {
  url: string;
  strategy: "mobile" | "desktop";
  categories?: ("performance" | "accessibility" | "best-practices" | "seo")[];
}

export function createPagespeedProvider(opts: { env?: EnvLike } = {}) {
  const provider = createProvider({
    name: "pagespeed",
    label: "Google PageSpeed Insights",
    docsUrl: "https://developers.google.com/speed/docs/insights/v5/get-started",
    envKeys: ["GOOGLE_PAGESPEED_API_KEY"],
    timeoutMs: 60_000,
    defaultTtlSeconds: 24 * 3600,
    phase: "2",
    env: opts.env,
  });

  return {
    provider,
    run(input: RunPagespeedInput, ctx: CallContext): Promise<ProviderResult<PagespeedResult>> {
      return provider.call({
        endpoint: "runPagespeed",
        request: input,
        ctx,
        schema: PagespeedResultSchema,
        async execute() {
          throw new ProviderNotImplemented("pagespeed", "runPagespeed", "2");
        },
      });
    },
  };
}
