import { z } from "zod";
import { createProvider, ProviderNotImplemented, type CallContext, type EnvLike, type ProviderResult } from "../core";
import type { SocialNetwork } from "@/lib/db/types";

/**
 * Social profile presence. No official API is used: the live implementation
 * (Phase 6) fetches the public profile page through the crawler worker,
 * identifies itself, respects robots.txt, and reads only what is public:
 * does the profile exist, when was the last visible post, follower count if
 * shown. Nothing is stored beyond those derived fields.
 */
export const SocialPresenceSchema = z.looseObject({
  network: z.string(),
  url: z.string(),
  exists: z.boolean(),
  last_activity_at: z.string().nullable().optional(),
  followers: z.number().nullable().optional(),
  checked_at: z.string().optional(),
});
export type SocialPresence = z.infer<typeof SocialPresenceSchema>;

export interface ProfilePresenceInput {
  network: SocialNetwork;
  /** Full profile URL or a bare handle. */
  urlOrHandle: string;
}

export function createSocialProvider(opts: { env?: EnvLike } = {}) {
  const provider = createProvider({
    name: "social",
    label: "Social profiles (public pages)",
    docsUrl: "docs/MASTER_PLAN.md#step-8",
    envKeys: [],
    timeoutMs: 20_000,
    defaultTtlSeconds: 7 * 24 * 3600,
    phase: "6",
    env: opts.env,
  });

  return {
    provider,
    profilePresence(input: ProfilePresenceInput, ctx: CallContext): Promise<ProviderResult<SocialPresence>> {
      return provider.call({
        endpoint: "profilePresence",
        request: input,
        ctx,
        schema: SocialPresenceSchema,
        async execute() {
          throw new ProviderNotImplemented("social", "profilePresence", "6");
        },
      });
    },
  };
}
