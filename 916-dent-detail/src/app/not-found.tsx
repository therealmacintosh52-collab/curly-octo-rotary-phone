import type { Metadata } from 'next';
import Link from 'next/link';
import { QuoteLink, TextLink } from '@/components/CtaLinks';
import { allCities, allServices, cityPath, servicePath } from '@/lib/seo/content';

export const metadata: Metadata = {
  title: { absolute: 'Page not found | 916 Dent & Detail' },
  description: 'That page does not exist. Browse our services and service areas, or send a photo for a dent repair or detailing quote.',
  // no `robots` here: Next adds <meta name="robots" content="noindex"> to every 404 itself, and a second tag made two conflicting robots metas
};

export default function NotFound() {
  return (
    <section className="wrap flex min-h-[80svh] flex-col items-start justify-center pb-20 pt-32">
      <p className="text-metal font-display text-[clamp(4rem,14vw,9rem)] leading-none" aria-hidden="true">404</p>
      <h1 className="mt-6 text-[clamp(1.5rem,3.5vw,2.4rem)]">This page has a dent we can&apos;t fix.</h1>
      <p className="lede mt-4">The link may be old or mistyped. Here is where you probably wanted to go.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-outline">Home</Link>
        <Link href="/services" className="btn btn-outline">Services</Link>
        <Link href="/areas" className="btn btn-outline">Service areas</Link>
        <Link href="/blog" className="btn btn-outline">Blog</Link>
        <QuoteLink where="404" className="btn btn-gold">Get a price from a photo</QuoteLink>
        <TextLink where="404" className="btn btn-outline">Text us</TextLink>
      </div>
      <nav aria-label="Popular pages" className="mt-14 grid w-full gap-10 text-sm sm:grid-cols-2">
        <div>
          <h2 className="eyebrow">Popular services</h2>
          <ul className="mt-4 space-y-2">
            {allServices.map((s) => (
              <li key={s.slug}><Link href={servicePath(s.slug)} className="text-steel hover:text-gold-light">{s.plain} <span className="sr-only">({s.term})</span></Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="eyebrow">Where we work</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {allCities.map((c) => (
              <li key={c.slug}><Link href={cityPath(c.slug)} className="text-steel hover:text-gold-light">{c.name}</Link></li>
            ))}
          </ul>
        </div>
      </nav>
    </section>
  );
}
