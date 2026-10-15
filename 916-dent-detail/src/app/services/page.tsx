import type { Metadata } from 'next';
import Link from 'next/link';
import { QuoteLink, TextLink } from '@/components/CtaLinks';
import { ServiceIcon } from '@/components/sections/ServiceIcon';
import { HowItWorks } from '@/components/sections/Sections';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { CtaBand, LinkCards, SeoHero } from '@/components/seo/PageParts';
import { ESTIMATE_LABEL, formatMoney, serviceFromPrice } from '@/config/pricing';
import { allCities, allServices, cityPath, servicePath } from '@/lib/seo/content';
import { pageMetadata } from '@/lib/seo/metadata';
import { itemListSchema } from '@/lib/seo/schema';

export const metadata: Metadata = pageMetadata({
  title: 'Mobile Dent Repair & Detailing Services Sacramento | 916 Dent & Detail',
  description: 'Paintless dent repair, door dings, hail, mobile detailing, paint correction, ceramic coating and dealer recon across Sacramento, done where your car is parked.',
  path: '/services',
});

export default function ServicesPage() {
  return (
    <>
      <JsonLdScript data={itemListSchema('Services', allServices.map((s) => ({ name: s.term, path: servicePath(s.slug) })))} />
      <Breadcrumbs items={[{ name: 'Services', path: '/services' }]} />
      <SeoHero eyebrow="Services" title="Dent repair & detailing that comes to you" lede="Plain names up front, the real trade terms underneath. Every job starts with a photo, and every page below says plainly what the work can and cannot do.">
        <QuoteLink where="services_intro" className="btn btn-gold">Get a price from a photo</QuoteLink>
        <TextLink where="services_intro" className="btn btn-outline">Text us</TextLink>
      </SeoHero>
      <div className="wrap grid gap-4 pb-10 md:grid-cols-2">
        {allServices.map((s) => {
          const from = formatMoney(s.priceKey ? serviceFromPrice[s.priceKey] ?? null : null);
          return (
            <Link key={s.slug} href={servicePath(s.slug)} className="card group flex gap-5 p-6 transition-colors hover:border-gold-deep sm:p-7">
              <ServiceIcon name={s.icon} />
              <span className="flex flex-1 flex-col">
                <span className="text-lg font-semibold text-ivory group-hover:text-gold-light">{s.plain}</span>
                <span className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">{s.term}</span>
                <span className="mt-3 text-[0.95rem] text-ivory/75">{s.lede}</span>
                <span className="mt-4 text-sm text-steel">
                  {from.placeholder ? 'Priced from your photos.' : <>From {from.text}.</>}{' '}
                  <span className="font-semibold text-gold group-hover:text-gold-light">Read more <span aria-hidden="true">→</span></span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <p className="wrap pb-6 text-sm text-steel">{ESTIMATE_LABEL} <Link href="/pricing" className="text-gold underline underline-offset-4 hover:text-gold-light">How pricing works</Link></p>
      <LinkCards id="areas-t" heading="Service areas" cols={4} items={allCities.map((c) => ({ href: cityPath(c.slug), title: c.name }))} />
      <HowItWorks />
      <CtaBand where="services_foot" />
    </>
  );
}
