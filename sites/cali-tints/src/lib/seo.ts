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
  for (const suffix of [` | ${S.short}`, ' | Sacramento', '']) {
    const candidate = base + suffix;
    if (candidate.length <= 60) return candidate;
  }
  return base.slice(0, 60);
}

/**
 * LocalBusiness entity. Window tinting has no schema.org subtype, so this is
 * `LocalBusiness` with `knowsAbout` and an offer catalog, per the blueprint's
 * "anything else" row. `AutoRepair` would be wrong for a tint and wrap shop.
 *
 * aggregateRating is deliberately ABSENT. A business marking up its own
 * reviews is self-serving structured data under Google's guidelines and risks
 * the rich result being dropped entirely. The rating is shown on-page in plain
 * text and linked to the Google listing that calculated it instead, and
 * scripts/audit.mjs fails the build if aggregateRating ever appears.
 */
export function localBusiness() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BASE}/#business`,
    name: S.name,
    url: `${BASE}/`,
    telephone: S.phone_link,
    ...(EMAIL_IS_PLACEHOLDER ? {} : { email: S.email }),
    image: abs('/assets/img/og-cover.jpg'),
    logo: abs('/assets/img/logo-800.png'),
    priceRange: '$$',
    slogan: S.promise,
    description:
      'Window tinting, vinyl wraps, paint protection film, ceramic coating and detailing shop ' +
      'on Fulton Avenue in Sacramento, California. Ceramic and carbon film installed to the ' +
      'California legal limit, colour-change and commercial wraps, paint correction, ' +
      'customization, dent removal, upholstery and inspections for cars, trucks, SUVs, ' +
      'motorcycles and fleets.',
    knowsAbout: [
      ...data.services.map((s) => s.nav),
      'Ceramic window film',
      'California window tint law (70% VLT front side windows)',
      'Colour-change vinyl wraps',
      'Commercial fleet wraps and vehicle lettering',
      'Paint correction and ceramic coating',
    ],
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
    knowsLanguage: ['en'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Window tinting, wraps, protection and detailing services',
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
