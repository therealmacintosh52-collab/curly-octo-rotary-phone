// JSON-LD builders. Rules (SPEC Phase 6 + hard gates):
//  - service-area business: NEVER a street address / PostalAddress
//  - NEVER aggregateRating or Review (no self-serving ratings; no invented reviews)
//  - telephone/email only when the config value is not a placeholder
//  - Offer price only from config/pricing.ts, and only when it is a real number
import { site } from '@/config/site';
import { serviceFromPrice } from '@/config/pricing';
import type { CityDoc, Faq, ServiceDoc } from '@/content/seo/types';
import { allCities } from './content';
import { absoluteUrl, siteOrigin } from './url';

export const BUSINESS_ID = `${siteOrigin}/#business`;
export const ORG_ID = `${siteOrigin}/#organization`;
export const WEBSITE_ID = `${siteOrigin}/#website`;

const ctx = 'https://schema.org';

/** Non-empty social profile URLs from config (empties are skipped). */
export function sameAs(): string[] {
  return Object.values(site.social as Record<string, string>).filter((u) => typeof u === 'string' && u.trim() !== '');
}

const cityRef = (name: string) => ({ '@type': 'City', name: `${name}, CA` });

export function organizationNode() {
  const links = sameAs();
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: site.name,
    url: siteOrigin,
    logo: absoluteUrl('/brand/logo-transparent.png'),
    slogan: site.tagline,
    ...(links.length ? { sameAs: links } : {}),
    ...(site.phone.placeholder ? {} : { telephone: site.phone.e164 }),
    ...(site.email.placeholder ? {} : { email: site.email.address }),
  };
}

export function businessNode() {
  const links = sameAs();
  return {
    '@type': ['AutoRepair', 'LocalBusiness'],
    '@id': BUSINESS_ID,
    name: site.name,
    slogan: site.tagline,
    description: site.description,
    url: siteOrigin,
    image: absoluteUrl('/og-image.jpg'),
    logo: absoluteUrl('/brand/logo-transparent.png'),
    parentOrganization: { '@id': ORG_ID },
    ...(site.phone.placeholder ? {} : { telephone: site.phone.e164 }),
    ...(site.email.placeholder ? {} : { email: site.email.address }),
    ...(links.length ? { sameAs: links } : {}),
    // Service-area business: areaServed only, no address, no geo pin.
    areaServed: allCities.map((c) => cityRef(c.name)),
  };
}

export function websiteNode() {
  return { '@type': 'WebSite', '@id': WEBSITE_ID, url: siteOrigin, name: site.name, publisher: { '@id': ORG_ID } };
}

/** Sitewide graph rendered once in the layout. */
export function siteGraph() {
  return { '@context': ctx, '@graph': [organizationNode(), businessNode(), websiteNode()] };
}

export type Crumb = { name: string; path: string };

export function breadcrumbSchema(items: Crumb[]) {
  return {
    '@context': ctx,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
  };
}

export function faqSchema(items: Faq[]) {
  return {
    '@context': ctx,
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

/** Service + Offer. The Offer exists only when config has a real "from" price; otherwise it is omitted entirely. */
export function serviceSchema(doc: ServiceDoc) {
  const price = doc.priceKey ? serviceFromPrice[doc.priceKey] ?? null : null;
  const url = absoluteUrl(`/services/${doc.slug}`);
  return {
    '@context': ctx,
    '@type': 'Service',
    '@id': `${url}#service`,
    name: doc.term,
    alternateName: doc.plain,
    serviceType: doc.term,
    description: doc.description,
    url,
    provider: { '@id': BUSINESS_ID },
    areaServed: allCities.map((c) => cityRef(c.name)),
    ...(price !== null
      ? { offers: { '@type': 'Offer', url, priceCurrency: 'USD', priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'USD', minPrice: price }, availability: 'https://schema.org/InStock' } }
      : {}),
  };
}

export function cityServiceSchema(city: CityDoc) {
  const url = absoluteUrl(`/areas/${city.slug}`);
  return {
    '@context': ctx,
    '@type': 'Service',
    '@id': `${url}#service`,
    name: `Mobile dent repair and detailing in ${city.name}`,
    serviceType: 'Mobile paintless dent repair and auto detailing',
    description: city.description,
    url,
    provider: { '@id': BUSINESS_ID },
    areaServed: cityRef(city.name),
  };
}

export type ArticleInput = { slug: string; title: string; description: string; date: string; updated?: string };

export function articleSchema(p: ArticleInput) {
  const url = absoluteUrl(`/blog/${p.slug}`);
  return {
    '@context': ctx,
    '@type': 'Article',
    headline: p.title,
    description: p.description,
    datePublished: p.date,
    dateModified: p.updated ?? p.date,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    image: [`${url}/opengraph-image`],
    author: { '@type': 'Organization', '@id': ORG_ID, name: site.name, url: siteOrigin },
    publisher: { '@type': 'Organization', '@id': ORG_ID, name: site.name, logo: { '@type': 'ImageObject', url: absoluteUrl('/brand/logo-transparent.png') } },
  };
}

export function itemListSchema(name: string, items: { name: string; path: string }[]) {
  return {
    '@context': ctx,
    '@type': 'ItemList',
    name,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: absoluteUrl(it.path) })),
  };
}

export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
