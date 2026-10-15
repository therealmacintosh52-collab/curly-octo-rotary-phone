// Service worker for /admin only (scope /admin). It never caches API responses or HTML of signed-in pages for reuse as
// "fresh" data: navigations are network-first and fall back to a tiny offline page; only static build assets and
// icons are cached. Customer data therefore never sits in a cache this worker controls.
export const dynamic = 'force-static';

const SW = `
const V = 'admin-v1';
const SHELL = ['/admin/offline'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(() => caches.match('/admin/offline').then((m) => m || new Response('Offline', { status: 503 }))));
    return;
  }
  if (u.pathname.startsWith('/_next/static/') || u.pathname.startsWith('/admin/icon-') || u.pathname.startsWith('/brand/')) {
    e.respondWith(caches.open(V).then((c) => c.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }))));
  }
});
`;

export function GET() {
  return new Response(SW, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Service-Worker-Allowed': '/admin', 'Cache-Control': 'no-cache' } });
}
