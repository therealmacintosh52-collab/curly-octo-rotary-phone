import { z } from "zod";
import { createProvider, ProviderNotImplemented, type CallContext, type EnvLike, type ProviderResult } from "../core";

/**
 * DataForSEO v3 (Basic auth, POST JSON arrays). One client, four sub-APIs.
 * Every response carries `tasks[].cost`, which is the logged cost when the
 * live calls land. Live calls arrive in Phases 4 (serp/labs), 5 (ai
 * optimization) and 6 (backlinks).
 *   https://api.dataforseo.com/v3/serp/google/organic/live/advanced
 *   https://api.dataforseo.com/v3/serp/google/maps/live/advanced
 *   https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live
 *   https://api.dataforseo.com/v3/backlinks/summary/live
 *   https://api.dataforseo.com/v3/ai_optimization/llm_responses/live
 */
const TaskEnvelope = <T extends z.ZodType>(result: T) =>
  z.looseObject({
    tasks: z.array(
      z.looseObject({
        cost: z.number().optional(),
        status_code: z.number().optional(),
        result: z.array(result).nullable().optional(),
      }),
    ),
  });

export const SerpItemSchema = z.looseObject({
  type: z.string(),
  rank_group: z.number().optional(),
  rank_absolute: z.number().optional(),
  domain: z.string().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
});
export const SerpResultSchema = TaskEnvelope(z.looseObject({ keyword: z.string().optional(), items: z.array(SerpItemSchema).nullable().optional() }));
export const RankedKeywordsSchema = TaskEnvelope(z.looseObject({ items: z.array(z.looseObject({})).nullable().optional() }));
export const BacklinksSummarySchema = TaskEnvelope(
  z.looseObject({
    target: z.string().optional(),
    backlinks: z.number().optional(),
    referring_domains: z.number().optional(),
    rank: z.number().optional(),
  }),
);
export const LlmResponsesSchema = TaskEnvelope(z.looseObject({ items: z.array(z.looseObject({})).nullable().optional() }));

export interface SerpInput {
  keyword: string;
  location_code?: number;
  location_name?: string;
  location_coordinate?: string;
  language_code?: string;
  device?: "desktop" | "mobile";
  depth?: number;
}
export interface RankedKeywordsInput {
  target: string;
  location_code?: number;
  language_code?: string;
  limit?: number;
}
export interface BacklinksInput {
  target: string;
}
export interface LlmResponsesInput {
  llm: "chatgpt" | "gemini" | "claude" | "perplexity";
  prompt: string;
  location_code?: number;
}

export function createDataForSeoProvider(opts: { env?: EnvLike } = {}) {
  const provider = createProvider({
    name: "dataforseo",
    label: "DataForSEO",
    docsUrl: "https://docs.dataforseo.com/v3/",
    envKeys: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    timeoutMs: 60_000,
    defaultTtlSeconds: 24 * 3600,
    phase: "4",
    env: opts.env,
  });

  const notYet = (endpoint: string, phase: string) => async () => {
    throw new ProviderNotImplemented("dataforseo", endpoint, phase);
  };

  return {
    provider,
    serp: {
      googleOrganic(input: SerpInput, ctx: CallContext): Promise<ProviderResult<z.infer<typeof SerpResultSchema>>> {
        return provider.call({ endpoint: "serp.google.organic.live.advanced", request: input, ctx, schema: SerpResultSchema, execute: notYet("serp.google.organic", "4") });
      },
      googleMaps(input: SerpInput, ctx: CallContext): Promise<ProviderResult<z.infer<typeof SerpResultSchema>>> {
        return provider.call({ endpoint: "serp.google.maps.live.advanced", request: input, ctx, schema: SerpResultSchema, execute: notYet("serp.google.maps", "4") });
      },
    },
    labs: {
      rankedKeywords(input: RankedKeywordsInput, ctx: CallContext): Promise<ProviderResult<z.infer<typeof RankedKeywordsSchema>>> {
        return provider.call({ endpoint: "labs.ranked_keywords.live", request: input, ctx, schema: RankedKeywordsSchema, execute: notYet("labs.ranked_keywords", "4") });
      },
    },
    backlinks: {
      summary(input: BacklinksInput, ctx: CallContext): Promise<ProviderResult<z.infer<typeof BacklinksSummarySchema>>> {
        return provider.call({ endpoint: "backlinks.summary.live", request: input, ctx, schema: BacklinksSummarySchema, execute: notYet("backlinks.summary", "6") });
      },
    },
    aiOptimization: {
      llmResponses(input: LlmResponsesInput, ctx: CallContext): Promise<ProviderResult<z.infer<typeof LlmResponsesSchema>>> {
        return provider.call({ endpoint: "ai_optimization.llm_responses.live", request: input, ctx, schema: LlmResponsesSchema, execute: notYet("ai_optimization.llm_responses", "5") });
      },
    },
  };
}
