import Link from 'next/link';
import type { CityDoc } from '@/content/seo/types';
import { FaqList } from '@/components/sections/FaqList';
import { QuoteLink, TextLink } from '@/components/CtaLinks';
import { Breadcrumbs } from './Breadcrumbs';
import { JsonLdScript } from './JsonLdScript';
import { CtaBand, LinkCards, SeoHero } from './PageParts';
import { cityServiceSchema, faqSchema } from '@/lib/seo/schema';
import { blogPath, cityPath, getCity, mustService, servicePath } from '@/lib/seo/content';
import { allPosts } from '@/lib/seo/blog';
import { travelNote } from '@/lib/seo/travel';

function Travel({ city }: { city: CityDoc }) {
  return (
    <section aria-labelledby="travel-t" className="card max-w-3xl p-6 sm:p-8">
      <h2 id="travel-t" className="text-[clamp(1.15rem,2.2vw,1.5rem)]">Getting to {city.name}</h2>
      <p className="mt-4 text-ivory/80">{city.driveNote}</p>
      <p className="mt-4 text-sm text-steel">{travelNote(city)}</p>
    </section>
  );
}

export function CityPage({ city }: { city: CityDoc }) {
  const posts = allPosts();
  const blogs = city.blogs.map((s) => posts.find((p) => p.slug === s)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const neighbors = city.neighbors.map((s) => getCity(s)).filter((c): c is CityDoc => Boolean(c));
  const far = city.distance === 'far';

  return (
    <>
      <JsonLdScript data={[cityServiceSchema(city), faqSchema(city.faqs)]} />
      <Breadcrumbs items={[{ name: 'Service areas', path: '/areas' }, { name: city.name, path: cityPath(city.slug) }]} />
      <SeoHero eyebrow={`${city.name}, CA`} title={city.h1} lede={city.lede}>
        <QuoteLink where={`city_${city.slug}_hero`} className="btn btn-gold">Get a price from a photo</QuoteLink>
        <TextLink where={`city_${city.slug}_hero`} className="btn btn-outline">Text us</TextLink>
      </SeoHero>

      <div className="wrap space-y-14">
        {far && <Travel city={city} />}
        <div className="max-w-3xl space-y-14">
          {city.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-28">
              <h2 id={`${s.id}-t`} className="text-[clamp(1.25rem,2.4vw,1.7rem)]">{s.h2}</h2>
              {s.paras.map((p) => <p key={p.slice(0, 40)} className="mt-5 text-ivory/80">{p}</p>)}
              {s.bullets && (
                <ul className="mt-5 list-disc space-y-2 pl-5 text-ivory/80">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
              )}
            </section>
          ))}
        </div>

        <section aria-labelledby="jobs-t" className="max-w-3xl">
          <h2 id="jobs-t" className="text-[clamp(1.25rem,2.4vw,1.7rem)]">Typical jobs in {city.name}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {city.jobs.map((j) => {
              const svc = mustService(j.service);
              return (
                <li key={j.job}>
                  <Link href={servicePath(svc.slug)} className="card group flex h-full flex-col p-5 transition-colors hover:border-gold-deep">
                    <span className="font-semibold text-ivory group-hover:text-gold-light">{j.job}</span>
                    <span className="mt-2 text-sm text-steel">{j.why}</span>
                    <span className="mt-3 text-sm text-gold">{svc.plain} <span aria-hidden="true">→</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        {!far && <Travel city={city} />}
      </div>

      <section aria-labelledby="faq-t" className="wrap mt-20">
        <h2 id="faq-t" className="text-[clamp(1.25rem,2.4vw,1.7rem)]">{city.name} questions</h2>
        <div className="mt-6 max-w-4xl"><FaqList items={city.faqs} /></div>
      </section>

      <LinkCards id="svc-t" heading={`Services we do in ${city.name}`} cols={3} items={city.services.map((s) => mustService(s)).map((s) => ({ href: servicePath(s.slug), title: s.plain, text: s.term }))} />
      <LinkCards id="near-t" heading="Nearby areas" cols={4} items={neighbors.map((n) => ({ href: cityPath(n.slug), title: n.name }))} />
      {blogs.length > 0 && <LinkCards id="blog-t" heading="Useful reading" cols={2} items={blogs.map((b) => ({ href: blogPath(b.slug), title: b.title, text: b.description }))} />}
      <CtaBand where={`city_${city.slug}_foot`} />
    </>
  );
}
