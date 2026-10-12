import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { quickBooksSecrets } from "@/lib/quickbooks/env";
import { STATE_COOKIE, exchangeCode, saveConnection } from "@/lib/quickbooks/connection";
import { QuickBooksClient } from "@/lib/quickbooks/client";
import { syncQuickBooks } from "@/lib/quickbooks/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Step 2 of Connect QuickBooks: Intuit sends the owner back with a code and the realm (company) id; swap it for tokens, store them, push what is waiting. */
export async function GET(request: NextRequest) {
  const session = await requireOwner();
  const q = request.nextUrl.searchParams;
  const back = (query: string) => {
    const res = NextResponse.redirect(new URL(`/settings?${query}`, request.nextUrl.origin));
    res.cookies.set(STATE_COOKIE, "", { path: "/api/quickbooks", maxAge: 0 });
    return res;
  };
  const fail = (msg: string) => back(`quickbooks=error&msg=${encodeURIComponent(msg)}`);

  const state = request.cookies.get(STATE_COOKIE)?.value ?? "";
  if (!state || q.get("state") !== state) return fail("The sign-in link expired or did not match. Try Connect again.");
  const code = q.get("code");
  const realmId = q.get("realmId");
  if (!code || !realmId) return fail(q.get("error_description") ?? q.get("error") ?? "Intuit did not return a sign-in code.");

  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  try {
    const tokens = await exchangeCode(code, `${origin}/api/quickbooks/callback`);
    let companyName: string | null = null;
    try {
      companyName = (await new QuickBooksClient(quickBooksSecrets().env, realmId, tokens.access_token).companyInfo()).CompanyName ?? null;
    } catch {
      /* the name is cosmetic */
    }
    const db = createAdminClient();
    await saveConnection(db, { companyId: session.company.id, realmId, companyName, tokens, connectedBy: session.userId });
    // Send what is already waiting (open invoices) so the books are current from minute one.
    const report = await syncQuickBooks(db, session.company.id).catch(() => null);
    const pushed = report?.pushed.length ?? 0;
    return back(`quickbooks=connected&name=${encodeURIComponent(companyName ?? realmId)}${pushed ? `&pushed=${pushed}` : ""}`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not finish the QuickBooks sign-in.");
  }
}
