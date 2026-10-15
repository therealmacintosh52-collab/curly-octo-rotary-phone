import Link from 'next/link';
import { nav, site } from '@/config/site';
import { allCities, allServices, cityPath, servicePath } from '@/lib/seo/content';
import { CallLink, TextLink } from './CtaLinks';
import { Logo } from './Logo';
import { CookieSettingsButton } from './seo/ConsentBanner';

export function Footer() {
  return (
    <footer className="border-t border-line bg-[#09090a] pb-28 pt-16 lg:pb-12">
      <div className="wrap grid gap-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-5 text-sm text-steel">{site.tagline}</p>
          {/* NAP: service-area business. No street address is published. */}
          <address className="mt-6 space-y-2 text-sm not-italic">
            <div className="font-semibold text-ivory">{site.name}</div>
            <div className="text-steel">Mobile service across {site.areaLabel}. We come to you.</div>
            <div>
              <CallLink where="footer" className="text-ivory underline-offset-4 hover:text-gold-light hover:underline">
                {site.phone.display}
              </CallLink>{' '}
              {site.phone.placeholder && <span className="owner-mark">[OWNER] phone</span>}
            </div>
            <div>
              <a href={`mailto:${site.email.address}`} className="text-ivory underline-offset-4 hover:text-gold-light hover:underline">
                {site.email.address}
              </a>{' '}
              {site.email.placeholder && <span className="owner-mark">[OWNER] email</span>}
            </div>
          </address>
        </div>

        <div>
          <h2 className="eyebrow">Hours</h2>
          <dl className="mt-5 space-y-2 text-sm">
            {site.hours.map((h) => (
              <div key={h.days} className="flex justify-between gap-4 border-b border-line/60 pb-2">
                <dt className="text-steel">{h.days}</dt>
                <dd className="text-ivory">{h.time ?? <span className="owner-mark">[OWNER] hours</span>}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex gap-3">
            <TextLink where="footer" className="btn btn-outline !min-h-11 !px-4 text-sm">Text us</TextLink>
            <CallLink where="footer" className="btn btn-gold !min-h-11 !px-4 text-sm">Call</CallLink>
          </div>
        </div>

        <div>
          <h2 className="eyebrow">Services</h2>
          <ul className="mt-5 space-y-2 text-sm">
            {allServices.map((s) => (
              <li key={s.slug}>
                <Link href={servicePath(s.slug)} className="text-steel hover:text-gold-light">
                  {s.plain} <span className="sr-only">({s.term})</span>
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="eyebrow mt-8">Company</h2>
          <ul className="mt-5 space-y-2 text-sm">
            {nav.map((n) => (
              <li key={n.href}><Link href={n.href} className="text-steel hover:text-gold-light">{n.label}</Link></li>
            ))}
            <li><Link href="/areas" className="text-steel hover:text-gold-light">Service areas</Link></li>
            <li><Link href="/blog" className="text-steel hover:text-gold-light">Blog</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow">Service area</h2>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-steel">
            {allCities.map((c) => <li key={c.slug}><Link href={cityPath(c.slug)} className="hover:text-gold-light">{c.name}</Link></li>)}
          </ul>
        </div>
      </div>
      <div className="wrap mt-14 flex flex-col gap-2 border-t border-line pt-6 text-xs text-steel sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
        <p>
          Estimates are confirmed on inspection.{' '}
          <CookieSettingsButton className="underline underline-offset-4 hover:text-gold-light" />
        </p>
      </div>
    </footer>
  );
}
