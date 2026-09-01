import { site } from '../config.mjs';
import { esc, abs } from '../lib/html.mjs';
import { faqSchema } from '../layout.mjs';
import {
  cities,
  citiesByState,
  statesTree,
  stateHubs,
  cityPath,
  statePath,
} from '../content/cities.mjs';
import { states, stateByName } from '../content/states.mjs';
import { situations } from '../content/situations.mjs';
import { icon, situationIcon } from '../lib/icons.mjs';
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
const AREAS = { name: 'Areas we buy', path: '/locations/' };

/* ------------------------------------------------------------ city pages */

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
  const path = cityPath(c);
  const state = stateByName[c.state];
  const sameMetro = cities.filter((x) => x.slug !== c.slug && x.metro === c.metro);
  const sameState = citiesByState[c.state].filter(
    (x) => x.slug !== c.slug && x.metro !== c.metro,
  );
  const nearby = [...sameMetro, ...sameState].slice(0, 6);
  const faqs = cityFaqs(c);
  const crumbs = [
    AREAS,
    { name: c.state, path: statePath(c.state) },
    { name: c.name, path },
  ];

  return {
    path,
    title: `We Buy Houses ${c.name}, ${state.abbr} | Cash Offer in ${S.avgOfferHours} Hours`,
    description: `We buy houses in ${c.name}, ${state.abbr} for cash — as-is, no repairs, no fees, no commissions. Free written offer in ${S.avgOfferHours} hours, and you pick the closing date.`,
    crumbs,
    schema: [
      faqSchema(faqs),
      {
        '@type': 'Service',
        '@id': `${abs(site.origin, path)}#service`,
        name: `Cash home buying in ${c.name}, ${state.abbr}`,
        serviceType: 'Cash home buying',
        provider: { '@id': `${site.origin}/#organization` },
        areaServed: {
          '@type': 'City',
          name: `${c.name}, ${state.abbr}`,
          containedInPlace: [
            { '@type': 'AdministrativeArea', name: c.county },
            { '@type': 'State', name: c.state },
          ],
        },
        description: `We buy houses in ${c.name} for cash, as-is, with no fees or commissions.`,
      },
    ],
    body: `
${breadcrumbs(crumbs)}

<section class="hero hero--local">
  ${heroArt()}
  <div class="container hero__inner">
    <div class="hero__copy">
      <p class="hero__eyebrow"><span class="hero__dot" aria-hidden="true"></span> ${esc(c.name)}, ${esc(state.abbr)} · ${esc(c.county)}</p>
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
        ${leadForm({ id: `offer-form-${c.slug}`, source: `city-${c.slug}`, city: c.name, stateAbbr: state.abbr })}
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
    <p>Not on the list? We still probably buy there. Call <a href="tel:${esc(site.phoneHref)}">${esc(site.phone)}</a> and ask, or see everywhere we buy in <a href="${statePath(c.state)}">${esc(c.state)}</a>.</p>
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

<section class="section" data-reveal>
  <div class="container">
    <h2 class="section__title">Cash offer vs. listing in ${esc(c.name)}</h2>
    <p class="section__lede">Compare the net, not the sticker price. <a href="/compare/">See the full breakdown →</a></p>
    ${comparisonTable()}
  </div>
</section>

${faqSection(faqs, { heading: `${c.name} cash home buyer FAQ`, showAllLink: true })}

<section class="section section--alt" data-reveal>
  <div class="container">
    <h2 class="section__title">We also buy houses in</h2>
    <p class="section__lede">Nearby in ${esc(c.metro)}, and across ${esc(c.state)}.</p>
    <ul class="pill-list">
      ${nearby
        .map((o) => `<li><a class="pill" href="${cityPath(o)}">${esc(o.name)}</a></li>`)
        .join('\n      ')}
      <li><a class="pill" href="${statePath(c.state)}">All of ${esc(c.state)} →</a></li>
    </ul>
  </div>
</section>

${ctaBand({
  heading: `Get your free ${c.name} cash offer`,
  text: 'One form, about a minute. A written offer within 24 hours, with the math shown.',
  source: `city-${c.slug}-footer`,
  city: c.name,
  stateAbbr: state.abbr,
})}
`,
  };
};

/* ----------------------------------------------------------- state hubs */

const statePage = (st) => {
  const path = statePath(st.name);
  const tree = statesTree[st.name];
  const cityCount = citiesByState[st.name].length;
  const crumbs = [AREAS, { name: st.name, path }];

  return {
    path,
    title: st.title,
    description: st.description,
    crumbs,
    schema: [
      faqSchema(st.faqs),
      {
        '@type': 'Service',
        '@id': `${abs(site.origin, path)}#service`,
        name: `Cash home buying in ${st.name}`,
        serviceType: 'Cash home buying',
        provider: { '@id': `${site.origin}/#organization` },
        areaServed: { '@type': 'State', name: st.name },
        description: st.description,
      },
    ],
    body: `
${breadcrumbs(crumbs)}

<section class="hero hero--local">
  ${heroArt()}
  <div class="container hero__inner">
    <div class="hero__copy">
      <p class="hero__eyebrow"><span class="hero__dot" aria-hidden="true"></span> ${esc(st.name)} · ${esc(String(cityCount))} cities</p>
      <h1 class="hero__title">${esc(st.h1)}</h1>
      <p class="hero__lede">${esc(st.intro)}</p>
      <ul class="hero__points">
        <li>Written cash offer within ${esc(S.avgOfferHours)} hours</li>
        <li>Close in as little as ${esc(S.fastestCloseDays)} days, or on your date</li>
        <li>No repairs, no cleaning, no commissions, no closing costs</li>
        <li>Local title companies and local crews in every market</li>
      </ul>
    </div>
    <div class="hero__form">
      <div class="form-card">
        <h2 class="form-card__title">Get my free ${esc(st.name)} cash offer</h2>
        <p class="form-card__sub">No fees. No obligation. About 60 seconds.</p>
        ${leadForm({
          id: `offer-form-${st.slug}`,
          source: `state-${st.slug}`,
          city: citiesByState[st.name][0].name,
          stateAbbr: st.abbr,
        })}
      </div>
    </div>
  </div>
</section>

${trustBar()}

<section class="section" data-reveal>
  <div class="container">
    <p class="eyebrow">${icon('pin')} What's different about ${esc(st.name)}</p>
    <h2 class="section__title">Selling a house in ${esc(st.name)}</h2>
    <ul class="card-grid">
      ${st.points
        .map(
          (p) => `
      <li class="card card--help">
        ${icon('check', 'card__icon card__icon--check')}
        <h3 class="card__title">${esc(p.h)}</h3>
        <p class="card__text">${esc(p.p)}</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

<section class="section section--alt" data-reveal>
  <div class="container">
    <p class="eyebrow">${icon('home')} Where we buy</p>
    <h2 class="section__title">${esc(st.name)} markets we buy in</h2>
    ${Object.entries(tree)
      .map(
        ([metro, group]) => `
    <div class="metro-block">
      <h3 class="metro-block__name">${esc(metro)}</h3>
      <ul class="pill-list">
        ${group.map((c) => `<li><a class="pill" href="${cityPath(c)}">${esc(c.name)}</a></li>`).join('\n        ')}
      </ul>
    </div>`,
      )
      .join('')}
    <p class="section__after">Not listed? Call <a href="tel:${esc(site.phoneHref)}">${esc(site.phone)}</a> — we buy across ${esc(st.name)}, not only in these cities.</p>
  </div>
</section>

${steps()}
${faqSection(st.faqs, { heading: `Selling a house in ${st.name}: common questions` })}

<section class="section section--alt" data-reveal>
  <div class="container container--narrow">
    <p class="disclaimer-note">
      This page describes ${esc(st.name)} generally and is not legal or tax advice. Foreclosure,
      probate and tenancy rules turn on your specific facts — talk to a licensed ${esc(st.name)}
      attorney or CPA about yours.
    </p>
  </div>
</section>

${ctaBand({
  heading: `Get your free ${st.name} cash offer`,
  source: `state-${st.slug}`,
  city: citiesByState[st.name][0].name,
  stateAbbr: st.abbr,
})}
`,
  };
};

/* ------------------------------------------------------ national index */

const locationsIndex = () => ({
  path: '/locations/',
  title: `Where We Buy Houses | ${states.map((s) => s.abbr).join(', ')}`,
  description: `We buy houses for cash in ${states.map((s) => s.name).join(', ')} — ${cities.length} cities and the towns around them. Free offer in ${S.avgOfferHours} hours, no fees.`,
  crumbs: [AREAS],
  body: `
${breadcrumbs([AREAS])}
${pageHero({
  eyebrow: 'Service area',
  iconName: 'pin',
  h1: 'Where we buy houses',
  lede: `${cities.length} cities across ${states.length} states, with local buyers, local title companies and local crews in each one. Find your state below — or call ${site.phone} and ask, because this list is where we buy most often, not a boundary.`,
})}

<section class="section" data-reveal>
  <div class="container">
    <ul class="card-grid card-grid--3">
      ${states
        .map(
          (st) => `
      <li class="card card--city">
        ${icon('pin', 'card__icon')}
        <h2 class="card__title"><a href="${statePath(st.name)}">We buy houses in ${esc(st.name)}</a></h2>
        <p class="card__meta">${esc(String(citiesByState[st.name].length))} cities · ${esc(Object.keys(statesTree[st.name]).join(', '))}</p>
        <p class="card__text">${esc(st.intro.split('.')[0])}.</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

${states
  .map(
    (st, i) => `
<section class="section${i % 2 === 0 ? ' section--alt' : ''}" id="${st.slug}" data-reveal>
  <div class="container">
    <p class="eyebrow">${esc(st.name)}</p>
    <h2 class="section__title"><a class="plain-link" href="${statePath(st.name)}">We buy houses across ${esc(st.name)}</a></h2>
    ${Object.entries(statesTree[st.name])
      .map(
        ([metro, group]) => `
    <div class="metro-block">
      <h3 class="metro-block__name">${esc(metro)}</h3>
      <ul class="pill-list">
        ${group.map((c) => `<li><a class="pill" href="${cityPath(c)}">${esc(c.name)}</a></li>`).join('\n        ')}
      </ul>
    </div>`,
      )
      .join('')}
  </div>
</section>`,
  )
  .join('')}

<section class="section" data-reveal>
  <div class="container container--narrow prose">
    <h2>Do not see your state?</h2>
    <p>
      Then we are not the right buyer for you yet — and we would rather say that than take your
      details and waste your week. We buy in ${esc(states.map((s) => s.name).join(', '))} today, and
      we open new markets by putting people and a title relationship on the ground first, not by
      putting up a page.
    </p>
    <p>
      If you are outside those states, two suggestions. Ask any local buyer for proof of funds and
      the name of the title company they close at, then call that company. And read
      <a href="/blog/we-buy-houses-scam-red-flags/">our guide to spotting a predatory buyer</a> —
      it applies anywhere, and it is the same list we would want our own family using.
    </p>
  </div>
</section>

${testimonialsSection()}
${ctaBand({ source: 'locations' })}
`,
});

export const localPages = () => [
  locationsIndex(),
  ...states.map(statePage),
  ...cities.map(cityPage),
];
