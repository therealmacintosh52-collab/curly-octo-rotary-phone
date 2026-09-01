import { site } from '../config.mjs';
import { esc } from '../lib/html.mjs';
import { faqSchema } from '../layout.mjs';
import { faqs, homeFaqs } from '../content/faqs.mjs';
import { cities, statesTree, citiesByState, cityPath, statePath } from '../content/cities.mjs';
import { states } from '../content/states.mjs';
import { situations } from '../content/situations.mjs';
import { icon } from '../lib/icons.mjs';
import {
  heroArt,
  leadForm,
  trustBar,
  steps,
  comparisonTable,
  situationsGrid,
  testimonialsSection,
  faqSection,
  ctaBand,
  breadcrumbs,
  pageHero,
} from '../components.mjs';

const S = site.stats;

/* --------------------------------------------------------------- home */

const home = () => ({
  path: '/',
  title: `We Buy Houses for Cash | Sell Your House Fast, As-Is`,
  description: `Sell your house fast for cash in ${states.map((s) => s.name).join(', ')}. Any condition, any situation. No repairs, no fees, no commissions — you pick the closing date.`,
  schema: [faqSchema(homeFaqs)],
  body: `
<section class="hero">
  ${heroArt()}
  <div class="container hero__inner">
    <div class="hero__copy">
      <p class="hero__eyebrow"><span class="hero__dot" aria-hidden="true"></span> Cash home buyers in ${esc(states.map((s) => s.name).join(' · '))}</p>
      <h1 class="hero__title">Sell your house fast for cash — <em>any condition, any situation</em></h1>
      <p class="hero__lede">
        Get a fair written cash offer in ${esc(S.avgOfferHours)} hours and close in as
        little as ${esc(S.fastestCloseDays)} days. No repairs. No cleaning. No agent
        commissions. No closing costs. You pick the day we close.
      </p>
      <ul class="hero__points">
        <li>We buy as-is — leave the repairs and the clutter to us</li>
        <li>Zero fees, zero commissions, we cover closing costs</li>
        <li>We show you exactly how we calculated your offer</li>
        <li>No obligation, no pressure, and no expiring offers</li>
      </ul>
      <p class="hero__proof">
        <span class="hero__proof-stat"><strong data-count="${esc(S.housesBought)}">${esc(S.housesBought)}</strong> houses bought</span>
        <span class="hero__proof-stat"><strong data-count="${esc(S.yearsBuying)}">${esc(S.yearsBuying)}</strong> years buying houses</span>
        <span class="hero__proof-stat"><strong data-count="${esc(String(cities.length))}">${esc(String(cities.length))}</strong> cities in ${esc(String(states.length))} states</span>
      </p>
    </div>
    <div class="hero__form">
      <div class="form-card">
        <h2 class="form-card__title">Get my free cash offer</h2>
        <p class="form-card__sub">No fees. No obligation. Takes about 60 seconds.</p>
        ${leadForm({ id: 'offer-form', source: 'home-hero' })}
      </div>
    </div>
  </div>
</section>

${trustBar()}

${steps()}

<section class="section section--alt" data-reveal>
  <div class="container">
    <p class="eyebrow">${icon('spark')} Why sellers choose us</p>
    <h2 class="section__title">The whole point is that it's easy</h2>
    <ul class="benefit-grid">
      ${[
        ['hammer', 'Sell exactly as it sits', 'Foundation, roof, mold, fire damage, a house full of belongings — none of it disqualifies you. We have bought houses people were embarrassed to show us.'],
        ['lock', "Our price doesn't move", 'We inspect once, before the contract. The number you sign is the number you get wired. No post-inspection renegotiation, ever.'],
        ['wallet', 'You keep every dollar', 'No commissions, no listing fees, no closing costs on your side. The offer is your net, less any mortgage payoff or liens the title company must clear.'],
        ['calendar', 'You control the calendar', `Close in ${S.fastestCloseDays} days if you're in a hurry, or 90 days out if you need time. Need to stay a couple weeks after closing? Just ask.`],
        ['chart', 'We show our math', "You'll see the comparable sales, our repair estimate, and our costs. If a buyer won't show you how they got their number, be careful."],
        ['handshake', "We'll tell you when to list instead", "If your house is in good shape and you have time to wait, an agent will probably net you more — and we'll say so on the phone. That honesty is why we still get referrals."],
      ]
        .map(
          ([ic, title, text]) => `
      <li class="benefit">
        ${icon(ic, 'benefit__icon')}
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>

<section class="section" data-reveal>
  <div class="container">
    <p class="eyebrow">${icon('scales')} Straight comparison</p>
    <h2 class="section__title">Cash offer vs. listing with an agent</h2>
    <p class="section__lede">
      A cash offer trades some sale price for speed, certainty and zero cost. Here's the honest
      side-by-side — including the part where listing sometimes wins.
    </p>
    ${comparisonTable()}
    <p class="section__after">
      <a class="btn btn--secondary" href="/compare/">See a full net-proceeds breakdown →</a>
    </p>
  </div>
</section>

${situationsGrid()}

${testimonialsSection()}

<section class="section" data-reveal>
  <div class="container">
    <p class="eyebrow">${icon('pin')} Where we buy</p>
    <h2 class="section__title">We buy houses in ${esc(String(states.length))} states — and counting</h2>
    <p class="section__lede">Local buyers, local title companies and local crews in every market we enter. If your city isn't listed, call and ask — the list is where we buy most often, not a boundary.</p>
    ${states
      .map(
        (st) => `
    <div class="metro-block">
      <h3 class="metro-block__name"><a href="${statePath(st.name)}">${esc(st.name)}</a> · ${esc(String(citiesByState[st.name].length))} cities</h3>
      <ul class="pill-list">
        ${citiesByState[st.name]
          .map((c) => `<li><a class="pill" href="${cityPath(c)}">${esc(c.name)}</a></li>`)
          .join('\n        ')}
      </ul>
    </div>`,
      )
      .join('')}
    <p class="section__after"><a href="/locations/">See all areas we serve →</a></p>
  </div>
</section>

${faqSection(homeFaqs)}

${ctaBand({ source: 'home-footer' })}
`,
});

/* ------------------------------------------------------- how it works */

const howItWorks = () => ({
  path: '/how-it-works/',
  title: 'How Selling Your House for Cash Works | 3 Simple Steps',
  description: `Exactly how our cash home buying process works, from your first call to the wire hitting your account: one walkthrough, a written offer, your closing date.`,
  crumbs: [{ name: 'How it works', path: '/how-it-works/' }],
  body: `
${breadcrumbs([{ name: 'How it works', path: '/how-it-works/' }])}
${pageHero({
  eyebrow: 'The process',
  h1: 'How selling your house to us actually works',
  lede: `No mystery and no runaround. Here is every step, what we need from you, and what happens on your end — including the part where we show you the math behind your offer.`,
})}

<section class="section">
  <div class="container">
    <div class="with-rail">
      <div class="with-rail__main">
        <ol class="timeline">
      <li class="timeline__item">
        <h2>Day 0 — You reach out</h2>
        <p>Fill out the form or call ${esc(site.phone)}. We need the address, a rough sense of condition, and how to reach you. That's it — no Social Security number, no bank details, no credit check. A real person calls you back the same business day.</p>
        <p class="timeline__note">On that call we ask what's driving the sale and when you'd want to close, then give you a preliminary range so you know immediately whether this is worth your time.</p>
      </li>
      <li class="timeline__item">
        <h2>Day 1–2 — One short walkthrough</h2>
        <p>We come see the house. It takes about 20 minutes. Do not clean, do not fix anything, do not move the boxes — we are pricing the house as it stands, and seeing it accurately is what lets us commit to a price and hold it.</p>
        <p class="timeline__note">Out of state? A video walkthrough on your phone works. For rentals, we schedule around your tenants with proper notice.</p>
      </li>
      <li class="timeline__item">
        <h2>Within ${esc(S.avgOfferHours)} hours — A written offer, with the math</h2>
        <p>You get the offer in writing, along with the comparable sales we used, our repair estimate, and our costs. Nothing is hidden and nothing expires. Take a day, take two weeks, show it to your attorney or your kids.</p>
        <p class="timeline__note">Our price is not subject to reduction after an inspection. That is in the contract.</p>
      </li>
      <li class="timeline__item">
        <h2>You choose the closing date</h2>
        <p>As fast as ${esc(S.fastestCloseDays)} days once title is clear, or months out if that suits you better. Need extra time to move after closing? Ask about a short rent-back — it's usually workable.</p>
      </li>
      <li class="timeline__item">
        <h2>Title work happens in the background</h2>
        <p>A licensed local title company runs the title search, orders the payoff on any mortgage, and clears liens, back taxes and judgments out of the proceeds. You don't chase any of it. If something unusual turns up, we tell you the same day we find out.</p>
      </li>
      <li class="timeline__item">
        <h2>Closing day — you get paid</h2>
        <p>Sign at the title company or with a mobile notary; remote online notarization is available if you've already moved. Funds are wired the same day. Leave whatever you don't want in the house — we handle the cleanout.</p>
      </li>
    </ol>
      </div>
      <aside class="with-rail__aside">
        <div class="rail-card">
          <h2 class="form-card__title">Get my free cash offer</h2>
          <p class="form-card__sub">No fees. No obligation. About 60 seconds.</p>
          ${leadForm({ id: 'offer-form-rail', compact: true, source: 'how-it-works-rail' })}
        </div>
      </aside>
    </div>
  </div>
</section>

<section class="section section--alt">
  <div class="container container--narrow">
    <h2 class="section__title">What we need from you</h2>
    <ul class="check-list">
      <li>The property address and a way to reach you</li>
      <li>Honest disclosure of known problems — surprises are what make other buyers drop their price later</li>
      <li>Signatures from everyone on title (heirs, spouses, trustees — title will tell us who)</li>
      <li>Your mortgage lender and loan number, if there's a loan on it</li>
      <li>Access for one walkthrough</li>
    </ul>
    <h2 class="section__title">What we never ask for</h2>
    <ul class="check-list check-list--no">
      <li>Money up front, for any reason</li>
      <li>Repairs, cleaning, staging, or a cleanout</li>
      <li>A deed signed outside of a title company closing</li>
      <li>A decision on the spot</li>
    </ul>
    <p class="callout">
      Hold every cash buyer to that second list — including us. Our guide to
      <a href="/blog/we-buy-houses-scam-red-flags/">spotting a "we buy houses" scam</a> covers what to
      verify before you sign anything.
    </p>
  </div>
</section>

${faqSection(faqs.slice(0, 6), { heading: 'Process questions' })}
${ctaBand({ heading: 'Start with a free, no-obligation offer', source: 'how-it-works' })}
`,
});

/* ------------------------------------------------------------ compare */

const compare = () => ({
  path: '/compare/',
  title: 'Cash Offer vs. Realtor: Compare Your Net Proceeds',
  description:
    'Cash buyer or listing agent? A line-by-line net proceeds comparison covering commissions, repairs, holding costs and concessions — plus when listing wins.',
  crumbs: [{ name: 'Cash offer vs. agent', path: '/compare/' }],
  body: `
${breadcrumbs([{ name: 'Cash offer vs. agent', path: '/compare/' }])}
${pageHero({
  eyebrow: 'Honest comparison',
  h1: 'Cash offer vs. listing with an agent',
  lede: 'Most sellers compare our offer to a list price. That is the wrong comparison. Compare what actually lands in your bank account, and how long you wait for it.',
})}

<section class="section">
  <div class="container">
    ${comparisonTable()}
  </div>
</section>

<section class="section section--alt">
  <div class="container container--narrow">
    <h2 class="section__title">A worked example</h2>
    <p>A house worth $300,000 fully renovated, needing about $55,000 of work. Illustrative numbers — run yours with real repair estimates.</p>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th scope="col">Line</th><th scope="col">List with an agent</th><th scope="col">Sell to us</th></tr></thead>
        <tbody>
          <tr><th scope="row">Sale price</th><td>$300,000</td><td>$173,000</td></tr>
          <tr><th scope="row">Repairs to be sale-ready</th><td>−$55,000</td><td>$0</td></tr>
          <tr><th scope="row">Commissions (6%)</th><td>−$18,000</td><td>$0</td></tr>
          <tr><th scope="row">Seller closing costs (2%)</th><td>−$6,000</td><td>$0</td></tr>
          <tr><th scope="row">Post-inspection concessions</th><td>−$5,000</td><td>$0</td></tr>
          <tr><th scope="row">Holding costs while it sells</th><td>−$9,000</td><td>−$400</td></tr>
          <tr class="total"><th scope="row">Estimated net to you</th><td>$207,000</td><td>$172,600</td></tr>
          <tr><th scope="row">Time to cash</th><td>4–7 months</td><td>7–21 days</td></tr>
          <tr><th scope="row">Out of pocket first</th><td>$55,000+</td><td>$0</td></tr>
        </tbody>
      </table>
    </div>
    <p>The gap here is roughly $34,000 — real money. What you buy with it is five months of your life, $55,000 you don't have to front, and no chance of a financed buyer collapsing the deal in week eight.</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="split-cards">
      <div class="split-card">
        <h2>List with an agent if…</h2>
        <ul class="check-list">
          <li>The house is in good, market-ready condition</li>
          <li>You can wait several months without strain</li>
          <li>You have cash for repairs and the patience for showings</li>
          <li>No deadline — no foreclosure, probate, relocation or divorce clock</li>
          <li>Maximizing gross price matters more than certainty</li>
        </ul>
        <p class="split-card__note">In this case an agent will very likely net you more. We'll tell you so.</p>
      </div>
      <div class="split-card split-card--us">
        <h2>Take a cash offer if…</h2>
        <ul class="check-list">
          <li>The house needs work you can't or won't fund</li>
          <li>You're carrying two payments, or the house sits vacant</li>
          <li>A date is driving you: foreclosure, probate, divorce, a job move</li>
          <li>You're done being a landlord</li>
          <li>You've already fallen out of contract once</li>
          <li>Certainty is worth more to you than the last few percent</li>
        </ul>
        <p class="split-card__note">Get both numbers before you decide. That's the only fair test.</p>
      </div>
    </div>
  </div>
</section>

${ctaBand({ heading: 'Get a number to compare against', text: 'A free written offer, with the math shown, so you can compare it to an agent net sheet.', source: 'compare' })}
`,
});

/* -------------------------------------------------------------- about */

const about = () => ({
  path: '/about/',
  title: `About ${site.name} | Local Cash Home Buyers`,
  description: `${site.name} buys houses for cash in ${states.map((s) => s.name).join(', ')}. We buy directly with our own funds, show our math, and say so when listing would net you more.`,
  crumbs: [{ name: 'About', path: '/about/' }],
  body: `
${breadcrumbs([{ name: 'About', path: '/about/' }])}
${pageHero({
  eyebrow: 'About us',
  h1: `Local buyers, not a national lead machine`,
  lede: `We buy houses in ${esc(states.map((s) => s.name).join(', '))} with our own money, close at local title companies, and answer our own phone.`,
})}

<section class="section">
  <div class="container container--narrow prose">
    <h2>Why we exist</h2>
    <p>
      Plenty of people need to sell a house that the retail market does not want: it needs $60,000
      of work, or it is full of a lifetime of belongings, or there is a foreclosure date on the
      calendar. The traditional process asks those sellers to spend money they do not have, wait
      months they do not have, and hope a financed buyer's lender says yes.
    </p>
    <p>
      We are the other option. We buy the house as it is, we pay cash, and we close when you want.
      That is a worse price and a better process, and we say both parts out loud.
    </p>

    <h2>How we're different from most "we buy houses" companies</h2>
    <ul class="check-list">
      <li><strong>We're the actual buyer.</strong> We close in our own name with our own funds. We are not wholesalers shopping your contract to a list of investors.</li>
      <li><strong>We show our math.</strong> Comparable sales, repair estimate, our costs and margin. You see the whole calculation.</li>
      <li><strong>Our price doesn't drop.</strong> We inspect before the contract, not after, so we never come back asking for a discount at the closing table.</li>
      <li><strong>We tell people to list.</strong> When an agent would net you more, that's what we say. We would rather lose the deal than talk someone into the wrong one.</li>
      <li><strong>No pressure, no expiring offers.</strong> Take our offer to an attorney, a CPA, your family. Good decisions survive a second opinion.</li>
    </ul>

    <h2>The people</h2>
    <p class="callout">
      <strong>TODO:</strong> replace this section with real bios and photos of your team. Faces,
      first names, and a sentence about why you're in this business outperform every stock photo
      ever taken — and they're the single strongest trust signal on a site like this.
    </p>

    <h2>Our commitments</h2>
    <ul class="check-list">
      <li>We never charge a homeowner a fee — for anything, at any point.</li>
      <li>We never ask you to sign a deed outside of a title company closing.</li>
      <li>We close at a licensed title company with a full title search and escrow.</li>
      <li>We provide proof of funds on request, before you sign.</li>
      <li>We do not sell or share your contact information with other buyers.</li>
    </ul>

    <h2>Licensing &amp; disclosures</h2>
    <p>
      ${esc(site.legalName)} is a real estate investment company. We are not real estate agents or
      brokers and we do not represent sellers in a listing. We do not provide legal, tax or
      financial advice — for probate, foreclosure or tax questions, talk to a licensed attorney or
      CPA in your state. If you are facing foreclosure, HUD-approved housing counseling is free.
      <strong>TODO:</strong> confirm your entity is registered and, where required, licensed in
      every state listed on this site before launch.
    </p>
  </div>
</section>

${testimonialsSection({ heading: 'Sellers we have worked with' })}
${ctaBand({ source: 'about' })}
`,
});

/* ------------------------------------------------------------ contact */

const contact = () => ({
  path: '/contact/',
  title: `Contact ${site.name} | Free Cash Offer, No Obligation`,
  description: `Call ${site.phone} or send us the address for a free, no-obligation cash offer on your house — ${states.map((s) => s.abbr).join(', ')}. ${site.hours}.`,
  crumbs: [{ name: 'Contact', path: '/contact/' }],
  body: `
${breadcrumbs([{ name: 'Contact', path: '/contact/' }])}
${pageHero({
  eyebrow: 'Contact',
  h1: 'Talk to a real person today',
  lede: 'Call us, or send the address and we will call you within one business day. Either way it is free, and there is no obligation.',
  cta: false,
})}

<section class="section">
  <div class="container">
    <div class="contact-grid">
      <div class="contact-details">
        <h2>Reach us</h2>
        <p class="contact-phone"><a href="tel:${esc(site.phoneHref)}" data-track="contact-call">${esc(site.phone)}</a></p>
        <p>${esc(site.hours)}</p>
        <p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>
        <h3>Office</h3>
        <address>
          ${esc(site.legalName)}<br>
          ${esc(site.address.street)}<br>
          ${esc(site.address.city)}, ${esc(site.address.region)} ${esc(site.address.postalCode)}
        </address>
        <h3>What happens next</h3>
        <ol class="numbered">
          <li>We call you and ask a few questions about the house.</li>
          <li>We give you a preliminary range on that call.</li>
          <li>One 20-minute walkthrough, then a written offer within ${esc(S.avgOfferHours)} hours.</li>
          <li>You decide. No pressure, no expiring offers.</li>
        </ol>
      </div>
      <div class="contact-form">
        <div class="form-card">
          <h2 class="form-card__title">Get my free cash offer</h2>
          <p class="form-card__sub">No fees. No obligation. About 60 seconds.</p>
          ${leadForm({ id: 'offer-form-contact', source: 'contact' })}
        </div>
      </div>
    </div>
  </div>
</section>
`,
});

/* ------------------------------------------------------------ reviews */

const reviews = () => ({
  path: '/reviews/',
  title: `${site.name} Reviews | What Sellers Say`,
  description: `Read reviews from homeowners who sold their house to ${site.name} — inherited properties, foreclosure timelines, rentals and houses needing major repairs.`,
  crumbs: [{ name: 'Reviews', path: '/reviews/' }],
  body: `
${breadcrumbs([{ name: 'Reviews', path: '/reviews/' }])}
${pageHero({
  eyebrow: 'Reviews',
  h1: 'What sellers say about working with us',
  lede: 'The reviews worth reading are the specific ones — what the situation was, what we did, and what the seller walked away with.',
})}
${testimonialsSection({ heading: 'Recent sellers' })}

<section class="section">
  <div class="container container--narrow prose">
    <h2>How to check out any cash buyer</h2>
    <p>Do not take our word for it, and do not take theirs either. Before you sign with anyone:</p>
    <ul class="check-list">
      <li>Look up the buying entity in your state's business registry</li>
      <li>Ask for proof of funds dated in the last 30 days</li>
      <li>Ask whether they are buying or assigning your contract</li>
      <li>Read reviews that describe specific transactions, not just "great guys!"</li>
      <li>Call the title company they name and confirm they actually close deals there</li>
    </ul>
    <p><a href="/blog/we-buy-houses-scam-red-flags/">Our full guide to spotting a predatory buyer →</a></p>
  </div>
</section>

${ctaBand({ source: 'reviews' })}
`,
});

/* ---------------------------------------------------------------- faq */

const faqPage = () => ({
  path: '/faq/',
  title: 'Cash Home Buyer FAQ | Fees, Timelines, and How Offers Work',
  description:
    'Answers homeowners want before selling for cash: how offers are calculated, what fees exist, how fast closing happens, and whether listing would net more.',
  crumbs: [{ name: 'FAQ', path: '/faq/' }],
  schema: [faqSchema(faqs)],
  body: `
${breadcrumbs([{ name: 'FAQ', path: '/faq/' }])}
${pageHero({
  eyebrow: 'FAQ',
  h1: 'Frequently asked questions',
  lede: 'Straight answers, including the ones that are not flattering to us.',
})}
${faqSection(faqs, { heading: 'Everything sellers ask', showAllLink: false })}
<section class="section section--alt">
  <div class="container container--narrow">
    <p class="callout">Still have a question? Call <a href="tel:${esc(site.phoneHref)}">${esc(site.phone)}</a> and ask it. No script, no pitch.</p>
  </div>
</section>
${ctaBand({ source: 'faq' })}
`,
});

/* ------------------------------------------------------- thank you / legal */

const thankYou = () => ({
  path: '/thank-you/',
  noindex: true,
  title: 'Thank you — your cash offer request is in',
  description: 'We received your request and will contact you within one business day.',
  body: `
<section class="section section--center">
  <div class="container container--narrow">
    <div class="success-mark" aria-hidden="true">✓</div>
    <h1 class="page-hero__title">Got it — we're on it</h1>
    <p class="page-hero__lede">
      Your request is in. A real person from our team will call you within one business day,
      usually much sooner. If you'd rather not wait, call us now.
    </p>
    <p class="page-hero__actions">
      <a class="btn btn--primary btn--lg" href="tel:${esc(site.phoneHref)}" data-track="ty-call">Call ${esc(site.phone)}</a>
    </p>
    <h2>What happens next</h2>
    <ol class="numbered numbered--center">
      <li>We call and ask a few quick questions about the house.</li>
      <li>You get a preliminary range on that first call.</li>
      <li>One 20-minute walkthrough — clean nothing, fix nothing.</li>
      <li>A written offer within ${esc(S.avgOfferHours)} hours, with the math shown.</li>
      <li>You decide. No pressure, and the offer doesn't expire.</li>
    </ol>
    <p class="callout">
      While you wait: <a href="/blog/how-cash-home-buyers-calculate-offers/">how we calculate offers</a>
      and <a href="/compare/">how a cash sale compares to listing</a>.
    </p>
  </div>
</section>
`,
});

const privacy = () => ({
  path: '/privacy/',
  title: 'Privacy Policy',
  description: `How ${site.name} collects, uses and protects the information you submit through this site.`,
  crumbs: [{ name: 'Privacy policy', path: '/privacy/' }],
  body: `
${breadcrumbs([{ name: 'Privacy policy', path: '/privacy/' }])}
<section class="section">
  <div class="container container--narrow prose">
    <h1>Privacy policy</h1>
    <p class="prose__meta">Last updated: ${esc(new Date().toISOString().slice(0, 10))}</p>
    <p class="callout"><strong>TODO before launch:</strong> have counsel review this template against
    your actual data practices and the laws that apply to you (state privacy statutes, TCPA, CAN-SPAM,
    and CCPA/CPRA if you have California sellers).</p>

    <h2>What we collect</h2>
    <p>Information you give us — name, phone number, email address, property address, and details about the property and your situation. Technical information collected automatically, such as IP address, browser type, pages visited and referring URL.</p>

    <h2>How we use it</h2>
    <p>To evaluate your property and prepare an offer, to contact you about that offer, to complete a transaction if you accept, and to comply with law. We use it for nothing else.</p>

    <h2>Calls and text messages</h2>
    <p>By submitting the form and checking the consent box, you agree that we may contact you at the number you provided, including by autodialed or pre-recorded call and by text message, about your property. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to any text to opt out, or ask us on any call to stop contacting you and we will.</p>

    <h2>Who we share it with</h2>
    <p>Only the parties needed to do the work: our title company, our attorney, and the service providers that host this site and run our CRM. <strong>We do not sell your information, and we do not share it with other home buyers or lead brokers.</strong></p>

    <h2>Cookies and analytics</h2>
    <p>We use analytics to understand how visitors find and use this site. You can block cookies in your browser settings. ${site.analytics.gtmId || site.analytics.gaId ? 'This site uses Google Analytics; see Google’s privacy policy for how they process that data.' : 'This site currently loads no third-party tracking scripts.'}</p>

    <h2>Your choices</h2>
    <p>You can ask us at any time to tell you what information we hold about you, correct it, delete it, or stop contacting you. Email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> or call ${esc(site.phone)} and we will handle it.</p>

    <h2>Security</h2>
    <p>We use reasonable administrative and technical safeguards. No method of transmission over the internet is perfectly secure, so please do not email us sensitive identifiers such as your Social Security number — we never need one to make an offer.</p>

    <h2>Children</h2>
    <p>This site is not directed to anyone under 18 and we do not knowingly collect information from children.</p>

    <h2>Contact</h2>
    <address>${esc(site.legalName)}<br>${esc(site.address.street)}<br>${esc(site.address.city)}, ${esc(site.address.region)} ${esc(site.address.postalCode)}<br><a href="mailto:${esc(site.email)}">${esc(site.email)}</a> · ${esc(site.phone)}</address>
  </div>
</section>
`,
});

const terms = () => ({
  path: '/terms/',
  title: 'Terms of Use',
  description: `The terms governing your use of the ${site.name} website — nothing here is an offer to purchase, legal advice, or real estate brokerage services.`,
  crumbs: [{ name: 'Terms of use', path: '/terms/' }],
  body: `
${breadcrumbs([{ name: 'Terms of use', path: '/terms/' }])}
<section class="section">
  <div class="container container--narrow prose">
    <h1>Terms of use</h1>
    <p class="prose__meta">Last updated: ${esc(new Date().toISOString().slice(0, 10))}</p>
    <p class="callout"><strong>TODO before launch:</strong> have counsel review and adapt this template.</p>

    <h2>No offer or agreement</h2>
    <p>Nothing on this website is an offer to purchase real property. Any purchase price discussed is an estimate only, and no agreement exists between us until both parties sign a written purchase agreement.</p>

    <h2>Not professional advice</h2>
    <p>Content here is general information about selling real estate. It is not legal, tax, financial or real estate brokerage advice, and it does not create any professional relationship. Consult a licensed attorney, CPA or agent about your situation.</p>

    <h2>We are not agents or brokers</h2>
    <p>${esc(site.legalName)} is a real estate investment company that buys property for its own account. We do not represent sellers, do not list property, and are not acting as your fiduciary.</p>

    <h2>Accuracy</h2>
    <p>We work to keep this site accurate, but market data, timelines and cost figures are illustrative and change. Illustrative examples are labeled as such and are not a prediction of what your property will be offered.</p>

    <h2>Your submissions</h2>
    <p>By submitting the form, you confirm that the information is accurate to the best of your knowledge and that you are an owner of the property or authorized to act for the owner.</p>

    <h2>Limitation of liability</h2>
    <p>To the fullest extent permitted by law, we are not liable for indirect or consequential damages arising from your use of this website.</p>

    <h2>Governing law</h2>
    <p>Any purchase agreement is governed by the law of the state in which the property is located. These website terms are governed by the laws of the State of ${esc(site.homeState)}, without regard to conflict of law principles. <strong>TODO:</strong> have counsel confirm this split works for every state you operate in — several states regulate residential equity purchases specifically, with their own required notices and rescission periods.</p>

    <h2>Contact</h2>
    <p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a> · ${esc(site.phone)}</p>
  </div>
</section>
`,
});

const notFound = () => ({
  path: '/404.html',
  noindex: true,
  title: 'Page not found',
  description: 'That page does not exist.',
  body: `
<section class="section section--center">
  <div class="container container--narrow">
    <p class="eyebrow">404</p>
    <h1 class="page-hero__title">We couldn't find that page</h1>
    <p class="page-hero__lede">The porch light is still on, though. Here's where most people are headed:</p>
    <ul class="pill-list pill-list--center">
      <li><a class="pill" href="/">Get a cash offer</a></li>
      <li><a class="pill" href="/how-it-works/">How it works</a></li>
      <li><a class="pill" href="/compare/">Cash vs. agent</a></li>
      <li><a class="pill" href="/locations/">Areas we buy</a></li>
      <li><a class="pill" href="/faq/">FAQ</a></li>
    </ul>
    <p class="page-hero__actions">
      <a class="btn btn--primary btn--lg" href="tel:${esc(site.phoneHref)}">Call ${esc(site.phone)}</a>
    </p>
  </div>
</section>
`,
});

export const corePages = () => [
  home(),
  howItWorks(),
  compare(),
  about(),
  contact(),
  reviews(),
  faqPage(),
  thankYou(),
  privacy(),
  terms(),
  notFound(),
];
