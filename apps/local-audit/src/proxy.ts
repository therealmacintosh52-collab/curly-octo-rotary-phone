import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Paths that never require a session.
 * - /r/<token>: the client report, authenticated by the share token inside the RPC.
 * - /api/inngest: Inngest signs its requests; cookie auth must not run here.
 */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/reset", "/no-access", "/api/inngest", "/r"];

function hasSupabaseEnv() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Refreshes the Supabase session cookie and gates the app: signed-out users go
 * to /login, signed-in users skip /login. Role checks (admin vs client) happen
 * in the /admin layout, not here.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!hasSupabaseEnv()) {
    return isPublic ? NextResponse.next({ request }) : NextResponse.redirect(new URL("/login?error=Supabase+is+not+configured", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the JWT against Supabase; getSession() would trust the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?)$).*)",
  ],
};
