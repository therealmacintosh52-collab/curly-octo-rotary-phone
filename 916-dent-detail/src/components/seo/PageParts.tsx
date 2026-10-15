import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Section } from '@/content/seo/types';
import { CallLink, QuoteLink, TextLink } from '@/components/CtaLinks';

/** Hero block below the breadcrumbs. The H1 is plain-language; real terms live in H2s/schema/FAQs. */
export function SeoHero({ eyebrow, title, lede, children }: { eyebrow: string; title: ReactNode; lede: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden pb-10 pt-6 lg:pb-14">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(201,162,74,0.10),transparent_70%)]" />
      <div className="wrap relative">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl text-[clamp(1.7rem,4.2vw,3.1rem)]">{title}</h1>
        <p className="lede mt-6">{lede}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

export function SectionBlock({ s }: { s: Section }) {
  const limits = s.kind === 'limits';
  const body = (
    <>
      <h2 id={`${s.id}-t`} className="text-[clamp(1.25rem,2.4vw,1.7rem)]">{s.h2}</h2>
      {s.paras?.map((p) => <p key={p.slice(0, 40)} className="mt-5 text-ivory/80">{p}</p>)}
      {s.steps && (
        <ol className="mt-6 space-y-5">
          {s.steps.map((st, i) => (
            <li key={st.title} className="flex gap-4">
              <span aria-hidden="true" className="font-display text-sm text-gold">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="font-sans text-base font-semibold text-ivory">{st.title}</h3>
                <p className="mt-1 text-ivory/75">{st.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {s.bullets && (
        <ul className="mt-5 space-y-3 text-ivory/80">
          {s.bullets.map((b) => (
            <li key={b.slice(0, 40)} className="flex gap-3">
              <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-gold" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {s.after?.map((p) => <p key={p.slice(0, 40)} className="mt-5 text-ivory/80">{p}</p>)}
    </>
  );
  return (
    <section id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-28">
      {limits ? <div className="card border-gold-deep/50 p-6 sm:p-8">{body}</div> : body}
    </section>
  );
}

export type LinkItem = { href: string; title: string; text?: string };

export function LinkCards({ id, heading, items, cols = 3 }: { id: string; heading: string; items: LinkItem[]; cols?: 2 | 3 | 4 }) {
  const grid = cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <section aria-labelledby={id} className="wrap mt-16">
      <h2 id={id} className="text-[clamp(1.25rem,2.4vw,1.7rem)]">{heading}</h2>
      <ul className={`mt-6 grid gap-3 ${grid}`}>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="card group flex h-full flex-col p-5 transition-colors hover:border-gold-deep">
              <span className="font-semibold text-ivory group-hover:text-gold-light">{it.title}</span>
              {it.text && <span className="mt-2 text-sm text-steel">{it.text}</span>}
              <span aria-hidden="true" className="mt-3 text-sm text-gold">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Closing call-to-action: photo quote first (/book#photo), text/call as alternatives. */
export function CtaBand({ where, heading = 'Send a photo, get a straight answer.', body = 'We reply with an estimate range and tell you honestly whether the job suits our method. Estimate, final price confirmed on inspection.' }: { where: string; heading?: string; body?: string }) {
  return (
    <section aria-labelledby={`cta-${where}`} className="wrap mt-20 pb-24">
      <div className="card flex flex-col items-start gap-6 p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 id={`cta-${where}`} className="text-[clamp(1.25rem,2.4vw,1.7rem)]">{heading}</h2>
          <p className="mt-3 text-steel">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <QuoteLink where={where} className="btn btn-gold">Get a price from a photo</QuoteLink>
          <TextLink where={where} className="btn btn-outline">Text us</TextLink>
          <CallLink where={where} className="btn btn-outline">Call</CallLink>
        </div>
      </div>
    </section>
  );
}
