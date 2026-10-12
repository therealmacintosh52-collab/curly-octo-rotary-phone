import "server-only";

/**
 * QuickBooks Online (Intuit) configuration.
 *
 * One app in the Intuit Developer portal (developer.intuit.com) gives:
 *  - QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET  Keys & credentials → Development (sandbox) or Production
 *  - QUICKBOOKS_ENV                                   "sandbox" while testing against a sandbox company, "production" for the real books
 * The redirect URI to register is `${NEXT_PUBLIC_APP_URL}/api/quickbooks/callback`.
 * Tokens are stored encrypted (src/lib/crypto.ts) with the client secret as the key.
 */
export type QuickBooksEnv = "sandbox" | "production";

export const QBO_SCOPE = "com.intuit.quickbooks.accounting";
/** Intuit's API version pin: new fields arrive behind a minor version. */
export const QBO_MINOR_VERSION = 75;

export const QBO_HOSTS: Record<QuickBooksEnv, { api: string; app: string }> = {
  sandbox: { api: "https://sandbox-quickbooks.api.intuit.com", app: "https://app.sandbox.qbo.intuit.com" },
  production: { api: "https://quickbooks.api.intuit.com", app: "https://app.qbo.intuit.com" },
};
export const QBO_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
export const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QBO_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

export interface QuickBooksSecrets {
  clientId: string | null;
  clientSecret: string | null;
  env: QuickBooksEnv;
}

export function quickBooksSecrets(): QuickBooksSecrets {
  const v = (k: string) => process.env[k]?.trim() || null;
  return {
    clientId: v("QUICKBOOKS_CLIENT_ID"),
    clientSecret: v("QUICKBOOKS_CLIENT_SECRET"),
    env: v("QUICKBOOKS_ENV") === "sandbox" ? "sandbox" : "production",
  };
}

/** True when Connect can run (the Intuit app keys are set). */
export function quickBooksConfigured(): boolean {
  const s = quickBooksSecrets();
  return !!(s.clientId && s.clientSecret);
}

export class QuickBooksNotConfigured extends Error {
  constructor() {
    super("QuickBooks is not configured: set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in your hosting environment (see README → QuickBooks Online).");
    this.name = "QuickBooksNotConfigured";
  }
}
