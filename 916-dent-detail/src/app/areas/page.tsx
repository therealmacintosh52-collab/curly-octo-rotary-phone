import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { CtaBand, SeoHero } from '@/components/seo/PageParts';
import { QuoteLink } from '@/components/CtaLinks';
import { allCities, cityPath } from '@/lib/seo/content';
import { pageMetadata } from '@/lib/seo/metadata';
import { itemListSchema } from '@/lib/seo/schema';
import { site } from '@/config/site';

export const metadata: Metadata = pageMetadata({
  title: 'Mobile Dent Repair & Detailing Areas Near Sacramento | 916 Dent & Detail',
  description: 'Mobile dent repair and detailing in Sacramento, Elk Grove, Roseville, Folsom, Davis and nine more cities. Pick your city for local notes and travel info.',
  path: '/areas',
});

export default function AreasPage() {
  return (
    <>
      <JsonLdScript data={itemListSchema('Service areas', allCities.map((c) => ({ name: c.name, path: cityPath(c.slug) })))} />
      <Breadcrumbs items={[{ name: 'Service areas', path: '/areas' }]} />
      <SeoHero eyebrow="Service area" title="We come to you across Greater Sacramento" lede={`${site.name} is mobile: no shop to visit, no address to find. Pick your city for local notes on the work we do there and how travel works.`}>
        <QuoteLink where="areas_intro" className="btn btn-gold">Get a price from a photo</QuoteLink>
      </SeoHero>
      <ul className="wrap grid gap-3 pb-10 sm:grid-cols-2 lg:grid-cols-3">
        {allCities.map((c) => (
          <li key={c.slug}>
            <Link href={cityPath(c.slug)} className="card group flex h-full flex-col p-6 transition-colors hover:border-gold-deep">
              <span className="text-lg font-semibold text-ivory group-hover:text-gold-light">{c.name}</span>
              <span className="mt-2 text-sm text-steel">{c.lede}</span>
              <span aria-hidden="true" className="mt-4 text-sm text-gold">→</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="wrap pb-4 text-sm text-steel">Not sure if your ZIP is covered? Enter it in the booking flow and it confirms coverage and any travel fee before you pay.</p>
      <CtaBand where="areas_foot" />
    </>
  );
}
