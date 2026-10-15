import Link from 'next/link';
import type { ServiceDoc } from '@/content/seo/types';
import { ESTIMATE_LABEL, formatMoney, serviceFromPrice } from '@/config/pricing';
import { FaqList } from '@/components/sections/FaqList';
import { QuoteLink, TextLink } from '@/components/CtaLinks';
import { ServiceIcon } from '@/components/sections/ServiceIcon';
import { Breadcrumbs } from './Breadcrumbs';
import { JsonLdScript } from './JsonLdScript';
import { CtaBand, LinkCards, SectionBlock, SeoHero } from './PageParts';
import { faqSchema, serviceSchema } from '@/lib/seo/schema';
import { blogPath, cityPath, getService, mustCity, servicePath } from '@/lib/seo/content';
import { allPosts } from '@/lib/seo/blog';

export function ServicePage({ doc }: { doc: ServiceDoc }) {
  const price = doc.priceKey ? serviceFromPrice[doc.priceKey] ?? null : null;
  const from = formatMoney(price);
  const posts = allPosts();
  const blogs = doc.blogs.map((s) => posts.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const related = doc.related.map((s) => getService(s)).filter((s): s is ServiceDoc => Boolean(s));

  return (
    <>
      <JsonLdScript data={[serviceSchema(doc), faqSchema(doc.faqs)]} />
      <Breadcrumbs items={[{ name: 'Services', path: '/services' }, { name: doc.plain, path: servicePath(doc.slug) }]} />
      <SeoHero eyebrow={doc.term} title={doc.h1} lede={doc.lede}>
        <QuoteLink where={`service_${doc.slug}_hero`} className="btn btn-gold">Get a price from a photo</QuoteLink>
        <TextLink where={`service_${doc.slug}_hero`} className="btn btn-outline">Text us</TextLink>
      </SeoHero>

      <div className="wrap grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <article className="max-w-3xl space-y-14">
          {doc.sections.map((s) => <SectionBlock key={s.id} s={s} />)}
        </article>

        <aside aria-label="Quick facts" className="lg:sticky lg:top-28 lg:self-start">
          <div className="card space-y-5 p-6">
            <ServiceIcon name={doc.icon} />
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-steel">Also called</dt>
                <dd className="mt-1 font-semibold text-ivory">{doc.plain}</dd>
              </div>
              <div>
                <dt className="text-steel">Price</dt>
                <dd className="mt-1 text-ivory">
                  {price !== null ? <>From <strong>{from.text}</strong>. </> : null}
                  {doc.priceNote} <Link href="/pricing" className="text-gold underline underline-offset-4 hover:text-gold-light">How pricing works</Link>
                </dd>
              </div>
              <div>
                <dt className="text-steel">Typical time</dt>
                <dd className="mt-1 text-ivory">{doc.typicalTime}</dd>
              </div>
              <div>
                <dt className="text-steel">Where</dt>
                <dd className="mt-1 text-ivory">At your home, office or lot across Greater Sacramento.</dd>
              </div>
            </dl>
            <QuoteLink where={`service_${doc.slug}_aside`} className="btn btn-gold w-full">Get a price from a photo</QuoteLink>
            <p className="text-xs text-steel">{ESTIMATE_LABEL}</p>
          </div>
        </aside>
      </div>

      <section aria-labelledby="faq-t" className="wrap mt-20">
        <h2 id="faq-t" className="text-[clamp(1.25rem,2.4vw,1.7rem)]">{doc.term}: common questions</h2>
        <div className="mt-6 max-w-4xl"><FaqList items={doc.faqs} /></div>
      </section>

      <LinkCards id="rel-t" heading="Related services" cols={3} items={related.map((r) => ({ href: servicePath(r.slug), title: r.plain, text: r.term }))} />
      {blogs.length > 0 && (
        <LinkCards id="blog-t" heading="Read more" cols={3} items={blogs.map((b) => ({ href: blogPath(b.slug), title: b.title, text: b.description }))} />
      )}
      <LinkCards
        id="area-t"
        heading="Where we do this work"
        cols={4}
        items={doc.cities.map((c) => mustCity(c)).map((c) => ({ href: cityPath(c.slug), title: c.name, text: `Mobile service in ${c.name}` }))}
      />
      <p className="wrap mt-4 text-sm"><Link href="/areas" className="text-gold underline underline-offset-4 hover:text-gold-light">See every city we serve</Link></p>
      <CtaBand where={`service_${doc.slug}_foot`} />
    </>
  );
}
