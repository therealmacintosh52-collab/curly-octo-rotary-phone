import { z } from "zod";
import { createProvider, fetchJson, type CallContext, type EnvLike, type ProviderResult } from "../core";

/**
 * Google Places API (New).
 *   POST https://places.googleapis.com/v1/places:searchText   (X-Goog-Api-Key, X-Goog-FieldMask)
 *   GET  https://places.googleapis.com/v1/places/{placeId}    (X-Goog-Api-Key, X-Goog-FieldMask)
 * The field mask decides the SKU. The masks below stay inside the "Pro" tier
 * (no reviews, no photos, no atmosphere data); reviews and photos arrive in
 * Phase 3 with their own masks and costs.
 */
export const PLACES_BASE = "https://places.googleapis.com/v1";

/** USD per request. From the Places API (New) pricing page; re-check before invoicing. */
export const PLACES_COST_USD = {
  textSearchPro: { usd: 0.032, verified: false, source: "https://developers.google.com/maps/billing-and-pricing/pricing#places-pricing", asOf: "2026-09-28" },
  placeDetailsPro: { usd: 0.017, verified: false, source: "https://developers.google.com/maps/billing-and-pricing/pricing#places-pricing", asOf: "2026-09-28" },
} as const;

export const PlaceSchema = z.looseObject({
  id: z.string(),
  displayName: z.looseObject({ text: z.string(), languageCode: z.string().optional() }).optional(),
  formattedAddress: z.string().optional(),
  shortFormattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  googleMapsUri: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  primaryType: z.string().optional(),
  primaryTypeDisplayName: z.looseObject({ text: z.string() }).optional(),
  types: z.array(z.string()).optional(),
  location: z.looseObject({ latitude: z.number(), longitude: z.number() }).optional(),
  businessStatus: z.string().optional(),
  addressComponents: z.array(z.looseObject({ longText: z.string().optional(), shortText: z.string().optional(), types: z.array(z.string()).optional() })).optional(),
});
export type Place = z.infer<typeof PlaceSchema>;

const SearchTextResponse = z.looseObject({ places: z.array(PlaceSchema).default([]) });
export type SearchTextResult = z.infer<typeof SearchTextResponse>;

const PRO_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "rating",
  "userRatingCount",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "location",
  "businessStatus",
  "addressComponents",
];

export interface SearchTextInput {
  textQuery: string;
  locationBias?: { latitude: number; longitude: number; radiusMeters: number };
  maxResultCount?: number;
  fieldMask?: string[];
}
export interface GetPlaceInput {
  placeId: string;
  fieldMask?: string[];
}

export function createGooglePlacesProvider(opts: { env?: EnvLike; fetchImpl?: typeof fetch } = {}) {
  const env = opts.env ?? process.env;
  const provider = createProvider({
    name: "google-places",
    label: "Google Places API (New)",
    docsUrl: "https://developers.google.com/maps/documentation/places/web-service/op-overview",
    envKeys: ["GOOGLE_PLACES_API_KEY"],
    timeoutMs: 15_000,
    defaultTtlSeconds: 24 * 3600,
    phase: "0",
    env,
  });
  const headers = (fieldMask: string[]) => ({
    "content-type": "application/json",
    "x-goog-api-key": env.GOOGLE_PLACES_API_KEY ?? "",
    "x-goog-fieldmask": fieldMask.join(","),
  });

  return {
    provider,
    searchText(input: SearchTextInput, ctx: CallContext): Promise<ProviderResult<SearchTextResult>> {
      const fields = input.fieldMask ?? PRO_FIELDS;
      return provider.call({
        endpoint: "searchText",
        request: { ...input, fieldMask: fields },
        ctx,
        schema: SearchTextResponse,
        async execute({ timeoutMs }) {
          const body: Record<string, unknown> = { textQuery: input.textQuery, maxResultCount: input.maxResultCount ?? 5 };
          if (input.locationBias) {
            body.locationBias = { circle: { center: { latitude: input.locationBias.latitude, longitude: input.locationBias.longitude }, radius: input.locationBias.radiusMeters } };
          }
          const res = await fetchJson<unknown>(
            `${PLACES_BASE}/places:searchText`,
            { method: "POST", headers: headers(fields.map((f) => `places.${f}`)), body: JSON.stringify(body) },
            { timeoutMs, fetchImpl: opts.fetchImpl },
          );
          return { response: res.body as SearchTextResult, costUsd: PLACES_COST_USD.textSearchPro.usd };
        },
      });
    },
    getPlace(input: GetPlaceInput, ctx: CallContext): Promise<ProviderResult<Place>> {
      const fields = input.fieldMask ?? PRO_FIELDS;
      return provider.call({
        endpoint: "getPlace",
        request: { ...input, fieldMask: fields },
        ctx,
        schema: PlaceSchema,
        async execute({ timeoutMs }) {
          const res = await fetchJson<unknown>(`${PLACES_BASE}/places/${encodeURIComponent(input.placeId)}`, { method: "GET", headers: headers(fields) }, { timeoutMs, fetchImpl: opts.fetchImpl });
          return { response: res.body as Place, costUsd: PLACES_COST_USD.placeDetailsPro.usd };
        },
      });
    },
  };
}
