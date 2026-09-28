import { NextResponse, type NextRequest } from "next/server";
import { requireOwnerAdmin } from "@/lib/auth";
import { CLOVER_HOSTS, type CloverEnv } from "@/lib/clover/env";
import { STATE_COOKIE, exchangeCode, fetchPakmsKey, saveConnection } from "@/lib/clover/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 2 of "Sign in with Clover": Clover sends the owner back with a code; swap it for tokens and store them. */
export async function GET(request: NextRequest) {
  const session = await requireOwnerAdmin();
  const q = request.nextUrl.searchParams;
  const back = (query: string) => {
    const res = NextResponse.redirect(new URL(`/settings?${query}`, request.nextUrl.origin));
    res.cookies.set(STATE_COOKIE, "", { path: "/api/clover", maxAge: 0 });
    return res;
  };
  const fail = (msg: string) => back(`clover=error&msg=${encodeURIComponent(msg)}`);

  const cookie = request.cookies.get(STATE_COOKIE)?.value ?? "";
  const [state, envRaw] = cookie.split(".");
  const env: CloverEnv = envRaw === "production" ? "production" : "sandbox";
  if (!state || q.get("state") !== state) return fail("The sign-in link expired or did not match. Try Connect again.");
  const code = q.get("code");
  const merchantId = q.get("merchant_id");
  if (!code || !merchantId) return fail(q.get("error_description") ?? q.get("error") ?? "Clover did not return a sign-in code.");

  try {
    const tokens = await exchangeCode(env, code);
    let merchantName: string | null = null;
    try {
      const res = await fetch(`${CLOVER_HOSTS[env].api}/v3/merchants/${merchantId}`, { headers: { accept: "application/json", authorization: `Bearer ${tokens.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (res.ok) merchantName = ((await res.json()) as { name?: string }).name ?? null;
    } catch {
      /* the name is cosmetic */
    }
    const pakmsKey = await fetchPakmsKey(env, tokens.access_token);
    await saveConnection({ companyId: session.company.id, env, merchantId, merchantName, tokens, pakmsKey, connectedBy: session.userId });
    return back(`clover=connected&name=${encodeURIComponent(merchantName ?? merchantId)}`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not finish the Clover sign-in.");
  }
}
