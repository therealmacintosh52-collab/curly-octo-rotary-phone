import type { EnvLike, ProviderMode } from "./types";

const MODES: ProviderMode[] = ["mock", "record", "live"];

/**
 * PROVIDER_MODE decides whether adapters read fixtures (mock), call the API and
 * write fixtures (record), or just call the API (live). Tests default to mock;
 * everything else defaults to live. Record refuses in production.
 */
export function providerMode(env: EnvLike = process.env): ProviderMode {
  const raw = env.PROVIDER_MODE?.trim().toLowerCase();
  if (raw && (MODES as string[]).includes(raw)) {
    if (raw === "record" && env.NODE_ENV === "production") return "live";
    return raw as ProviderMode;
  }
  if (env.NODE_ENV === "test" || env.VITEST) return "mock";
  return "live";
}
