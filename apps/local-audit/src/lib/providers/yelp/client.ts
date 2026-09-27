import { z } from "zod";
import { createProvider, ProviderNotImplemented, type CallContext, type EnvLike, type ProviderResult } from "../core";

/**
 * Yelp Fusion / Places API (Bearer token). Paid per call on commercial plans;
 * review text is excerpt-only and content may be cached for at most 24 hours,
 * so the TTL here is capped at that. Live calls arrive in Phase 3:
 *   GET https://api.yelp.com/v3/businesses/{id_or_alias}
 *   GET https://api.yelp.com/v3/businesses/search?phone=|term=&location=
 */
export const YelpBusinessSchema = z.looseObject({
  id: z.string(),
  alias: z.string().optional(),
  name: z.string(),
  rating: z.number().optional(),
  review_count: z.number().optional(),
  is_claimed: z.boolean().optional(),
  is_closed: z.boolean().optional(),
  categories: z.array(z.looseObject({ alias: z.string(), title: z.string() })).optional(),
  phone: z.string().optional(),
  url: z.string().optional(),
  photos: z.array(z.string()).optional(),
});
export type YelpBusiness = z.infer<typeof YelpBusinessSchema>;
const YelpSearchSchema = z.looseObject({ businesses: z.array(YelpBusinessSchema).default([]), total: z.number().optional() });

export interface GetBusinessInput {
  idOrAlias: string;
}
export interface SearchBusinessesInput {
  term?: string;
  location?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  limit?: number;
}

export function createYelpProvider(opts: { env?: EnvLike } = {}) {
  const provider = createProvider({
    name: "yelp",
    label: "Yelp Places API",
    docsUrl: "https://docs.developer.yelp.com/docs/fusion-intro",
    envKeys: ["YELP_API_KEY"],
    timeoutMs: 15_000,
    defaultTtlSeconds: 24 * 3600,
    phase: "3",
    env: opts.env,
  });

  return {
    provider,
    getBusiness(input: GetBusinessInput, ctx: CallContext): Promise<ProviderResult<YelpBusiness>> {
      return provider.call({
        endpoint: "businesses.get",
        request: input,
        ctx,
        schema: YelpBusinessSchema,
        async execute() {
          throw new ProviderNotImplemented("yelp", "businesses.get", "3");
        },
      });
    },
    searchBusinesses(input: SearchBusinessesInput, ctx: CallContext): Promise<ProviderResult<z.infer<typeof YelpSearchSchema>>> {
      return provider.call({
        endpoint: "businesses.search",
        request: input,
        ctx,
        schema: YelpSearchSchema,
        async execute() {
          throw new ProviderNotImplemented("yelp", "businesses.search", "3");
        },
      });
    },
  };
}
