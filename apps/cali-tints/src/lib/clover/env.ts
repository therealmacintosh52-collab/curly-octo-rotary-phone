import "server-only";

/**
 * Clover (Fiserv) configuration.
 *
 * The easy path is "Sign in with Clover": the owner clicks Connect, logs in at
 * Clover, and the app receives merchant-scoped OAuth tokens (stored encrypted,
 * refreshed automatically). That needs one app registered in the Clover
 * developer dashboard:
 *  - CLOVER_APP_ID / CLOVER_APP_SECRET   Developer dashboard → your app → App ID / App secret
 *
 * Manual API tokens still work as a fallback (or for a merchant that cannot
 * install apps), all from the merchant dashboard:
 *  - CLOVER_API_TOKEN          Settings → API tokens (Orders read/write, Payments read/write)
 *  - CLOVER_ECOM_PRIVATE_TOKEN Ecommerce API tokens, "Hosted iFrame + API/SDK" → private key
 *  - CLOVER_ECOM_PUBLIC_KEY    same screen → public (PAKMS) key, used by the card iframe
 *  - CLOVER_WEBHOOK_SECRET     any long random string; paste it as the hosted-checkout webhook secret
 *
 * The merchant id and toggles live on the company row (readable by every
 * member, so nothing secret goes there).
 */
export type CloverEnv = "sandbox" | "production";

export const CLOVER_HOSTS: Record<CloverEnv, { api: string; ecom: string; dashboard: string; sdk: string; authorize: string; token: string }> = {
  sandbox: {
    api: "https://sandbox.dev.clover.com",
    ecom: "https://scl-sandbox.dev.clover.com",
    dashboard: "https://sandbox.dev.clover.com",
    sdk: "https://checkout.sandbox.dev.clover.com/sdk.js",
    authorize: "https://sandbox.dev.clover.com/oauth/v2/authorize",
    token: "https://apisandbox.dev.clover.com/oauth/v2",
  },
  production: {
    api: "https://api.clover.com",
    ecom: "https://scl.clover.com",
    dashboard: "https://www.clover.com",
    sdk: "https://checkout.clover.com/sdk.js",
    authorize: "https://www.clover.com/oauth/v2/authorize",
    token: "https://api.clover.com/oauth/v2",
  },
};

export interface CloverSecrets {
  appId: string | null;
  appSecret: string | null;
  apiToken: string | null;
  ecomPrivateToken: string | null;
  ecomPublicKey: string | null;
  webhookSecret: string | null;
}

export function cloverSecrets(): CloverSecrets {
  const v = (k: string) => process.env[k]?.trim() || null;
  return {
    appId: v("CLOVER_APP_ID"),
    appSecret: v("CLOVER_APP_SECRET"),
    apiToken: v("CLOVER_API_TOKEN"),
    ecomPrivateToken: v("CLOVER_ECOM_PRIVATE_TOKEN"),
    ecomPublicKey: v("CLOVER_ECOM_PUBLIC_KEY"),
    webhookSecret: v("CLOVER_WEBHOOK_SECRET"),
  };
}

/** True when "Sign in with Clover" can run (the app is registered). */
export function cloverSignInAvailable(): boolean {
  const s = cloverSecrets();
  return !!(s.appId && s.appSecret);
}

/** Which env vars are present, for the Settings screen (names only, never values). */
export function cloverEnvStatus(): { key: string; set: boolean; purpose: string }[] {
  const s = cloverSecrets();
  return [
    { key: "CLOVER_APP_ID", set: !!s.appId, purpose: "Sign in with Clover" },
    { key: "CLOVER_APP_SECRET", set: !!s.appSecret, purpose: "Sign in with Clover" },
    { key: "CLOVER_API_TOKEN", set: !!s.apiToken, purpose: "orders and payment sync" },
    { key: "CLOVER_ECOM_PRIVATE_TOKEN", set: !!s.ecomPrivateToken, purpose: "pay links and card charges" },
    { key: "CLOVER_ECOM_PUBLIC_KEY", set: !!s.ecomPublicKey, purpose: "card entry in the app" },
    { key: "CLOVER_WEBHOOK_SECRET", set: !!s.webhookSecret, purpose: "pay-link confirmations" },
  ];
}

export class CloverNotConfigured extends Error {
  constructor(what: string) {
    super(`Clover is not configured for ${what}. Set the token in your hosting environment (see Settings → Clover).`);
    this.name = "CloverNotConfigured";
  }
}
