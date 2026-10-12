import "server-only";

/**
 * Clover Ecommerce (hosted checkout) configuration. Deposits online are a
 * flag: with DEPOSITS_ONLINE=none (the default) the app never calls Clover
 * and the shop takes deposits at drop-off. Keys live in the environment only.
 *
 * Checked 2026-10-12 against docs.clover.com (hosted-checkout-api,
 * creating-a-hosted-checkout-session, redirecting-customers, ecommerce-faqs):
 *  - the private key must come from a Hosted Checkout integration
 *    (merchant dashboard → Ecommerce); an "Iframe" or "API only" key is refused
 *  - it is sent as `Authorization: Bearer`, with `X-Clover-Merchant-Id`
 *  - sessions expire 15 minutes after creation; there is no GET for a session
 *  - the signed webhook is the system of record; a redirect proves nothing
 */
export type CloverEnv = "sandbox" | "production";

export const CLOVER_HOSTS: Record<CloverEnv, { ecom: string; api: string }> = {
  sandbox: { ecom: "https://scl-sandbox.dev.clover.com", api: "https://sandbox.dev.clover.com" },
  production: { ecom: "https://scl.clover.com", api: "https://api.clover.com" },
};

export interface CloverConfig {
  enabled: boolean;
  env: CloverEnv;
  merchantId: string | null;
  ecomPrivateKey: string | null;
  webhookSecret: string | null;
  apiToken: string | null;
}

export function cloverConfig(): CloverConfig {
  const v = (k: string) => process.env[k]?.trim() || null;
  const mode = (v("DEPOSITS_ONLINE") ?? "none").toLowerCase();
  return {
    enabled: mode === "clover",
    env: v("CLOVER_ENV") === "production" ? "production" : "sandbox",
    merchantId: v("CLOVER_MERCHANT_ID"),
    ecomPrivateKey: v("CLOVER_ECOM_PRIVATE_KEY"),
    webhookSecret: v("CLOVER_WEBHOOK_SECRET"),
    apiToken: v("CLOVER_API_TOKEN"),
  };
}

/** Deposits can be paid online only when the flag is on and the keys are present. */
export function depositsOnline(): boolean {
  const c = cloverConfig();
  return c.enabled && !!c.merchantId && !!c.ecomPrivateKey;
}

/** Which env vars are present, for the docs and the Settings hint (names only). */
export function cloverEnvStatus(): { key: string; set: boolean; purpose: string }[] {
  const c = cloverConfig();
  return [
    { key: "DEPOSITS_ONLINE", set: c.enabled, purpose: "clover turns online deposits on" },
    { key: "CLOVER_MERCHANT_ID", set: !!c.merchantId, purpose: "the merchant the deposits go to" },
    { key: "CLOVER_ECOM_PRIVATE_KEY", set: !!c.ecomPrivateKey, purpose: "Hosted Checkout private key" },
    { key: "CLOVER_WEBHOOK_SECRET", set: !!c.webhookSecret, purpose: "confirms a paid deposit" },
    { key: "CLOVER_API_TOKEN", set: !!c.apiToken, purpose: "optional: reconcile a missed webhook" },
  ];
}
