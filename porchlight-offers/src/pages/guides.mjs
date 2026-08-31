import { site } from '../config.mjs';

/** Append the brand only when the result still fits Google's ~60-char cut. */
const seoTitle = (base) =>
  base.length + site.name.length + 3 <= 60 ? `${base} | ${site.name}` : base;
import { esc, abs, humanDate } from '../lib/html.mjs';
import { faqSchema } from '../layout.mjs';
import { situations } from '../content/situations.mjs';
import { posts } from '../content/posts.mjs';
import { cities } from '../content/cities.mjs';
import {
  leadForm,
  trustBar,
  steps,
  faqSection,
  ctaBand,
  breadcrumbs,
  pageHero,
} from '../components.mjs';

const S = site.stats;

/* --------------------------------------------------------- situations */

const situationPage = (s) => {
  const path = `/situations/${s.slug}/`;
  const related = situations.filter((x) => x.slug !== s.slug).slice(0, 5);
  return {
    path,
    title: seoTitle(s.title),
    description: s.description,
    crumbs: [
      { name: 'Situations', path: '/situations/' },
      { name: s.nav, path },
    ],
    schema: [
      faqSchema(s.faqs),
      {
        '@type': 'Service',
        '@id': `${abs(site.origin, path)}#service`,
        name: s.title,
        serviceType: 'Cash home buying',
        provider: { '@id': `${site.origin}/#organization` },
        areaServed: { '@type': 'AdministrativeArea', name: site.marketName },
        description: s.description,
      },
    ],
    body: `
${breadcrumbs([
  { name: 'Situations', path: '/situations/' },
  { name: s.nav, path },
])}

<section class="hero hero--situation">
  <div class="container hero__inner">
    <div class="hero__copy">
      <p class="hero__eyebrow">${esc(s.nav)}</p>
      <h1 class="hero__title">${esc(s.h1)}</h1>
      <p class="hero__lede">${esc(s.intro)}</p>
      <ul class="hero__points">
        <li>Written cash offer in ${esc(S.avgOfferHours)} hours</li>
        <li>Sell as-is — no repairs, no cleanout, no showings</li>
        <li>No commissions or closing costs</li>
        <li>You choose the closing date</li>
      </ul>
    </div>
    <div class="hero__form">
      <div class="form-card">
        <h2 class="form-card__title">Get my free cash offer</h2>
        <p class="form-card__sub">No fees. No obligation. About 60 seconds.</p>
        ${leadForm({ id: `offer-form-${s.slug}`, source: `situation-${s.slug}` })}
      </div>
    </div>
  </div>
</section>

${trustBar()}

<section class="section">
  <div class="container container--narrow">
    <h2 class="section__title">Sound familiar?</h2>
    <ul class="check-list check-list--pain">
      ${s.pains.map((p) => `<li>${esc(p)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="section section--alt">
  <div class="container">
    <h2 class="section__title">How we handle it</h2>
    <ul class="card-grid card-grid--3">
      ${s.help
        .map(
          (h) => `
      <li class="card card--help">
        <h3 class="card__title">${esc(h.h)}</h3>
        <p class="card__text">${esc(h.p)}</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

${steps()}

${faqSection(s.faqs, { heading: `${s.nav}: common questions`, showAllLink: true })}

<section class="section section--alt">
  <div class="container">
    <h2 class="section__title">We buy in other situations too</h2>
    <ul class="pill-list">
      ${related
        .map((r) => `<li><a class="pill" href="/situations/${r.slug}/">${esc(r.nav)}</a></li>`)
        .join('\n      ')}
      <li><a class="pill" href="/situations/">All situations →</a></li>
    </ul>
    <h2 class="section__title">Areas we buy</h2>
    <ul class="pill-list">
      ${cities
        .slice(0, 6)
        .map((c) => `<li><a class="pill" href="/we-buy-houses/${c.slug}/">${esc(c.name)}</a></li>`)
        .join('\n      ')}
    </ul>
  </div>
</section>

<section class="section">
  <div class="container container--narrow">
    <p class="disclaimer-note">
      This page is general information, not legal, tax or financial advice. For your specific
      situation, talk to a licensed attorney or CPA.
    </p>
  </div>
</section>

${ctaBand({ heading: 'Get a free, no-obligation offer', source: `situation-${s.slug}-footer` })}
`,
  };
};

const situationsIndex = () => ({
  path: '/situations/',
  title: 'We Buy Houses in Any Situation | Cash Offers',
  description:
    'Inherited property, foreclosure, divorce, relocation, tired landlord, major repairs, vacant or hoarder houses — we buy in any situation, as-is, for cash.',
  crumbs: [{ name: 'Situations', path: '/situations/' }],
  body: `
${breadcrumbs([{ name: 'Situations', path: '/situations/' }])}
${pageHero({
  eyebrow: 'Any situation',
  h1: 'Whatever is going on, we have bought a house like it',
  lede: 'Most people who call us are not selling because they want to — they are selling because something happened. Find your situation below.',
})}

<section class="section">
  <div class="container">
    <ul class="card-grid">
      ${situations
        .map(
          (s) => `
      <li class="card">
        <h2 class="card__title"><a href="/situations/${s.slug}/">${esc(s.h1)}</a></h2>
        <p class="card__text">${esc(s.intro.split('.').slice(0, 2).join('.'))}.</p>
        <span class="card__link" aria-hidden="true">Learn more →</span>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

${ctaBand({ source: 'situations-index' })}
`,
});

/* --------------------------------------------------------------- blog */

const postPage = (p) => {
  const path = `/blog/${p.slug}/`;
  const related = posts.filter((x) => x.slug !== p.slug).slice(0, 3);
  return {
    path,
    title: seoTitle(p.title),
    description: p.description,
    ogType: 'article',
    crumbs: [
      { name: 'Guides', path: '/blog/' },
      { name: p.title, path },
    ],
    schema: [
      {
        '@type': 'BlogPosting',
        '@id': `${abs(site.origin, path)}#article`,
        headline: p.title,
        description: p.description,
        datePublished: p.date,
        dateModified: p.updated ?? p.date,
        author: { '@id': `${site.origin}/#organization` },
        publisher: { '@id': `${site.origin}/#organization` },
        mainEntityOfPage: abs(site.origin, path),
        image: abs(site.origin, '/img/og-default.png'),
        inLanguage: 'en-US',
        keywords: p.tags.join(', '),
      },
    ],
    body: `
${breadcrumbs([
  { name: 'Guides', path: '/blog/' },
  { name: p.title, path },
])}
<article class="section">
  <div class="container container--narrow prose">
    <header class="post-header">
      <p class="eyebrow">${p.tags.map(esc).join(' · ')}</p>
      <h1>${esc(p.title)}</h1>
      <p class="prose__meta">
        Published ${esc(humanDate(p.date))}${p.updated && p.updated !== p.date ? ` · Updated ${esc(humanDate(p.updated))}` : ''} · ${esc(String(p.minutes))} min read
      </p>
      <p class="post-lede">${esc(p.description)}</p>
    </header>
    ${p.body}
    <aside class="post-cta">
      <h2>Want your own numbers?</h2>
      <p>We will give you a written cash offer with the full calculation shown — free, and with no obligation.</p>
      <p><a class="btn btn--primary btn--lg" href="/#offer-form" data-track="post-cta">Get my cash offer</a>
      <a class="btn btn--ghost btn--lg" href="tel:${esc(site.phoneHref)}">Call ${esc(site.phone)}</a></p>
    </aside>
  </div>
</article>

<section class="section section--alt">
  <div class="container">
    <h2 class="section__title">Keep reading</h2>
    <ul class="card-grid card-grid--3">
      ${related
        .map(
          (r) => `
      <li class="card">
        <h3 class="card__title"><a href="/blog/${r.slug}/">${esc(r.title)}</a></h3>
        <p class="card__text">${esc(r.description)}</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

${ctaBand({ source: `post-${p.slug}` })}
`,
  };
};

const blogIndex = () => ({
  path: '/blog/',
  title: 'Guides for Home Sellers | Cash Offers, Costs, and Red Flags',
  description:
    'Plain-English guides to selling a house fast: how cash offers are calculated, net proceeds compared to listing with an agent, scam red flags, and inherited property.',
  crumbs: [{ name: 'Guides', path: '/blog/' }],
  schema: [
    {
      '@type': 'Blog',
      '@id': `${site.origin}/blog/#blog`,
      name: `${site.name} seller guides`,
      publisher: { '@id': `${site.origin}/#organization` },
    },
  ],
  body: `
${breadcrumbs([{ name: 'Guides', path: '/blog/' }])}
${pageHero({
  eyebrow: 'Guides',
  h1: 'Straight answers for people selling a house',
  lede: 'Including the parts that are not in our interest — how offers are calculated, when listing nets you more, and how to spot a predatory buyer.',
})}

<section class="section">
  <div class="container">
    <ul class="card-grid card-grid--3">
      ${posts
        .map(
          (p) => `
      <li class="card card--post">
        <p class="card__meta">${p.tags.map(esc).join(' · ')} · ${esc(String(p.minutes))} min</p>
        <h2 class="card__title"><a href="/blog/${p.slug}/">${esc(p.title)}</a></h2>
        <p class="card__text">${esc(p.description)}</p>
        <p class="card__date">${esc(humanDate(p.updated ?? p.date))}</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

${ctaBand({ source: 'blog-index' })}
`,
});

export const guidePages = () => [
  situationsIndex(),
  ...situations.map(situationPage),
  blogIndex(),
  ...posts.map(postPage),
];
