// Legacy / common-guess URL -> canonical URL map (301). Additive: next.config.ts spreads this into redirects().
// Keep sources lowercase, without trailing slash. Never redirect a path that is a real route.
// Phase 6 owns this file; other phases add rows by appending to `extra`.
import { allCities, allServices } from '../lib/seo/content';

type Row = { source: string; destination: string };

const serviceAliases: Record<string, string[]> = {
  'paintless-dent-repair': ['pdr', 'dent-repair', 'dent-removal', 'mobile-dent-repair', 'paintless-dent-removal', 'dent-repair-sacramento'],
  'door-ding-repair': ['door-dings', 'door-ding', 'ding-repair', 'door-dent-repair'],
  'hail-damage-repair': ['hail', 'hail-repair', 'hail-damage', 'hail-dent-repair'],
  'mobile-detailing': ['detailing', 'auto-detailing', 'car-detailing', 'mobile-car-detailing', 'detail'],
  'interior-detailing': ['interior', 'interior-detail', 'interior-cleaning'],
  'paint-correction': ['polish', 'polishing', 'paint-polish', 'swirl-removal', 'scratch-removal'],
  'ceramic-coating': ['ceramic', 'coating', 'ceramic-coatings', 'paint-protection'],
  'headlight-restoration': ['headlights', 'headlight-cleaning', 'headlight-restore'],
  'dealership-recon': ['recon', 'dealer-recon', 'dealership-services', 'dealer-services'],
};

const rows: Row[] = [];

for (const s of allServices) {
  for (const alias of serviceAliases[s.slug] ?? []) rows.push({ source: `/${alias}`, destination: `/services/${s.slug}` });
  rows.push({ source: `/service/${s.slug}`, destination: `/services/${s.slug}` });
}

for (const c of allCities) {
  rows.push({ source: `/${c.slug}`, destination: `/areas/${c.slug}` });
  rows.push({ source: `/dent-repair-${c.slug}`, destination: `/areas/${c.slug}` });
  rows.push({ source: `/${c.slug}-ca`, destination: `/areas/${c.slug}` });
  rows.push({ source: `/locations/${c.slug}`, destination: `/areas/${c.slug}` });
  rows.push({ source: `/service-areas/${c.slug}`, destination: `/areas/${c.slug}` });
}

const generic: Row[] = [
  { source: '/locations', destination: '/areas' },
  { source: '/service-area', destination: '/areas' },
  { source: '/service-areas', destination: '/areas' },
  { source: '/areas-served', destination: '/areas' },
  { source: '/cities', destination: '/areas' },
  { source: '/quote', destination: '/book' },
  { source: '/get-quote', destination: '/book' },
  { source: '/free-quote', destination: '/book' },
  { source: '/estimate', destination: '/book' },
  { source: '/request-quote', destination: '/book' },
  { source: '/booking', destination: '/book' },
  { source: '/book-now', destination: '/book' },
  { source: '/appointments', destination: '/book' },
  { source: '/schedule', destination: '/book' },
  { source: '/contact', destination: '/book' },
  { source: '/contact-us', destination: '/book' },
  { source: '/prices', destination: '/pricing' },
  { source: '/price', destination: '/pricing' },
  { source: '/rates', destination: '/pricing' },
  { source: '/memberships', destination: '/pricing' },
  { source: '/testimonials', destination: '/reviews' },
  { source: '/fleet', destination: '/dealers' },
  { source: '/fleets', destination: '/dealers' },
  { source: '/commercial', destination: '/dealers' },
  { source: '/b2b', destination: '/dealers' },
  { source: '/about', destination: '/' },
  { source: '/about-us', destination: '/' },
  { source: '/home', destination: '/' },
  { source: '/index.html', destination: '/' },
  { source: '/blogs', destination: '/blog' },
  { source: '/news', destination: '/blog' },
  { source: '/articles', destination: '/blog' },
  { source: '/feed', destination: '/blog/rss.xml' },
  { source: '/feed.xml', destination: '/blog/rss.xml' },
  { source: '/rss', destination: '/blog/rss.xml' },
  { source: '/rss.xml', destination: '/blog/rss.xml' },
  { source: '/sitemap_index.xml', destination: '/sitemap.xml' },
];

/** Rows other phases may append (source -> destination). */
const extra: Row[] = [];

const seen = new Set<string>();
export const redirectMap: Row[] = [...rows, ...generic, ...extra].filter((r) => {
  if (r.source === r.destination || seen.has(r.source)) return false;
  seen.add(r.source);
  return true;
});
