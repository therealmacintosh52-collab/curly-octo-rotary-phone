import { z } from "zod";
import { createProvider, ProviderNotImplemented, type CallContext, type EnvLike, type ProviderResult } from "../core";

/**
 * The business's own website. Phase 1 implements resolveCanonical() (follow
 * redirects, http→https, www vs bare) with plain fetch; Phase 2 replaces
 * fetchPage() with the Playwright crawler worker (robots.txt respected,
 * identified user agent, rate limited, full-page screenshots).
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
});
export type Canonical = z.infer<typeof CanonicalSchema>;

export const WEBSITE_USER_AGENT = "LocalAuditBot/0.1 (+https://github.com/therealmacintosh52-collab/curly-octo-rotary-phone)";

export function createWebsiteProvider(opts: { env?: EnvLike } = {}) {
  const provider = createProvider({
    name: "website",
    label: "Business website (crawler)",
    docsUrl: "docs/MASTER_PLAN.md#step-2",
    envKeys: [],
    timeoutMs: 30_000,
    defaultTtlSeconds: 6 * 3600,
    phase: "1",
    env: opts.env,
  });

  return {
    provider,
    fetchPage(input: { url: string }, ctx: CallContext): Promise<ProviderResult<PageFetch>> {
      return provider.call({
        endpoint: "fetchPage",
        request: input,
        ctx,
        schema: PageFetchSchema,
        async execute() {
          throw new ProviderNotImplemented("website", "fetchPage", "2");
        },
      });
    },
    resolveCanonical(input: { url: string }, ctx: CallContext): Promise<ProviderResult<Canonical>> {
      return provider.call({
        endpoint: "resolveCanonical",
        request: input,
        ctx,
        schema: CanonicalSchema,
        async execute() {
          throw new ProviderNotImplemented("website", "resolveCanonical", "1");
        },
      });
    },
  };
}
