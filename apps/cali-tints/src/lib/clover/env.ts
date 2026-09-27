import "server-only";

/**
 * Clover (Fiserv) configuration. Secrets live only in environment variables;
 * the merchant id and toggles live on the company row (readable by every
 * member, so nothing secret goes there).
 *
 * Tokens come from the merchant's Clover dashboard:
 *  - CLOVER_API_TOKEN          Settings → API tokens (Orders read/write, Payments read)
 *  - CLOVER_ECOM_PRIVATE_TOKEN Ecommerce API tokens, "Hosted iFrame + API/SDK" → private key
 *  - CLOVER_ECOM_PUBLIC_KEY    same screen → public (PAKMS) key, used by the card iframe
 *  - CLOVER_WEBHOOK_SECRET     any long random string; paste it as the hosted-checkout webhook secret
 */
export type CloverEnv = "sandbox" | "production";

export const CLOVER_HOSTS: Record<CloverEnv, { api: string; ecom: string; dashboard: string; sdk: string }> = {
  sandbox: { api: "https://sandbox.dev.clover.com", ecom: "https://scl-sandbox.dev.clover.com", dashboard: "https://sandbox.dev.clover.com", sdk: "https://checkout.sandbox.dev.clover.com/sdk.js" },
  production: { api: "https://api.clover.com", ecom: "https://scl.clover.com", dashboard: "https://www.clover.com", sdk: "https://checkout.clover.com/sdk.js" },
};

export interface CloverSecrets {
  apiToken: string | null;
  ecomPrivateToken: string | null;
  ecomPublicKey: string | null;
  webhookSecret: string | null;
}

export function cloverSecrets(): CloverSecrets {
  const v = (k: string) => process.env[k]?.trim() || null;
  return {
    apiToken: v("CLOVER_API_TOKEN"),
    ecomPrivateToken: v("CLOVER_ECOM_PRIVATE_TOKEN"),
    ecomPublicKey: v("CLOVER_ECOM_PUBLIC_KEY"),
    webhookSecret: v("CLOVER_WEBHOOK_SECRET"),
  };
}

/** Which env vars are present, for the Settings screen (names only, never values). */
export function cloverEnvStatus(): { key: string; set: boolean; purpose: string }[] {
  const s = cloverSecrets();
  return [
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
