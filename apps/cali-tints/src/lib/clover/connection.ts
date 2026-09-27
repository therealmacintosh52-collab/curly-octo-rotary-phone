import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { CloverConnection } from "@/lib/db/types";
import { CLOVER_HOSTS, cloverSecrets, type CloverEnv } from "./env";
import { decryptSecret, encryptSecret } from "./crypto";

/*
  "Sign in with Clover" (OAuth v2). The owner clicks Connect, logs in at
  Clover, and Clover sends back a code we swap for merchant-scoped tokens.
  Tokens live encrypted in clover_connections (service role only), are
  refreshed before they expire, and every successful API call bumps
  last_ok_at so the app can show a live connection state.

  Endpoint shapes follow Clover's published OAuth v2 docs; the first sandbox
  sign-in is the source of truth if anything differs.
*/

export interface CloverCredentials {
  env: CloverEnv;
  merchantId: string;
  merchantName: string | null;
  accessToken: string;
  /** Public (PAKMS) key for card entry in the app, fetched at connect time. */
  pakmsKey: string | null;
  status: CloverConnection["status"];
  lastOkAt: string | null;
  lastError: string | null;
  connectedAt: string;
}

interface TokenResponse {
  access_token: string;
  access_token_expiration?: number;
  refresh_token?: string;
  refresh_token_expiration?: number;
}

/** Cookie carrying the one-time OAuth state between /api/clover/connect and /callback. */
export const STATE_COOKIE = "ct_clover_state";

const CACHE_MS = 30_000;
const REFRESH_AHEAD_MS = 5 * 60_000;
const cache = new Map<string, { at: number; creds: CloverCredentials | null }>();

function tsFromClover(v: number | undefined): string | null {
  if (!v) return null;
  return new Date(v < 1e12 ? v * 1000 : v).toISOString(); // seconds or ms
}

function appCreds() {
  const s = cloverSecrets();
  if (!s.appId || !s.appSecret) throw new Error("Sign in with Clover needs CLOVER_APP_ID and CLOVER_APP_SECRET");
  return { appId: s.appId, appSecret: s.appSecret };
}

async function oauthPost<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = (json as { message?: string } | null)?.message ?? `Clover OAuth returned ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

/** Where to send the owner to sign in. `state` is checked on the way back. */
export function authorizeUrl(env: CloverEnv, redirectUri: string, state: string): string {
  const { appId } = appCreds();
  const u = new URL(CLOVER_HOSTS[env].authorize);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCode(env: CloverEnv, code: string): Promise<TokenResponse> {
  const { appId, appSecret } = appCreds();
  return oauthPost<TokenResponse>(`${CLOVER_HOSTS[env].token}/token`, { client_id: appId, client_secret: appSecret, code });
}

export async function refreshAccessToken(env: CloverEnv, refreshToken: string): Promise<TokenResponse> {
  const { appId } = appCreds();
  return oauthPost<TokenResponse>(`${CLOVER_HOSTS[env].token}/refresh`, { client_id: appId, refresh_token: refreshToken });
}

/** The card-entry public key for this merchant (so nobody has to copy it by hand). */
export async function fetchPakmsKey(env: CloverEnv, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${CLOVER_HOSTS[env].ecom}/pakms/apikey`, { headers: { accept: "application/json", authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { apiAccessKey?: string };
    return j.apiAccessKey ?? null;
  } catch {
    return null;
  }
}

function toCreds(row: CloverConnection): CloverCredentials {
  return {
    env: row.env,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    accessToken: decryptSecret(row.access_token_enc),
    pakmsKey: row.pakms_key,
    status: row.status,
    lastOkAt: row.last_ok_at,
    lastError: row.last_error,
    connectedAt: row.connected_at,
  };
}

/** Load (and if needed refresh) the company's Clover sign-in. Null when the company never signed in. */
export async function getCredentials(companyId: string): Promise<CloverCredentials | null> {
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.creds;
  const admin = createAdminClient();
  const { data: row } = await admin.from("clover_connections").select("*").eq("company_id", companyId).maybeSingle();
  if (!row) {
    cache.set(companyId, { at: Date.now(), creds: null });
    return null;
  }
  let current = row;
  const expiresAt = row.access_expires_at ? new Date(row.access_expires_at).getTime() : null;
  if (expiresAt && expiresAt - Date.now() < REFRESH_AHEAD_MS && row.refresh_token_enc) {
    try {
      const t = await refreshAccessToken(row.env, decryptSecret(row.refresh_token_enc));
      const patch = {
        access_token_enc: encryptSecret(t.access_token),
        refresh_token_enc: t.refresh_token ? encryptSecret(t.refresh_token) : row.refresh_token_enc,
        access_expires_at: tsFromClover(t.access_token_expiration),
        refresh_expires_at: tsFromClover(t.refresh_token_expiration) ?? row.refresh_expires_at,
        status: "ok" as const,
        last_error: null,
        updated_at: new Date().toISOString(),
      };
      const { data: updated } = await admin.from("clover_connections").update(patch).eq("company_id", companyId).select("*").single();
      if (updated) current = updated;
    } catch (err) {
      await admin.from("clover_connections").update({ status: "needs_reconnect", last_error: err instanceof Error ? err.message : "Token refresh failed", updated_at: new Date().toISOString() }).eq("company_id", companyId);
      current = { ...row, status: "needs_reconnect" };
    }
  }
  const creds = toCreds(current);
  cache.set(companyId, { at: Date.now(), creds });
  return creds;
}

export function forgetCredentials(companyId: string) {
  cache.delete(companyId);
}

/** Store a fresh sign-in and flip the company to "Clover on" with that merchant. */
export async function saveConnection(input: { companyId: string; env: CloverEnv; merchantId: string; merchantName: string | null; tokens: TokenResponse; pakmsKey: string | null; connectedBy: string | null }) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("clover_connections").upsert(
    {
      company_id: input.companyId,
      env: input.env,
      merchant_id: input.merchantId,
      merchant_name: input.merchantName,
      access_token_enc: encryptSecret(input.tokens.access_token),
      refresh_token_enc: input.tokens.refresh_token ? encryptSecret(input.tokens.refresh_token) : null,
      access_expires_at: tsFromClover(input.tokens.access_token_expiration),
      refresh_expires_at: tsFromClover(input.tokens.refresh_token_expiration),
      pakms_key: input.pakmsKey,
      status: "ok",
      last_ok_at: now,
      last_error: null,
      connected_by: input.connectedBy,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "company_id" },
  );
  if (error) throw new Error(error.message);
  await admin
    .from("companies")
    .update({ clover_enabled: true, clover_env: input.env, clover_merchant_id: input.merchantId, clover_merchant_name: input.merchantName, clover_connected_at: now, clover_verified_at: now })
    .eq("id", input.companyId);
  forgetCredentials(input.companyId);
}

export async function disconnectClover(companyId: string) {
  const admin = createAdminClient();
  await admin.from("clover_connections").delete().eq("company_id", companyId);
  await admin.from("companies").update({ clover_connected_at: null, clover_merchant_name: null }).eq("id", companyId);
  forgetCredentials(companyId);
}

/** Health bookkeeping: called after API calls succeed or fail with an auth error. */
export async function markConnection(companyId: string, ok: boolean, error?: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("clover_connections")
    .update(ok ? { status: "ok", last_ok_at: now, last_error: null, updated_at: now } : { status: "needs_reconnect", last_error: error ?? "Clover rejected the sign-in", updated_at: now })
    .eq("company_id", companyId);
  forgetCredentials(companyId);
}
