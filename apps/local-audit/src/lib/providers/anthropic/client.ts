import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createProvider, parseRetryAfter, ProviderHttpError, ProviderNetworkError, ProviderTimeout, type CallContext, type EnvLike, type ProviderResult } from "../core";
import { ANTHROPIC_MODEL, costFromUsage } from "./pricing";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** The slice of the SDK the adapter touches; tests inject a stub. */
export type AnthropicSdk = Pick<Anthropic, "messages">;

export interface CompleteInput {
  system?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  effort?: Effort;
}

export interface ExtractInput<S extends z.ZodType> extends CompleteInput {
  schema: S;
  /** Part of the cache key and the fixture name; change it when the schema changes shape. */
  schemaName: string;
}

const UsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number().nullable().optional(),
  cache_read_input_tokens: z.number().nullable().optional(),
});

const CompleteResponseSchema = z.object({
  text: z.string(),
  stop_reason: z.string().nullable(),
  refusal_category: z.string().nullable().optional(),
  usage: UsageSchema,
});
export type CompleteResponse = z.infer<typeof CompleteResponseSchema>;

export interface ExtractResponse<T> {
  data: T | null;
  stop_reason: string | null;
  refusal_category?: string | null;
  usage: z.infer<typeof UsageSchema>;
}

/** Turns SDK errors into Provider* errors so the core's retry/UNAVAILABLE mapping applies. */
export function mapAnthropicError(err: unknown): unknown {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new ProviderTimeout(120_000);
  if (err instanceof Anthropic.APIConnectionError) return new ProviderNetworkError(err.message);
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 500;
    const headers = (err as { headers?: unknown }).headers;
    const retryAfter =
      headers instanceof Headers ? headers.get("retry-after") : ((headers as Record<string, string> | undefined)?.["retry-after"] ?? null);
    return new ProviderHttpError(status, err.message, parseRetryAfter(retryAfter));
  }
  return err;
}

function classifyStop(r: { stop_reason: string | null; refusal_category?: string | null }) {
  if (r.stop_reason === "refusal") {
    return { reason: "refusal" as const, message: `Claude declined this request${r.refusal_category ? ` (${r.refusal_category})` : ""}` };
  }
  if (r.stop_reason === "max_tokens") {
    return { reason: "truncated" as const, message: "Claude hit max_tokens before finishing; raise maxTokens or shorten the input" };
  }
  return null;
}

/**
 * Claude via the official SDK. `complete()` returns text; `extract()` returns
 * JSON validated against a Zod schema (structured outputs). The SDK's own retry
 * is off so the provider core is the single owner of backoff and logging.
 */
export function createAnthropicProvider(opts: { sdk?: AnthropicSdk; env?: EnvLike } = {}) {
  const env = opts.env ?? process.env;
  const provider = createProvider({
    name: "anthropic",
    label: "Anthropic (Claude)",
    docsUrl: "https://platform.claude.com/docs",
    envKeys: ["ANTHROPIC_API_KEY"],
    timeoutMs: 120_000,
    defaultTtlSeconds: 7 * 24 * 3600,
    phase: "0",
    env,
  });

  let sdk: AnthropicSdk | null = opts.sdk ?? null;
  const getSdk = () => (sdk ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 0 }));

  async function complete(input: CompleteInput, ctx: CallContext): Promise<ProviderResult<CompleteResponse>> {
    const maxTokens = input.maxTokens ?? 16_000;
    return provider.call<unknown, CompleteResponse>({
      endpoint: "messages.create",
      request: { model: ANTHROPIC_MODEL, system: input.system, messages: input.messages, max_tokens: maxTokens, effort: input.effort },
      ctx,
      schema: CompleteResponseSchema,
      classify: classifyStop,
      async execute() {
        try {
          const res = await getSdk().messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: maxTokens,
            ...(input.system ? { system: input.system } : {}),
            messages: input.messages,
            ...(input.effort ? { output_config: { effort: input.effort } } : {}),
          });
          const text = res.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("");
          const response: CompleteResponse = {
            text,
            stop_reason: res.stop_reason,
            refusal_category: res.stop_reason === "refusal" ? (res.stop_details?.category ?? null) : null,
            usage: res.usage,
          };
          return { response, costUsd: costFromUsage(res.usage) };
        } catch (err) {
          throw mapAnthropicError(err);
        }
      },
    });
  }

  async function extract<S extends z.ZodType>(input: ExtractInput<S>, ctx: CallContext): Promise<ProviderResult<ExtractResponse<z.infer<S>>>> {
    const maxTokens = input.maxTokens ?? 16_000;
    const responseSchema = z.object({
      data: input.schema.nullable(),
      stop_reason: z.string().nullable(),
      refusal_category: z.string().nullable().optional(),
      usage: UsageSchema,
    }) as unknown as z.ZodType<ExtractResponse<z.infer<S>>>;

    return provider.call<unknown, ExtractResponse<z.infer<S>>>({
      endpoint: `messages.parse:${input.schemaName}`,
      request: { model: ANTHROPIC_MODEL, system: input.system, messages: input.messages, max_tokens: maxTokens, effort: input.effort, schema: input.schemaName },
      ctx,
      schema: responseSchema,
      classify: (r) => classifyStop(r) ?? (r.data === null ? { reason: "parse_failed", message: "Claude returned no parseable structured output" } : null),
      async execute() {
        try {
          const res = await getSdk().messages.parse({
            model: ANTHROPIC_MODEL,
            max_tokens: maxTokens,
            ...(input.system ? { system: input.system } : {}),
            messages: input.messages,
            output_config: { format: zodOutputFormat(input.schema), ...(input.effort ? { effort: input.effort } : {}) },
          });
          const response: ExtractResponse<z.infer<S>> = {
            data: (res.parsed_output ?? null) as z.infer<S> | null,
            stop_reason: res.stop_reason,
            refusal_category: res.stop_reason === "refusal" ? (res.stop_details?.category ?? null) : null,
            usage: res.usage,
          };
          return { response, costUsd: costFromUsage(res.usage) };
        } catch (err) {
          throw mapAnthropicError(err);
        }
      },
    });
  }

  return { provider, complete, extract };
}
