import data from '../data/site.json';

export const site = data.site;
export const services = data.services;
export const guides = data.guides;
export const reviews = data.reviews;
export const homeFaqs = data.home_faqs as [string, string][];
export const nav = data.nav as [string, string][];
export const icons = data.icons as Record<string, string>;
export const mapsDirections = data.maps_directions as string;
export const formEndpoint = data.form_endpoint as string;
export const fullAddress = data.full_address as string;
export const profiles = (data as any).profiles as string[] | undefined;
export const mapsListing = (data as any).maps_listing as string;
export const mapsEmbed = (data as any).maps_embed as string;
export const yelpUrl = (data as any).yelp_url as string;
export const areaNotes = (data as any).area_notes as Record<string, string>;
export const hoursRows = site.hours_rows as [string, string][];

import { extraGuides } from '../data/guides-v2';
/** Guides from v1 plus the two written for v2, in display order. */
export const allGuides: any[] = [...guides, ...extraGuides];

export const BASE = site.base_url as string;

export function seoTitle(base: string) {
  const t = `${base} | ${site.short}`;
  return t.length <= 60 ? t : base;
}

export function localBusiness() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': `${BASE}/#business`,
    name: site.name,
    url: `${BASE}/`,
    telephone: site.phone_link,
    email: site.email,
    image: `${BASE}/assets/img/og-cover.png`,
    logo: `${BASE}${site.logo}`,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.street,
      addressLocality: site.city,
      addressRegion: site.region,
      postalCode: site.zip,
      addressCountry: 'US',
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.lat, longitude: site.lng },
    openingHoursSpecification: (site.hours_schema as any[]).map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    areaServed: (site.areas as string[]).map((a) => ({ '@type': 'City', name: a })),
    sameAs: profiles ?? [],
    description: `Independent auto, diesel and fleet repair shop in Lodi, CA. Diagnosis before parts, a written quote before any work, no upsells. Cars, light trucks, diesel pickups and commercial fleet vehicles.`,
    slogan: 'Diagnosis first. Quote before work. No upsells.',
    currenciesAccepted: 'USD',
    knowsLanguage: ['en', 'es'],
    knowsAbout: [
      ...services.map((s: any) => s.nav),
      'Check engine light diagnosis',
      'Diesel emissions (DPF, EGR) faults',
      'Preventive maintenance programs for commercial fleets',
      'Second opinions on repair estimates',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Auto, diesel and fleet repair services',
      itemListElement: services.map((s: any) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.nav, url: `${BASE}/services/${s.slug}/` },
      })),
    },
  };
}

export function website() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: `${BASE}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE}/services/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumb(trail: [string, string][]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${BASE}${path}`,
    })),
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

export function serviceSchema(s: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.nav,
    serviceType: s.nav,
    description: s.meta,
    url: `${BASE}/services/${s.slug}/`,
    provider: { '@id': `${BASE}/#business` },
    areaServed: (site.areas as string[]).map((a) => ({ '@type': 'City', name: a })),
    availableChannel: {
      '@type': 'ServiceChannel',
      servicePhone: { '@type': 'ContactPoint', telephone: site.phone_link, contactType: 'customer service', availableLanguage: ['en', 'es'] },
      serviceUrl: `${BASE}/contact/#quote`,
    },
    hoursAvailable: (site.hours_schema as any[]).map((h) => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes,
    })),
  };
}

export function article(g: any, path: string, modified: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.meta,
    url: `${BASE}${path}`,
    dateModified: modified,
    author: { '@type': 'Organization', name: site.name },
    publisher: { '@id': `${BASE}/#business` },
  };
}

/** Real reviews only. AggregateRating uses the figure from the Google profile. */
export function aggregateRating() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': `${BASE}/#business`,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: site.rating,
      reviewCount: site.review_count,
      bestRating: '5',
    },
    review: reviews.map((r: any) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.name },
      reviewBody: r.quote,
      publisher: { '@type': 'Organization', name: r.source },
    })),
  };
}
