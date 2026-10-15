// PWA manifest scoped to /admin so "Add to Home Screen" installs the admin app (not the marketing site).
export const dynamic = 'force-static';

export function GET() {
  const body = {
    name: '916 Dent & Detail Admin', short_name: '916 Admin', description: 'Private team app: schedule, jobs, customers.',
    id: '/admin', start_url: '/admin/today', scope: '/admin/', display: 'standalone', orientation: 'portrait',
    background_color: '#0B0B0C', theme_color: '#0B0B0C',
    icons: [
      { src: '/admin/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/admin/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/admin/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Today', url: '/admin/today' }, { name: 'Pipeline', url: '/admin/pipeline' }, { name: 'Schedule', url: '/admin/schedule' }],
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } });
}
