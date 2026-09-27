import "server-only";

import type { Company } from "@/lib/db/types";
import { cloverSecrets, cloverSignInAvailable, type CloverEnv } from "./env";
import { getCredentials } from "./connection";

/** Everything the UI needs to say "Clover is ready" (or what is missing), with no secrets. */
export interface CloverStatus {
  enabled: boolean;
  env: CloverEnv;
  merchantId: string | null;
  merchantName: string | null;
  /** The app is registered, so "Sign in with Clover" can run. */
  signInAvailable: boolean;
  /** Signed in with Clover (OAuth), as opposed to manual tokens. */
  connected: boolean;
  needsReconnect: boolean;
  lastOkAt: string | null;
  lastError: string | null;
  /** Something has proven the credentials work (a successful call, or Test connection). */
  healthy: boolean;
  /** Manual API tokens present in the environment. */
  manualTokens: boolean;
  /** Card entry in the app is possible (public key known). */
  cardEntry: boolean;
  device: boolean;
  hostedCheckout: boolean;
  webhook: boolean;
}

const HEALTHY_WINDOW_MS = 48 * 3600_000;

export async function cloverStatus(company: Company): Promise<CloverStatus> {
  const s = cloverSecrets();
  const creds = await getCredentials(company.id).catch(() => null);
  const connected = !!creds;
  const lastOkAt = creds?.lastOkAt ?? company.clover_verified_at ?? company.clover_last_sync_at;
  const recent = !!lastOkAt && Date.now() - new Date(lastOkAt).getTime() < HEALTHY_WINDOW_MS;
  const manualTokens = !!s.apiToken;
  return {
    enabled: company.clover_enabled,
    env: company.clover_env,
    merchantId: company.clover_merchant_id,
    merchantName: creds?.merchantName ?? company.clover_merchant_name,
    signInAvailable: cloverSignInAvailable(),
    connected,
    needsReconnect: creds?.status === "needs_reconnect",
    lastOkAt,
    lastError: creds?.lastError ?? null,
    healthy: connected ? creds.status === "ok" && recent : manualTokens && !!company.clover_merchant_id && recent,
    manualTokens,
    cardEntry: connected ? !!creds.pakmsKey : !!(s.ecomPublicKey && s.ecomPrivateToken),
    device: !!company.clover_device_id,
    hostedCheckout: company.clover_hosted_checkout,
    webhook: !!s.webhookSecret,
  };
}
