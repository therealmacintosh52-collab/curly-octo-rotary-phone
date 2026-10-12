import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, QuickBooksConnection } from "@/lib/db/types";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { QBO_AUTHORIZE_URL, QBO_REVOKE_URL, QBO_SCOPE, QBO_TOKEN_URL, QuickBooksNotConfigured, quickBooksSecrets, type QuickBooksEnv } from "./env";

/*
  Intuit OAuth 2.0. The owner clicks Connect, signs in at Intuit, picks the
  QuickBooks company, and Intuit sends back a code (plus the realmId: the
  QuickBooks company id). The code is swapped for an access token (1 hour)
  and a refresh token (about 100 days, rotated on every refresh). Both live
  encrypted in quickbooks_connections, readable by the service role only.
*/

type Db = SupabaseClient<Database>;

/** Cookie carrying the one-time OAuth state between /api/quickbooks/connect and /callback. */
export const STATE_COOKIE = "ct_qbo_state";
const SCOPE = "quickbooks";
const REFRESH_AHEAD_MS = 5 * 60_000;

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  x_refresh_token_expires_in: number; // seconds
  token_type?: string;
}

export interface QuickBooksCredentials {
  env: QuickBooksEnv;
  realmId: string;
  companyName: string | null;
  accessToken: string;
  status: QuickBooksConnection["status"];
  lastError: string | null;
  connectedAt: string;
}

function appCreds() {
  const s = quickBooksSecrets();
  if (!s.clientId || !s.clientSecret) throw new QuickBooksNotConfigured();
  return { clientId: s.clientId, clientSecret: s.clientSecret, env: s.env };
}

const enc = (plain: string) => encryptSecret(plain, appCreds().clientSecret, SCOPE);
const dec = (packed: string) => decryptSecret(packed, appCreds().clientSecret, SCOPE);
const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

/** Where to send the owner to sign in. `state` is checked on the way back. */
export function authorizeUrl(redirectUri: string, state: string, clientId = appCreds().clientId): string {
  const u = new URL(QBO_AUTHORIZE_URL);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", QBO_SCOPE);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenPost(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = appCreds();
  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const j = json as { error?: string; error_description?: string } | null;
    throw new Error(j?.error_description ?? j?.error ?? `Intuit returned ${res.status} from the token endpoint`);
  }
  return json as TokenResponse;
}

export const exchangeCode = (code: string, redirectUri: string) => tokenPost({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
export const refreshTokens = (refreshToken: string) => tokenPost({ grant_type: "refresh_token", refresh_token: refreshToken });

/** Store a fresh sign-in and mark the company as connected (name and realm are not secrets). */
export async function saveConnection(db: Db, input: { companyId: string; realmId: string; companyName: string | null; tokens: TokenResponse; connectedBy: string | null }) {
  const { env } = appCreds();
  const now = new Date().toISOString();
  const { error } = await db.from("quickbooks_connections").upsert(
    {
      company_id: input.companyId,
      realm_id: input.realmId,
      env,
      access_token_enc: enc(input.tokens.access_token),
      refresh_token_enc: enc(input.tokens.refresh_token),
      access_expires_at: inSeconds(input.tokens.expires_in),
      refresh_expires_at: inSeconds(input.tokens.x_refresh_token_expires_in),
      company_name: input.companyName,
      status: "ok",
      last_error: null,
      last_ok_at: now,
      connected_by: input.connectedBy,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "company_id" },
  );
  if (error) throw new Error(error.message);
  await db
    .from("companies")
    .update({ quickbooks_realm_id: input.realmId, quickbooks_company_name: input.companyName, quickbooks_env: env, quickbooks_connected_at: now, quickbooks_last_error: null })
    .eq("id", input.companyId);
}

/** Load the company's QuickBooks sign-in, refreshing the access token when it is about to expire. Null when never connected. */
export async function getCredentials(db: Db, companyId: string): Promise<QuickBooksCredentials | null> {
  const { data: row } = await db.from("quickbooks_connections").select("*").eq("company_id", companyId).maybeSingle();
  if (!row) return null;
  let current = row;
  const expiresAt = row.access_expires_at ? new Date(row.access_expires_at).getTime() : 0;
  if (expiresAt - Date.now() < REFRESH_AHEAD_MS) {
    try {
      const t = await refreshTokens(dec(row.refresh_token_enc));
      const patch = {
        access_token_enc: enc(t.access_token),
        refresh_token_enc: enc(t.refresh_token),
        access_expires_at: inSeconds(t.expires_in),
        refresh_expires_at: inSeconds(t.x_refresh_token_expires_in),
        status: "ok" as const,
        last_error: null,
        last_ok_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: updated } = await db.from("quickbooks_connections").update(patch).eq("company_id", companyId).select("*").single();
      if (updated) current = updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Token refresh failed";
      await db.from("quickbooks_connections").update({ status: "needs_reconnect", last_error: msg, updated_at: new Date().toISOString() }).eq("company_id", companyId);
      await db.from("companies").update({ quickbooks_last_error: `Reconnect QuickBooks: ${msg}` }).eq("id", companyId);
      current = { ...row, status: "needs_reconnect", last_error: msg };
    }
  }
  return {
    env: current.env as QuickBooksEnv,
    realmId: current.realm_id,
    companyName: current.company_name,
    accessToken: current.status === "ok" ? dec(current.access_token_enc) : "",
    status: current.status,
    lastError: current.last_error,
    connectedAt: current.connected_at,
  };
}

/** Health bookkeeping after an API call: a 401 means the owner has to reconnect. */
export async function markConnection(db: Db, companyId: string, ok: boolean, error?: string) {
  const now = new Date().toISOString();
  await db
    .from("quickbooks_connections")
    .update(ok ? { status: "ok", last_ok_at: now, last_error: null, updated_at: now } : { status: "needs_reconnect", last_error: error ?? "QuickBooks rejected the sign-in", updated_at: now })
    .eq("company_id", companyId);
}

/** Forget the sign-in (and tell Intuit so the refresh token dies). Invoices already in QuickBooks stay there. */
export async function disconnect(db: Db, companyId: string) {
  const { data: row } = await db.from("quickbooks_connections").select("refresh_token_enc").eq("company_id", companyId).maybeSingle();
  if (row) {
    try {
      const { clientId, clientSecret } = appCreds();
      await fetch(QBO_REVOKE_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
        body: JSON.stringify({ token: dec(row.refresh_token_enc) }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      /* best effort: the row goes either way */
    }
  }
  await db.from("quickbooks_connections").delete().eq("company_id", companyId);
  await db.from("companies").update({ quickbooks_realm_id: null, quickbooks_company_name: null, quickbooks_connected_at: null, quickbooks_last_error: null, quickbooks_item_id: null }).eq("id", companyId);
  await db.from("dealerships").update({ quickbooks_customer_id: null }).eq("company_id", companyId);
}
