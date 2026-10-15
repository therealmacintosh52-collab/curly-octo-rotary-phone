import { site } from '@/config/site';
import { cities, services } from '@/content/home';

/* Service-area business: no address. No aggregateRating (SPEC). Placeholder phone/email are omitted. */
export function BusinessJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': ['AutoRepair', 'LocalBusiness'],
    '@id': `${site.url}/#business`,
    name: site.name,
    slogan: site.tagline,
    description: site.description,
    url: site.url,
    image: `${site.url}/og-image.jpg`,
    logo: `${site.url}/brand/logo-transparent.png`,
    ...(site.phone.placeholder ? {} : { telephone: site.phone.e164 }),
    ...(site.email.placeholder ? {} : { email: site.email.address }),
    areaServed: cities.map((c) => ({ '@type': 'City', name: `${c.name}, CA` })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Mobile dent repair and detailing',
      itemListElement: services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.term, alternateName: s.plain, description: s.summary },
      })),
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
