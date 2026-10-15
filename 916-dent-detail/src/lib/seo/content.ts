// Single access point for Phase 6 content (services, cities). Pure data, safe in server components.
import { serviceDocs } from '../../content/seo/services/index.ts';
import { cityDocs } from '../../content/seo/cities/index.ts';
import type { CityDoc, ServiceDoc } from '../../content/seo/types';

export const allServices: readonly ServiceDoc[] = serviceDocs;
export const allCities: readonly CityDoc[] = cityDocs;

export const getService = (slug: string) => serviceDocs.find((s) => s.slug === slug);
export const getCity = (slug: string) => cityDocs.find((c) => c.slug === slug);

export const servicePath = (slug: string) => `/services/${slug}`;
export const cityPath = (slug: string) => `/areas/${slug}`;
export const blogPath = (slug: string) => `/blog/${slug}`;

export function mustService(slug: string): ServiceDoc {
  const s = getService(slug);
  if (!s) throw new Error(`Unknown service slug "${slug}"`);
  return s;
}
export function mustCity(slug: string): CityDoc {
  const c = getCity(slug);
  if (!c) throw new Error(`Unknown city slug "${slug}"`);
  return c;
}

/** Phase 1 home-page service ids -> the new spoke page that covers them. */
const legacyServiceMap: Record<string, string> = {
  pdr: 'paintless-dent-repair',
  hail: 'hail-damage-repair',
  'paint-correction': 'paint-correction',
  ceramic: 'ceramic-coating',
  decon: 'paint-correction',
  interior: 'interior-detailing',
};
export const serviceHrefForLegacyId = (id: string) => servicePath(legacyServiceMap[id] ?? 'paintless-dent-repair');
