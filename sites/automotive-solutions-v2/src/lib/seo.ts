import data from '../data/site.json';

const S = data.site;
export const BASE = S.base_url;
export const FULL_ADDRESS = `${S.street}, ${S.city}, ${S.region} ${S.zip}`;

/** True while the quote form still points at the placeholder inbox. */
export const EMAIL_IS_PLACEHOLDER =
  S.email.includes('REPLACE-ME') || S.email.endsWith('example.com');

export const abs = (path: string) => `${BASE}${path}`;

/** Titles must stay at or under 60 characters or Google truncates them. */
export function seoTitle(base: string): string {
  for (const suffix of [` | ${S.short}`, ' | Elk Grove', '']) {
    const candidate = base + suffix;
    if (candidate.length <= 60) return candidate;
  }
  return base.slice(0, 60);
}

/**
 * LocalBusiness entity. `AutoRepair` per the blueprint's niche table.
 *
 * aggregateRating is deliberately ABSENT. The blueprint's standards table asks
 * for it, but a business marking up its own reviews is self-serving structured
 * data under Google's guidelines and risks the rich result being dropped
 * entirely. The owner confirmed this call. The rating is shown on-page in plain
 * text and linked to the Google listing that calculated it instead, and
 * scripts/audit.mjs fails the build if aggregateRating ever appears.
 */
export function localBusiness() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': `${BASE}/#business`,
    name: S.name,
    alternateName: S.short,
    url: `${BASE}/`,
    telephone: S.phone_link,
    ...(EMAIL_IS_PLACEHOLDER ? {} : { email: S.email }),
    image: abs('/assets/img/og-cover.jpg'),
    logo: abs(S.logo),
    priceRange: '$$',
    foundingDate: S.founded_year,
    slogan: S.promise,
    description:
      'Family owned auto repair shop in Elk Grove, California, serving drivers since 2001. ' +
      'ASE certified technicians and a NAPA AutoCare Center, providing repair, service and ' +
      'maintenance on all makes and models of domestic and import vehicles.',
    knowsAbout: data.services.map((s) => s.nav),
    address: {
      '@type': 'PostalAddress',
      streetAddress: S.street,
      addressLocality: S.city,
      addressRegion: S.region,
      postalCode: S.zip,
      addressCountry: 'US',
    },
    geo: { '@type': 'GeoCoordinates', latitude: Number(S.lat), longitude: Number(S.lng) },
    sameAs: data.profiles,
    hasMap: data.maps_listing,
    openingHoursSpecification: S.hours_schema.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    areaServed: S.areas.map((a) => ({
      '@type': 'City',
      name: a,
      address: { '@type': 'PostalAddress', addressRegion: 'CA', addressCountry: 'US' },
    })),
    currenciesAccepted: 'USD',
    knowsLanguage: ['en', 'es'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Auto repair and maintenance services',
      itemListElement: data.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: s.nav,
          url: abs(`/services/${s.slug}/`),
        },
      })),
    },
  };
}

export function website() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: S.name,
    url: `${BASE}/`,
    inLanguage: 'en-US',
    publisher: { '@id': `${BASE}/#business` },
  };
}

export function serviceSchema(s: (typeof data.services)[number]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.h1,
    serviceType: s.nav,
    description: s.meta,
    url: abs(`/services/${s.slug}/`),
    provider: { '@id': `${BASE}/#business` },
    areaServed: S.areas.map((a) => ({ '@type': 'City', name: a })),
  };
}

export function faqPage(faqs: [string, string][]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export function breadcrumbs(trail: [string, string][]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, url], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: abs(url),
    })),
  };
}

export function article(g: (typeof data.guides)[number], path: string, iso: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.meta,
    inLanguage: 'en-US',
    datePublished: iso,
    dateModified: iso,
    author: { '@id': `${BASE}/#business` },
    publisher: { '@id': `${BASE}/#business` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(path) },
  };
}
