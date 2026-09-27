import { z } from "zod";
import { createProvider, ProviderNotImplemented, type CallContext, type EnvLike, type ProviderResult } from "../core";

/**
 * Google Places API (New). Live calls arrive in Phase 1:
 *   POST https://places.googleapis.com/v1/places:searchText   (X-Goog-Api-Key, X-Goog-FieldMask)
 *   GET  https://places.googleapis.com/v1/places/{placeId}    (X-Goog-Api-Key, X-Goog-FieldMask)
 * Field masks decide the SKU; keep them narrow. Costs are per-request SKU
 * estimates recorded when the live call is implemented.
 */
export const PlaceSchema = z.looseObject({
  id: z.string(),
  displayName: z.looseObject({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  primaryType: z.string().optional(),
  types: z.array(z.string()).optional(),
  location: z.looseObject({ latitude: z.number(), longitude: z.number() }).optional(),
});
export type Place = z.infer<typeof PlaceSchema>;

const SearchTextResponse = z.looseObject({ places: z.array(PlaceSchema).default([]) });

export interface SearchTextInput {
  textQuery: string;
  locationBias?: { latitude: number; longitude: number; radiusMeters: number };
  fieldMask?: string[];
}
export interface GetPlaceInput {
  placeId: string;
  fieldMask?: string[];
}

export function createGooglePlacesProvider(opts: { env?: EnvLike } = {}) {
  const provider = createProvider({
    name: "google-places",
    label: "Google Places API (New)",
    docsUrl: "https://developers.google.com/maps/documentation/places/web-service/op-overview",
    envKeys: ["GOOGLE_PLACES_API_KEY"],
    timeoutMs: 15_000,
    defaultTtlSeconds: 24 * 3600,
    phase: "1",
    env: opts.env,
  });

  const notYet = (endpoint: string) => async () => {
    throw new ProviderNotImplemented("google-places", endpoint, "1");
  };

  return {
    provider,
    searchText(input: SearchTextInput, ctx: CallContext): Promise<ProviderResult<z.infer<typeof SearchTextResponse>>> {
      return provider.call({ endpoint: "searchText", request: input, ctx, schema: SearchTextResponse, execute: notYet("searchText") });
    },
    getPlace(input: GetPlaceInput, ctx: CallContext): Promise<ProviderResult<Place>> {
      return provider.call({ endpoint: "getPlace", request: input, ctx, schema: PlaceSchema, execute: notYet("getPlace") });
    },
  };
}
