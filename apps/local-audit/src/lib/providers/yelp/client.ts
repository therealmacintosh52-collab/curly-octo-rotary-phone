import { z } from "zod";
import { createProvider, fetchJson, type CallContext, type EnvLike, type ProviderResult } from "../core";

/**
 * Yelp Fusion / Places API (Bearer token).
 *   GET https://api.yelp.com/v3/businesses/{id_or_alias}
 *   GET https://api.yelp.com/v3/businesses/search?phone=|term=&location=
 * Licence terms: content may be cached for at most 24 hours (the TTL below),
 * review text is excerpt-only and is not requested here. Only derived
 * fields (rating, counts, NAP, claimed flag) are copied into our tables.
 */
export const YELP_BASE = "https://api.yelp.com/v3";

/** USD per call. Yelp bills per plan; this is the per-call figure to log until an invoice says otherwise. */
export const YELP_COST_USD = { perCall: { usd: 0.005, verified: false, source: "https://business.yelp.com/data/products/fusion/", asOf: "2026-09-28" } } as const;

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
  display_phone: z.string().optional(),
  url: z.string().optional(),
  photos: z.array(z.string()).optional(),
  location: z
    .looseObject({
      address1: z.string().nullable().optional(),
      address2: z.string().nullable().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip_code: z.string().optional(),
      display_address: z.array(z.string()).optional(),
    })
    .optional(),
  coordinates: z.looseObject({ latitude: z.number().nullable().optional(), longitude: z.number().nullable().optional() }).optional(),
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

export function yelpAddress(b: YelpBusiness): string | null {
  const l = b.location;
  if (!l) return null;
  if (l.display_address?.length) return l.display_address.join(", ");
  const parts = [l.address1, l.address2, l.city, l.state, l.zip_code].filter((p): p is string => !!p && p.trim() !== "");
  return parts.length ? parts.join(", ") : null;
}

export function createYelpProvider(opts: { env?: EnvLike; fetchImpl?: typeof fetch } = {}) {
  const env = opts.env ?? process.env;
  const provider = createProvider({
    name: "yelp",
    label: "Yelp Places API",
    docsUrl: "https://docs.developer.yelp.com/docs/fusion-intro",
    envKeys: ["YELP_API_KEY"],
    timeoutMs: 15_000,
    defaultTtlSeconds: 24 * 3600,
    phase: "0",
    env,
  });
  const headers = () => ({ accept: "application/json", authorization: `Bearer ${env.YELP_API_KEY ?? ""}` });

  return {
    provider,
    getBusiness(input: GetBusinessInput, ctx: CallContext): Promise<ProviderResult<YelpBusiness>> {
      return provider.call({
        endpoint: "businesses.get",
        request: input,
        ctx,
        schema: YelpBusinessSchema,
        async execute({ timeoutMs }) {
          const res = await fetchJson<unknown>(`${YELP_BASE}/businesses/${encodeURIComponent(input.idOrAlias)}`, { method: "GET", headers: headers() }, { timeoutMs, fetchImpl: opts.fetchImpl });
          return { response: res.body as YelpBusiness, costUsd: YELP_COST_USD.perCall.usd };
        },
      });
    },
    searchBusinesses(input: SearchBusinessesInput, ctx: CallContext): Promise<ProviderResult<z.infer<typeof YelpSearchSchema>>> {
      return provider.call({
        endpoint: "businesses.search",
        request: input,
        ctx,
        schema: YelpSearchSchema,
        async execute({ timeoutMs }) {
          const path = input.phone ? "/businesses/search/phone" : "/businesses/search";
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(input)) if (v !== undefined && v !== null) params.set(k, String(v));
          const res = await fetchJson<unknown>(`${YELP_BASE}${path}?${params}`, { method: "GET", headers: headers() }, { timeoutMs, fetchImpl: opts.fetchImpl });
          return { response: res.body as z.infer<typeof YelpSearchSchema>, costUsd: YELP_COST_USD.perCall.usd };
        },
      });
    },
  };
}
