import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { quickBooksConfigured } from "@/lib/quickbooks/env";
import { STATE_COOKIE, authorizeUrl } from "@/lib/quickbooks/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 1 of Connect QuickBooks: send the owner to Intuit's sign-in, remembering a one-time state. */
export async function GET(request: NextRequest) {
  await requireOwner();
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?${q}`, request.nextUrl.origin));
  if (!quickBooksConfigured()) return back("quickbooks=error&msg=" + encodeURIComponent("Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in Vercel first (see README → QuickBooks Online)."));

  const state = randomBytes(16).toString("hex");
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const res = NextResponse.redirect(authorizeUrl(`${origin}/api/quickbooks/callback`, state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), path: "/api/quickbooks", maxAge: 600 });
  return res;
}
