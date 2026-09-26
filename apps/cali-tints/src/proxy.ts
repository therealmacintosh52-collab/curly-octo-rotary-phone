import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";
import { DEMO_COOKIE, DEMO_COOKIE_MAX_AGE, demoKey, demoRewriteTarget, isDemoCookieValid, safeEqual } from "@/lib/demo";

/** Paths that never require a session. */
const PUBLIC_PATHS = ["/login", "/offline", "/manifest.webmanifest", "/sw.js", "/auth/callback", "/auth/reset", "/demo"];

function hasSupabaseEnv() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * 1. Guest demo mode (secret link, no login, fixture data) when DEMO_ACCESS_KEY is set.
 * 2. Otherwise refresh the Supabase session cookie and gate the app:
 *    signed-out users go to /login, signed-in users skip /login.
 * Role checks happen in the (app) layout and per page, not here.
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const key = demoKey();

  // --- Guest demo mode -------------------------------------------------------
  if (key) {
    // Secret link: /demo?key=… sets the cookie and lands on the dashboard preview.
    if (pathname === "/demo" && searchParams.get("key")) {
      const url = request.nextUrl.clone();
      url.search = "";
      if (safeEqual(searchParams.get("key") ?? "", key)) {
        url.pathname = "/";
        const res = NextResponse.redirect(url);
        res.cookies.set(DEMO_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: DEMO_COOKIE_MAX_AGE });
        return res;
      }
      url.pathname = "/demo";
      url.searchParams.set("error", "1");
      return NextResponse.redirect(url);
    }

    const guest = isDemoCookieValid(request.cookies.get(DEMO_COOKIE)?.value);
    if (guest) {
      const target = demoRewriteTarget(pathname);
      const res = target ? NextResponse.rewrite(new URL(target, request.url)) : NextResponse.next({ request });
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    // Not a guest: previews and app routes are off limits; only the key page (and the real login if configured) remain.
    if (pathname.startsWith("/dev/")) {
      return NextResponse.redirect(new URL("/demo", request.url));
    }
    if (!hasSupabaseEnv() && pathname !== "/demo" && pathname !== "/offline") {
      return NextResponse.redirect(new URL("/demo", request.url));
    }
  } else if (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/")) {
    // Local development: fixture previews are always open.
    return NextResponse.next({ request });
  }

  // --- Real app --------------------------------------------------------------
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
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, images, icons and the service worker.
    "/((?!_next/static|_next/image|favicon.ico|icons/|brand/|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?)$).*)",
  ],
};
