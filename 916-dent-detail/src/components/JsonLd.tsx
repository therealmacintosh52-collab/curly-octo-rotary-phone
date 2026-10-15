import { jsonLdString, siteGraph } from '@/lib/seo/schema';

/* Sitewide graph: Organization (+sameAs) + AutoRepair/LocalBusiness service-area business + WebSite.
   No address, no aggregateRating (SPEC). Placeholder phone/email are omitted. Built in lib/seo/schema.ts. */
export function BusinessJsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(siteGraph()) }} />;
}

export function FaqJsonLd({ items }: { items: { q: string; a: string }[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
