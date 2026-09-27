import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { cloverSignInAvailable } from "@/lib/clover/env";
import { STATE_COOKIE, authorizeUrl } from "@/lib/clover/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 1 of "Sign in with Clover": send the owner to Clover's login, remembering a one-time state. */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const env = request.nextUrl.searchParams.get("env") === "production" ? "production" : "sandbox";
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?${q}`, request.nextUrl.origin));
  if (!cloverSignInAvailable()) return back("clover=error&msg=" + encodeURIComponent("Add CLOVER_APP_ID and CLOVER_APP_SECRET in Vercel first (see README → Clover)."));

  const state = randomBytes(16).toString("hex");
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const res = NextResponse.redirect(authorizeUrl(env, `${origin}/api/clover/callback`, state));
  res.cookies.set(STATE_COOKIE, `${state}.${env}`, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), path: "/api/clover", maxAge: 600 });
  return res;
}
