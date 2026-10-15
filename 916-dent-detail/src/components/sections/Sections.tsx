import Link from 'next/link';
import { cities, faqs, services, steps, type Service } from '@/content/home';
import { memberships, formatMoney } from '@/config/pricing';
import { site } from '@/config/site';
import { BeforeAfter } from '../BeforeAfter';
import { BookLink, CallLink, QuoteLink, TextLink } from '../CtaLinks';
import { PanelArt } from './PlaceholderArt';
import { FaqList } from './FaqList';
import { ServiceIcon } from './ServiceIcon';
import { serviceHrefForLegacyId } from '@/lib/seo/content';

function Head({ eyebrow, title, lede, id }: { eyebrow: string; title: string; lede?: string; id: string }) {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="h2 mt-4">{title}</h2>
      {lede && <p className="lede mt-5">{lede}</p>}
    </div>
  );
}

/* ---------------- How it works ---------------- */
export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="section section-cv" data-motion="steps">
      <div className="wrap">
        <Head id="how-title" eyebrow="How it works" title="Three steps. Zero body shop." />
        <div className="relative mt-14">
          <div data-line aria-hidden="true" className="hairline absolute left-0 right-0 top-[1.9rem] hidden md:block" />
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((s) => (
              <li key={s.n} data-m className="relative">
                <span className="text-metal font-display text-5xl leading-none" aria-hidden="true">{s.n}</span>
                <h3 className="mt-6 text-lg">{s.title}</h3>
                <p className="mt-3 max-w-xs text-steel">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Services ---------------- */
export function ServicesGrid({ list = services }: { list?: Service[] }) {
  return (
    <section id="services" aria-labelledby="services-title" className="section section-cv border-t border-line/60" data-motion="grid">
      <div className="wrap">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <Head
            id="services-title"
            eyebrow="Services"
            title="Paintless dent repair, paint correction & detailing"
            lede="Plain names, honest work. Everything is done where your car is parked."
          />
          <Link href="/services" className="btn btn-outline shrink-0">All services</Link>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <li key={s.id} data-m>
              <Link href={serviceHrefForLegacyId(s.id)} className="card group flex h-full flex-col p-7 transition-colors hover:border-gold-deep">
                <ServiceIcon name={s.icon} />
                <h3 className="mt-6 text-[1.05rem] tracking-wide">{s.plain}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">{s.term}</p>
                <p className="mt-4 flex-1 text-[0.95rem] text-ivory/75">{s.summary}</p>
                <span className="mt-6 text-sm font-semibold text-gold group-hover:text-gold-light">
                  Learn more <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- Before / after ---------------- */
const pairs = [
  { variant: 'dent' as const, label: 'Door ding', term: 'Paintless dent repair' },
  { variant: 'swirl' as const, label: 'Swirl marks', term: 'Paint correction' },
  { variant: 'interior' as const, label: 'Interior', term: 'Interior detailing' },
];
export function BeforeAfterSection() {
  return (
    <section id="results" aria-labelledby="results-title" className="section section-cv" data-motion="reveal">
      <div className="wrap">
        <Head
          id="results-title"
          eyebrow="Before & after"
          title="Dent repair and paint correction results"
          lede="Drag the handle, or focus it and use the arrow keys."
        />
        <p className="mt-4"><span className="owner-mark">[REPLACE WITH REAL JOB PHOTOS]</span></p>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {pairs.map((p) => (
            <li key={p.variant} data-m>
              <BeforeAfter
                label={`${p.label} (${p.term})`}
                before={<PanelArt variant={p.variant} state="before" />}
                after={<PanelArt variant={p.variant} state="after" />}
              />
              <p className="mt-3 text-sm"><span className="text-ivory">{p.label}</span> <span className="text-steel">· {p.term}</span></p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- Gloss Shield (uses hero-beading) ---------------- */
export function GlossShield() {
  return (
    <section id="gloss-shield" aria-labelledby="gloss-title" className="section section-cv overflow-hidden border-t border-line/60" data-motion="parallax">
      <div className="wrap grid items-center gap-12 lg:grid-cols-2">
        <div className="relative order-2 aspect-[4/5] overflow-hidden rounded-[var(--radius-panel)] border border-white/10 lg:order-1">
          <picture>
            <source type="image/avif" srcSet="/beading/beading-640.avif 640w, /beading/beading-1122.avif 1122w" sizes="(min-width: 1024px) 560px, 92vw" />
            <img
              data-parallax
              src="/beading/beading-640.webp"
              srcSet="/beading/beading-640.webp 640w, /beading/beading-1122.webp 1122w"
              sizes="(min-width: 1024px) 560px, 92vw"
              width={1122}
              height={1402}
              loading="lazy"
              decoding="async"
              alt="Water beading into tight droplets on a ceramic-coated black car panel"
              className="h-full w-full object-cover"
            />
          </picture>
        </div>
        <div className="order-1 lg:order-2">
          <p className="eyebrow" data-m>Gloss Shield</p>
          <h2 id="gloss-title" className="h2 mt-4" data-m>Ceramic coating that makes water run</h2>
          <p className="lede mt-5" data-m>
            A hard, slick layer bonded to your clear coat. Water beads and rolls off, dirt lets go when you rinse, and the paint keeps that deep, wet look between washes.
          </p>
          <ul className="mt-8 space-y-4">
            {['Deeper, glassier gloss', 'Water beads and sheets off', 'Easier, faster washes'].map((t) => (
              <li key={t} data-m className="flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-gold" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-steel" data-m>Best after a Paint Deep-Clean and, if needed, a Swirl &amp; Scratch Erase.</p>
          <div className="mt-8" data-m><QuoteLink where="gloss_shield" className="btn btn-gold">Price my Gloss Shield</QuoteLink></div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Eco / no runoff ---------------- */
// [OWNER: confirm reclaim equipment & permits] — copy kept general on purpose (see DECISIONS P-012).
export function Eco() {
  const points = [
    { t: 'Low-water methods', b: 'We clean with measured water, not a running hose.' },
    { t: 'Runoff captured', b: 'Wash water is collected instead of sent down the street.' },
    { t: 'Storm drains stay clean', b: 'Built around keeping wash water out of the storm drain, the way Sacramento-area stormwater rules intend.' },
  ];
  return (
    <section id="eco" aria-labelledby="eco-title" className="section section-cv" data-motion="draw">
      <div className="wrap grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Head id="eco-title" eyebrow="Eco-friendly, no runoff" title="Clean car. Clean street." lede="Mobile doesn't mean messy. Our setup is designed so what comes off your car doesn't end up in the gutter." />
          <ul className="mt-10 space-y-6">
            {points.map((p) => (
              <li key={p.t} data-m className="border-l border-gold-deep pl-5">
                <h3 className="font-sans text-base font-semibold">{p.t}</h3>
                <p className="mt-1 text-steel">{p.b}</p>
              </li>
            ))}
          </ul>
        </div>
        <svg viewBox="0 0 400 340" className="mx-auto w-full max-w-md" role="img" aria-labelledby="eco-svg-t">
          <title id="eco-svg-t">Water reclaim loop: wash, capture, keep it out of the storm drain</title>
          {/* drop */}
          <path data-draw d="M200 92 C 172 134, 156 160, 156 186 a44 44 0 0 0 88 0 c0 -26 -16 -52 -44 -94z" fill="none" stroke="#c9a24a" strokeWidth="2" />
          {/* reclaim loop: 300° clockwise arc (centre 200,170 r130); arrowhead on the end tangent */}
          <path data-draw d="M200 40 A130 130 0 1 1 87.4 105" fill="none" stroke="#e8cb7a" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M76.3 110.2 L87.4 105 L88.5 117.2" fill="none" stroke="#e8cb7a" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="200" y="328" textAnchor="middle" fill="#8c8f96" fontSize="13" fontFamily="var(--font-inter), system-ui, sans-serif">wash · capture · keep drains clean</text>
        </svg>
      </div>
    </section>
  );
}

/* ---------------- Reviews (placeholders only; no fake reviews, no aggregateRating) ---------------- */
export function Reviews() {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="section section-cv border-t border-line/60" data-motion="fade">
      <div className="wrap">
        <Head id="reviews-title" eyebrow="Reviews" title="What our customers say" />
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <li key={i} data-m className="flex flex-col rounded-[20px] border border-dashed border-gold-deep/70 p-7">
              <span className="owner-mark self-start">[OWNER] real review {i}</span>
              <p className="mt-5 flex-1 text-steel">
                Placeholder, not a customer review. Paste a real Google review here (with the customer&apos;s permission) before launch.
              </p>
              <p className="mt-6 text-sm text-ivory/70">[OWNER] first name · city</p>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          {site.googleReviewUrl ? (
            <a href={site.googleReviewUrl} className="btn btn-outline" rel="noopener" target="_blank">Read our reviews on Google</a>
          ) : (
            <span className="owner-mark">[OWNER] Google reviews link</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Service area (inline SVG, no map script) ---------------- */
const labelPos: Record<string, { dx: number; dy: number; anchor?: 'start' | 'end' | 'middle' }> = {
  'West Sacramento': { dx: -10, dy: 16, anchor: 'end' },
  Davis: { dx: 0, dy: 20, anchor: 'middle' },
  Natomas: { dx: -10, dy: -6, anchor: 'end' },
  Sacramento: { dx: -10, dy: -8, anchor: 'end' },
  Carmichael: { dx: 0, dy: -12, anchor: 'middle' },
  'Rancho Cordova': { dx: 10, dy: 16 },
  'Elk Grove': { dx: 10, dy: 4 },
  'Citrus Heights': { dx: -10, dy: 16, anchor: 'end' },
  Roseville: { dx: -10, dy: 2, anchor: 'end' },
  Rocklin: { dx: 10, dy: -4 },
  Lincoln: { dx: 10, dy: 4 },
  'Granite Bay': { dx: 10, dy: 4 },
  Folsom: { dx: 0, dy: 22, anchor: 'middle' },
  'El Dorado Hills': { dx: 0, dy: -12, anchor: 'middle' },
};
export function ServiceArea() {
  return (
    <section id="area" aria-labelledby="area-title" className="section section-cv" data-motion="pins">
      <div className="wrap grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Head id="area-title" eyebrow="Service area" title="Mobile dent repair & detailing across Greater Sacramento" lede="We drive to you in these cities. Not sure if you're covered? Send your ZIP with your photo." />
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3" aria-label="Cities we serve">
            {cities.map((c) => (
              <li key={c.name} data-m className="flex items-center gap-2 text-ivory/85">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />{c.name}
              </li>
            ))}
          </ul>
        </div>
        <figure className="card overflow-hidden p-3 sm:p-5">
          <svg viewBox="-30 -10 580 380" className="h-auto w-full" role="img" aria-labelledby="map-t map-d">
            <title id="map-t">Service area map (schematic, not to scale)</title>
            <desc id="map-d">Fourteen cities around Sacramento: {cities.map((c) => c.name).join(', ')}.</desc>
            <defs>
              <radialGradient id="halo" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#c9a24a" stopOpacity="0.16" />
                <stop offset="1" stopColor="#c9a24a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse data-halo cx="270" cy="180" rx="300" ry="210" fill="url(#halo)" />
            {/* rivers, decorative */}
            <path d="M120 -10 C 170 90, 175 160, 190 220 S 210 330, 230 380" fill="none" stroke="#27406b" strokeWidth="3" strokeOpacity="0.7" />
            <path d="M188 214 C 240 200, 300 210, 360 190 S 440 150, 520 120" fill="none" stroke="#27406b" strokeWidth="2.5" strokeOpacity="0.6" />
            {cities.map((c) => {
              const l = labelPos[c.name] ?? { dx: 10, dy: 4 };
              return (
                <g key={c.name}>
                  <circle data-pin cx={c.x} cy={c.y} r="5" fill="#c9a24a" stroke="#0b0b0c" strokeWidth="2" />
                  <text x={c.x + l.dx} y={c.y + l.dy} textAnchor={l.anchor ?? 'start'} fill="#f3eee3" fillOpacity="0.85" fontSize="14.5" fontFamily="var(--font-inter), system-ui, sans-serif">
                    {c.name}
                  </text>
                </g>
              );
            })}
          </svg>
          <figcaption className="px-2 pt-2 text-xs text-steel">Schematic map. City positions are approximate.</figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ---------------- Memberships (prices from config/pricing.ts only) ---------------- */
export function Memberships() {
  return (
    <section id="memberships" aria-labelledby="memberships-title" className="section section-cv border-t border-line/60" data-motion="tiers">
      <div className="wrap">
        <Head id="memberships-title" eyebrow="Memberships" title="Maintenance detailing plans" lede="Keep it looking just-detailed, on a schedule. We come to you every visit." />
        <p className="mt-4"><span className="owner-mark">[OWNER] confirm prices &amp; what each tier includes</span></p>
        <ul className="mt-12 grid gap-5 lg:grid-cols-3">
          {memberships.map((t) => {
            const price = formatMoney(t.priceMonthly);
            return (
              <li key={t.id} data-m className={`card relative flex flex-col p-8 ${t.featured ? 'border-gold-deep shadow-[0_0_0_1px_rgba(201,162,74,0.35),0_30px_80px_-40px_rgba(201,162,74,0.45)]' : ''}`}>
                {t.featured && <span className="absolute -top-3 left-8 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-onyx">Recommended</span>}
                <h3 className="text-xl">{t.name}</h3>
                <p className="mt-2 text-steel">{t.blurb}</p>
                <p className="mt-6 flex items-baseline gap-2">
                  {price.placeholder ? <span className="owner-mark">{price.text}</span> : <span className="font-display text-3xl">{price.text}</span>}
                  <span className="text-sm text-steel">/ month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-[0.95rem]">
                  {t.includes.map((x) => (
                    <li key={x} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 h-px w-4 shrink-0 bg-gold" />{x}</li>
                  ))}
                </ul>
                <BookLink where={`membership_${t.id}`} className={`btn mt-8 ${t.featured ? 'btn-gold' : 'btn-outline'}`}>
                  Ask about {t.name}
                </BookLink>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- Dealers ---------------- */
export function DealerBand() {
  return (
    <section id="dealers" aria-labelledby="dealers-title" className="section section-cv" data-motion="slide">
      <div className="wrap">
        <div className="card relative overflow-hidden p-8 sm:p-12 lg:p-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,rgba(201,162,74,0.16),transparent_42%)]" />
          <p className="eyebrow" data-m>Dealers · fleets · rental lots · body shops</p>
          <h2 id="dealers-title" className="h2 mt-4 max-w-3xl" data-m>Dealership recon, done on your lot</h2>
          <ul className="mt-8 grid gap-4 text-ivory/85 sm:grid-cols-3">
            {['Faster frontline-ready', 'Same-day on-lot dent & detail', 'Per-panel wholesale pricing · COI on request'].map((t) => (
              <li key={t} data-m className="border-t border-line pt-4">{t}</li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3" data-m>
            <Link href="/dealers" className="btn btn-gold">Dealer program</Link>
            <CallLink where="dealer_band" className="btn btn-outline">Call us</CallLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="section section-cv border-t border-line/60" data-motion="fade">
      <div className="wrap grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <Head id="faq-title" eyebrow="FAQ" title="Paintless dent repair & detailing questions" />
        <FaqList items={faqs} />
      </div>
    </section>
  );
}

/* ---------------- Closing CTA ---------------- */
export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="section section-cv pt-0">
      <div className="wrap text-center">
        <div className="hairline mx-auto mb-16 max-w-xl" />
        <h2 id="cta-title" className="h2">Send a photo. <span className="text-gold">Get a price.</span></h2>
        <p className="lede mx-auto mt-5">Text us a picture of the dent or the car. We reply with an estimate range and open times.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <QuoteLink where="closing" className="btn btn-gold">Get a price from a photo</QuoteLink>
          <TextLink where="closing" className="btn btn-outline">Text us</TextLink>
        </div>
      </div>
    </section>
  );
}
