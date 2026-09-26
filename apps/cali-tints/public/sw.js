/* Cali Tints service worker.
 *
 * Goals, in order:
 *   1. The job-entry screen opens with no signal (app shell cached).
 *   2. Never serve stale data when online (network-first for pages/RSC).
 *   3. Never cache API responses, server actions or Supabase traffic.
 *
 * Job data itself is queued in IndexedDB by the app (see src/lib/offline);
 * this worker only handles static assets and page shells.
 */
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const NAV_TIMEOUT_MS = 4000;

const PRECACHE = ["/offline", "/jobs/new", "/jobs/outbox", "/manifest.webmanifest", "/brand/logo.png", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(new Request(u, { credentials: "same-origin" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

/** Never intercept these: data, auth, actions, dev tooling. */
function isBypassed(url, request) {
  if (request.method !== "GET") return true;
  if (!isSameOrigin(url)) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/auth/")) return true;
  if (url.pathname.startsWith("/dev/")) return true;
  if (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.startsWith("/__nextjs")) return true;
  return false;
}

async function networkFirst(request, cacheName, { timeoutMs, fallbackUrl } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const response = await fetch(request, { signal: controller.signal });
    if (timer) clearTimeout(timer);
    if (response.ok && (response.type === "basic" || response.type === "default")) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw new Error("offline");
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (isBypassed(url, request)) return;

  // Hashed build assets: immutable, cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  // Icons, brand images, fonts.
  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/") || /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  // Full page loads: network first, cached shell if offline, /offline as last resort.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, { timeoutMs: NAV_TIMEOUT_MS, fallbackUrl: "/offline" }).catch(() => Response.error()));
    return;
  }
  // Client-side navigations fetch React Server Component payloads; same policy, no HTML fallback.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request, SHELL_CACHE, { timeoutMs: NAV_TIMEOUT_MS }).catch(() => Response.error()));
    return;
  }
  // Everything else goes straight to the network.
});
