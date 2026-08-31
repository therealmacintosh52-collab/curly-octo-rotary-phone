import { site } from '../config.mjs';
import { esc, abs } from '../lib/html.mjs';
import { faqSchema } from '../layout.mjs';
import { cities } from '../content/cities.mjs';
import { situations } from '../content/situations.mjs';
import { icon } from '../lib/icons.mjs';
import { situationIcon } from '../lib/icons.mjs';
import {
  heroArt,
  leadForm,
  trustBar,
  steps,
  comparisonTable,
  testimonialsSection,
  faqSection,
  ctaBand,
  breadcrumbs,
  pageHero,
} from '../components.mjs';

const S = site.stats;

/** City-specific FAQs — keeps each local page from being a template clone. */
const cityFaqs = (c) => [
  {
    q: `How fast can you buy my house in ${c.name}?`,
    a: `We can close in as little as ${S.fastestCloseDays} days once title is clear, and most ${c.name} closings land between two and three weeks — that timeline is set by title work and payoff statements, not by us. If you need a later date, you pick it.`,
  },
  {
    q: `Do you buy houses in ${c.name} that need major repairs?`,
    a: `Yes. ${c.localNote} We buy in any condition, including vacant, fire- or water-damaged, and houses that have already failed an inspection with a previous buyer.`,
  },
  {
    q: `What parts of ${c.name} do you buy in?`,
    a: `All of it — including ${c.neighborhoods.slice(0, 4).join(', ')} — and the surrounding ${c.county} area. ZIP codes we buy in regularly include ${c.zips.slice(0, 5).join(', ')}.`,
  },
  {
    q: `Are there any fees to sell my ${c.name} house to you?`,
    a: 'None. No commissions, no listing fees, no closing costs on your side. Your mortgage payoff, liens and unpaid property taxes still come out of proceeds at closing, because those are debts against the property.',
  },
];

const cityPage = (c) => {
  const path = `/we-buy-houses/${c.slug}/`;
  const others = cities.filter((x) => x.slug !== c.slug).slice(0, 6);
  const faqs = cityFaqs(c);
  return {
    path,
    title: `We Buy Houses ${c.name}, ${site.stateAbbr} | Cash Offer in ${S.avgOfferHours} Hours`,
    description: `We buy houses in ${c.name} for cash — as-is, no repairs, no fees, no commissions. Free written offer in ${S.avgOfferHours} hours, and you pick the closing date.`,
    crumbs: [
      { name: 'Areas we buy', path: '/locations/' },
      { name: c.name, path },
    ],
    schema: [
      faqSchema(faqs),
      {
        '@type': 'Service',
        '@id': `${abs(site.origin, path)}#service`,
        name: `Cash home buying in ${c.name}, ${site.stateAbbr}`,
        serviceType: 'Cash home buying',
        provider: { '@id': `${site.origin}/#organization` },
        areaServed: {
          '@type': 'City',
          name: `${c.name}, ${site.stateAbbr}`,
          containedInPlace: { '@type': 'AdministrativeArea', name: c.county },
        },
        description: `We buy houses in ${c.name} for cash, as-is, with no fees or commissions.`,
      },
    ],
    body: `
${breadcrumbs([
  { name: 'Areas we buy', path: '/locations/' },
  { name: c.name, path },
])}

<section class="hero hero--local">
  ${heroArt()}
  <div class="container hero__inner">
    <div class="hero__copy">
      <p class="hero__eyebrow"><span class="hero__dot" aria-hidden="true"></span> ${esc(c.name)}, ${esc(site.stateAbbr)} · ${esc(c.county)}</p>
      <h1 class="hero__title">We buy houses in ${esc(c.name)} — <em>cash, as-is, on your timeline</em></h1>
      <p class="hero__lede">${esc(c.intro)}</p>
      <ul class="hero__points">
        <li>Written cash offer within ${esc(S.avgOfferHours)} hours</li>
        <li>Close in as little as ${esc(S.fastestCloseDays)} days at a local title company</li>
        <li>No repairs, no cleaning, no commissions, no closing costs</li>
        <li>We buy across ${esc(c.county)}, including ${esc(c.neighborhoods.slice(0, 3).join(', '))}</li>
      </ul>
    </div>
    <div class="hero__form">
      <div class="form-card">
        <h2 class="form-card__title">Get my free ${esc(c.name)} cash offer</h2>
        <p class="form-card__sub">No fees. No obligation. About 60 seconds.</p>
        ${leadForm({ id: `offer-form-${c.slug}`, source: `city-${c.slug}` })}
      </div>
    </div>
  </div>
</section>

${trustBar()}

<section class="section" data-reveal>
  <div class="container container--narrow prose">
    <h2>Selling a house fast in ${esc(c.name)}</h2>
    <p>${esc(c.market)}</p>
    <p class="callout">${esc(c.localNote)}</p>
    <h3>Neighborhoods and areas we buy in</h3>
    <ul class="pill-list">
      ${c.neighborhoods.map((n) => `<li><span class="pill pill--static">${esc(n)}</span></li>`).join('\n      ')}
    </ul>
    <h3>${esc(c.name)} ZIP codes</h3>
    <p class="zip-line">${c.zips.map((z) => esc(z)).join(' · ')}</p>
    <p>Not on the list? We still probably buy there. Call <a href="tel:${esc(site.phoneHref)}">${esc(site.phone)}</a> and ask.</p>
  </div>
</section>

<section class="section section--alt" data-reveal>
  <div class="container">
    <p class="eyebrow">${icon('users')} Any situation</p>
    <h2 class="section__title">Why ${esc(c.name)} homeowners call us</h2>
    <ul class="card-grid">
      ${situations
        .slice(0, 6)
        .map(
          (s) => `
      <li class="card card--icon">
        ${icon(situationIcon[s.slug] || 'home', 'card__icon')}
        <h3 class="card__title"><a href="/situations/${s.slug}/">${esc(s.nav)}</a></h3>
        <p class="card__text">${esc(s.intro.split('.')[0])}.</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

${steps()}

<section class="section">
  <div class="container">
    <h2 class="section__title">Cash offer vs. listing in ${esc(c.name)}</h2>
    <p class="section__lede">Compare the net, not the sticker price. <a href="/compare/">See the full breakdown →</a></p>
    ${comparisonTable()}
  </div>
</section>

${faqSection(faqs, { heading: `${c.name} cash home buyer FAQ`, showAllLink: true })}

<section class="section section--alt">
  <div class="container">
    <h2 class="section__title">We also buy houses in</h2>
    <ul class="pill-list">
      ${others
        .map(
          (o) =>
            `<li><a class="pill" href="/we-buy-houses/${o.slug}/">${esc(o.name)}</a></li>`,
        )
        .join('\n      ')}
      <li><a class="pill" href="/locations/">All areas →</a></li>
    </ul>
  </div>
</section>

${ctaBand({
  heading: `Get your free ${c.name} cash offer`,
  text: 'One form, about a minute. A written offer within 24 hours, with the math shown.',
  source: `city-${c.slug}-footer`,
})}
`,
  };
};

const locationsIndex = () => ({
  path: '/locations/',
  title: `Areas We Buy Houses | ${site.marketName} Cash Home Buyers`,
  description: `We buy houses for cash across ${site.marketName}: ${cities.slice(0, 5).map((c) => c.name).join(', ')} and the surrounding area. Free offer in ${S.avgOfferHours} hours, no fees.`,
  crumbs: [{ name: 'Areas we buy', path: '/locations/' }],
  body: `
${breadcrumbs([{ name: 'Areas we buy', path: '/locations/' }])}
${pageHero({
  eyebrow: 'Service area',
  h1: `Where we buy houses in ${site.marketName}`,
  lede: `We are local: local buyers, local title companies, local contractors. Pick your city below, or call ${site.phone} — if you are anywhere in ${site.marketName}, we probably buy there.`,
})}

<section class="section">
  <div class="container">
    <ul class="card-grid">
      ${cities
        .map(
          (c) => `
      <li class="card card--city">
        <h2 class="card__title"><a href="/we-buy-houses/${c.slug}/">We buy houses in ${esc(c.name)}</a></h2>
        <p class="card__meta">${esc(c.county)}</p>
        <p class="card__text">${esc(c.intro.split('.').slice(0, 2).join('.'))}.</p>
        <p class="card__zips">${c.zips.slice(0, 4).map(esc).join(' · ')}</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

<section class="section section--alt">
  <div class="container container--narrow prose">
    <h2>Do not see your city?</h2>
    <p>
      This list is where we buy most often, not a boundary. We regularly buy elsewhere in
      ${esc(site.marketName)} and the surrounding counties. Send us the address and we will tell you
      straight away whether it is in our area — and if it is not, we will point you to someone
      reputable who does buy there.
    </p>
  </div>
</section>

${testimonialsSection()}
${ctaBand({ source: 'locations' })}
`,
});

export const localPages = () => [locationsIndex(), ...cities.map(cityPage)];
