import { site, hasAnalytics } from './config.mjs';
import { esc, jsonLd, join, abs } from './lib/html.mjs';
import { icon } from './lib/icons.mjs';
import { cities, metros } from './content/cities.mjs';
import { situations } from './content/situations.mjs';

const A = site.address;

/* ------------------------------------------------------------------ schema */

/**
 * Emitted on every page. A single @graph with stable @ids lets Google resolve
 * the business as one entity instead of a dozen unrelated snippets.
 */
const orgGraph = () => [
  {
    '@type': ['LocalBusiness', 'RealEstateAgent'],
    '@id': `${site.origin}/#organization`,
    name: site.name,
    legalName: site.legalName,
    description: site.description,
    url: `${site.origin}/`,
    telephone: site.phoneHref,
    email: site.email,
    priceRange: 'Free cash offers — no fees to sellers',
    image: abs(site.origin, '/img/og-default.png'),
    logo: {
      '@type': 'ImageObject',
      url: abs(site.origin, '/img/logo.png'),
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: A.street,
      addressLocality: A.city,
      addressRegion: A.region,
      postalCode: A.postalCode,
      addressCountry: A.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: site.geo.lat,
      longitude: site.geo.lng,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ],
        opens: '08:00',
        closes: '20:00',
      },
    ],
    areaServed: [
      { '@type': 'State', name: site.stateName },
      ...cities.map((c) => ({ '@type': 'City', name: `${c.name}, ${site.stateAbbr}` })),
    ],
    knowsAbout: [
      'cash home buying',
      'as-is home sales',
      'foreclosure prevention',
      'probate and inherited property sales',
    ],
    ...(site.sameAs.length ? { sameAs: site.sameAs } : {}),
    // NOTE: no aggregateRating on purpose. Do not add star markup until you
    // have real, verifiable reviews — fabricated ratings are review fraud.
  },
  {
    '@type': 'WebSite',
    '@id': `${site.origin}/#website`,
    url: `${site.origin}/`,
    name: site.name,
    publisher: { '@id': `${site.origin}/#organization` },
    inLanguage: 'en-US',
  },
];

const breadcrumbSchema = (crumbs, path) => ({
  '@type': 'BreadcrumbList',
  '@id': `${abs(site.origin, path)}#breadcrumbs`,
  itemListElement: [{ name: 'Home', path: '/' }, ...crumbs].map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: abs(site.origin, c.path),
  })),
});

export const faqSchema = (faqs) => ({
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

/* ------------------------------------------------------------------- chrome */

const logo = (className = 'logo') => `
<a class="${className}" href="/" aria-label="${esc(site.name)} — home">
  <span class="logo__badge">
    <svg class="logo__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="20" r="7.5" class="logo__halo"/>
      <path d="M4 15 16 4l12 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M7 14v13h18V14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="16" cy="20" r="3.4" class="logo__glow"/>
    </svg>
  </span>
  <span class="logo__text">Porchlight<span class="logo__accent">Offers</span></span>
</a>`;

const navLinks = [
  { href: '/how-it-works/', label: 'How it works' },
  { href: '/compare/', label: 'Cash vs. agent' },
  { href: '/situations/', label: 'Situations' },
  { href: '/locations/', label: 'Areas we buy' },
  { href: '/reviews/', label: 'Reviews' },
  { href: '/faq/', label: 'FAQ' },
];

const header = (path) => `
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header" id="site-header">
  <div class="container site-header__inner">
    ${logo()}
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
      <span class="nav-toggle__bar"></span><span class="nav-toggle__bar"></span><span class="nav-toggle__bar"></span>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul class="site-nav__list">
        ${navLinks
          .map(
            (l) =>
              `<li><a href="${l.href}"${path.startsWith(l.href) && l.href !== '/' ? ' aria-current="page"' : ''}>${esc(l.label)}</a></li>`,
          )
          .join('\n        ')}
      </ul>
      <div class="site-nav__cta">
        <a class="btn btn--ghost" href="tel:${esc(site.phoneHref)}" data-track="header-call">
          ${icon('phone', 'btn__icon')} ${esc(site.phone)}
        </a>
        <a class="btn btn--primary" href="/#offer-form" data-track="header-cta">Get my cash offer</a>
      </div>
    </nav>
  </div>
</header>`;

const footer = () => `
<footer class="site-footer">
  <div class="container">
    <ul class="footer-badges">
      <li>${icon('shield')} We close at a licensed title company</li>
      <li>${icon('wallet')} We never charge homeowners a fee</li>
      <li>${icon('lock')} Your information is never sold</li>
      <li>${icon('handshake')} We'll tell you if listing nets more</li>
    </ul>
    <div class="footer-grid">
      <div class="footer-brand">
        ${logo('logo logo--footer')}
        <p class="footer-tagline">${esc(site.tagline)}</p>
        <p class="footer-blurb">We buy houses for cash across ${esc(site.marketName)} — any condition, any situation, no fees.</p>
        <address class="footer-nap">
          <a class="footer-phone" href="tel:${esc(site.phoneHref)}" data-track="footer-call">${esc(site.phone)}</a><br>
          <a href="mailto:${esc(site.email)}">${esc(site.email)}</a><br>
          <span>${esc(A.street)}<br>${esc(A.city)}, ${esc(A.region)} ${esc(A.postalCode)}</span><br>
          <span class="footer-hours">${esc(site.hours)}</span>
        </address>
      </div>
      <div class="footer-col">
        <h2 class="footer-head">Company</h2>
        <ul>
          <li><a href="/how-it-works/">How it works</a></li>
          <li><a href="/compare/">Cash offer vs. agent</a></li>
          <li><a href="/about/">About us</a></li>
          <li><a href="/reviews/">Reviews</a></li>
          <li><a href="/faq/">FAQ</a></li>
          <li><a href="/blog/">Guides &amp; blog</a></li>
          <li><a href="/contact/">Contact</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2 class="footer-head">We buy in any situation</h2>
        <ul>
          ${situations
            .map((s) => `<li><a href="/situations/${s.slug}/">${esc(s.nav)}</a></li>`)
            .join('\n          ')}
        </ul>
      </div>
      <div class="footer-col">
        <h2 class="footer-head">Areas we buy houses</h2>
        ${Object.entries(metros)
          .map(
            ([metro, group]) => `
        <p class="footer-metro">${esc(metro)}</p>
        <ul>
          ${group
            .map((c) => `<li><a href="/we-buy-houses/${c.slug}/">${esc(c.name)}</a></li>`)
            .join('\n          ')}
        </ul>`,
          )
          .join('')}
        <p class="footer-all"><a href="/locations/">All areas we buy →</a></p>
      </div>
    </div>
    <div class="footer-legal">
      <p>&copy; ${new Date().getFullYear()} ${esc(site.legalName)}. All rights reserved.</p>
      <ul class="footer-legal__links">
        <li><a href="/privacy/">Privacy policy</a></li>
        <li><a href="/terms/">Terms of use</a></li>
        <li><a href="/sitemap.xml">Sitemap</a></li>
      </ul>
      <p class="footer-disclaimer">
        ${esc(site.legalName)} is a real estate investment company that buys houses directly from
        homeowners. We are not real estate agents or brokers, we do not list properties, and we do
        not provide legal, tax or financial advice. Offers are estimates until a written purchase
        agreement is signed. Nothing on this site is a solicitation for a mortgage, loan
        modification, or foreclosure rescue service, and we never charge homeowners a fee.
      </p>
    </div>
  </div>
</footer>`;

/** Persistent mobile action bar — the single biggest mobile CRO win. */
const mobileBar = () => `
<div class="mobile-bar" role="region" aria-label="Contact actions">
  <a class="mobile-bar__call" href="tel:${esc(site.phoneHref)}" data-track="mobilebar-call">
    ${icon('phone')} Call now
  </a>
  <a class="mobile-bar__cta" href="/#offer-form" data-track="mobilebar-cta">Get my offer</a>
</div>`;

/* -------------------------------------------------------------------- page */

/**
 * @param {object} p
 * @param {string} p.path      Site-root path, e.g. '/how-it-works/'
 * @param {string} p.title     <title> (keep under ~60 chars)
 * @param {string} p.description meta description (~150–160 chars)
 * @param {string} p.body      page HTML
 * @param {Array}  [p.crumbs]  [{name, path}] excluding Home
 * @param {Array}  [p.schema]  extra JSON-LD nodes
 * @param {boolean}[p.noindex]
 * @param {string} [p.ogType]
 * @param {string} [p.bodyClass]
 */
export function renderPage(p) {
  const canonical = abs(site.origin, p.path);
  const graph = [
    ...orgGraph(),
    ...(p.crumbs?.length ? [breadcrumbSchema(p.crumbs, p.path)] : []),
    ...(p.schema ?? []),
  ];

  const analytics = !hasAnalytics
    ? ''
    : site.analytics.gtmId
      ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${site.analytics.gtmId}');</script>`
      : `<script async src="https://www.googletagmanager.com/gtag/js?id=${site.analytics.gaId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${site.analytics.gaId}');</script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${esc(canonical)}">
${p.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">'}
<meta name="theme-color" content="#0f2440">
<script>document.documentElement.classList.add('js')</script>
<meta property="og:type" content="${esc(p.ogType ?? 'website')}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(abs(site.origin, '/img/og-default.png'))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${esc(site.locale)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${esc(abs(site.origin, '/img/og-default.png'))}">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">
${jsonLd({ '@context': 'https://schema.org', '@graph': graph })}
</script>
${analytics}
</head>
<body${p.bodyClass ? ` class="${esc(p.bodyClass)}"` : ''}>
${header(p.path)}
<main id="main">
${p.body}
</main>
${footer()}
${mobileBar()}
<script src="/main.js" defer></script>
</body>
</html>
`;
}

export { logo };
