import { providerMode, type EnvLike, type ProviderStatus, type SnapshotStore } from "./core";
import { createAnthropicProvider } from "./anthropic/client";
import { createGooglePlacesProvider } from "./google-places/client";
import { createPagespeedProvider } from "./pagespeed/client";
import { createDataForSeoProvider } from "./dataforseo/client";
import { createYelpProvider } from "./yelp/client";
import { createSocialProvider } from "./social/client";
import { createWebsiteProvider } from "./website/client";

export * from "./core";
export { createAnthropicProvider, type CompleteInput, type ExtractInput, type Effort } from "./anthropic/client";
export { ANTHROPIC_MODEL, costFromUsage } from "./anthropic/pricing";
export { createGooglePlacesProvider } from "./google-places/client";
export { createPagespeedProvider } from "./pagespeed/client";
export { createDataForSeoProvider } from "./dataforseo/client";
export { createYelpProvider } from "./yelp/client";
export { createSocialProvider } from "./social/client";
export { createWebsiteProvider } from "./website/client";

/** Every adapter, built once per call site (they hold no connections). */
export function createProviders(opts: { env?: EnvLike } = {}) {
  return {
    anthropic: createAnthropicProvider(opts),
    googlePlaces: createGooglePlacesProvider(opts),
    pagespeed: createPagespeedProvider(opts),
    dataforseo: createDataForSeoProvider(opts),
    yelp: createYelpProvider(opts),
    social: createSocialProvider(opts),
    website: createWebsiteProvider(opts),
  };
}
export type Providers = ReturnType<typeof createProviders>;

function envStatus(env: EnvLike, keys: string[]) {
  return keys.map((key) => ({ key, set: !!env[key]?.trim() }));
}

/**
 * What is wired, as booleans only. Feeds /admin/settings/providers. Includes
 * the two platform services so the page is the one place to check the setup.
 */
export function providerStatus(env: EnvLike = process.env): ProviderStatus[] {
  const p = createProviders({ env });
  const mode = providerMode(env);
  const supabaseKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const inngestKeys = ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"];
  return [
    {
      name: "supabase",
      label: "Supabase (database, auth, storage)",
      docsUrl: "https://supabase.com/dashboard",
      envKeys: envStatus(env, supabaseKeys),
      configured: supabaseKeys.every((k) => !!env[k]?.trim()),
      mode,
      phase: "0",
    },
    {
      name: "inngest",
      label: "Inngest (audit jobs)",
      docsUrl: "https://app.inngest.com",
      envKeys: envStatus(env, inngestKeys),
      // The dev server needs no keys; production does.
      configured: env.NODE_ENV !== "production" || inngestKeys.every((k) => !!env[k]?.trim()),
      mode,
      phase: "0",
    },
    p.anthropic.provider.status(),
    p.googlePlaces.provider.status(),
    p.pagespeed.provider.status(),
    p.dataforseo.provider.status(),
    p.yelp.provider.status(),
    p.social.provider.status(),
    p.website.provider.status(),
  ];
}

export function sumAuditCost(store: SnapshotStore, auditId: string): Promise<number> {
  return store.sumCost(auditId);
}
