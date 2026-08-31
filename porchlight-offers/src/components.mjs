import { site } from './config.mjs';
import { esc, join } from './lib/html.mjs';
import { situations } from './content/situations.mjs';
import { testimonials, isSampleProof } from './content/testimonials.mjs';

/* ------------------------------------------------------------- lead form */

const CONDITIONS = [
  ['Move-in ready', 'move-in-ready'],
  ['Needs minor work', 'minor-work'],
  ['Needs major work', 'major-work'],
  ['Poor / uninhabitable', 'poor'],
  ['Not sure', 'unsure'],
];

const TIMELINES = [
  ['ASAP', 'asap'],
  ['Within 30 days', '30-days'],
  ['1–3 months', '1-3-months'],
  ['Just exploring', 'exploring'],
];

/**
 * The three-step lead form.
 *
 * Why three steps: asking only for an address first converts far better than a
 * single wall of fields. Each completed step is a commitment, and step 1 alone
 * is enough for us to follow up if someone abandons (partials are saved to
 * localStorage and restored).
 *
 * Progressive enhancement: with JS off, every step is visible and the form is a
 * plain, fully working POST.
 */
export function leadForm({ id = 'offer-form', compact = false, source = 'page' } = {}) {
  const netlify = site.formAction === 'netlify';
  const action = netlify ? '/thank-you/' : site.formAction;
  return `
<div class="offer-form-wrap${compact ? ' offer-form-wrap--compact' : ''}" id="${esc(id)}">
  <form
    class="offer-form js-offer-form"
    name="cash-offer"
    method="POST"
    action="${esc(action)}"
    ${netlify ? 'data-netlify="true" netlify-honeypot="company"' : ''}
    data-source="${esc(source)}"
    novalidate
  >
    <input type="hidden" name="form-name" value="cash-offer">
    <input type="hidden" name="lead_source" value="${esc(source)}">
    <input type="hidden" name="page_path" class="js-page-path" value="">
    <p class="hp-field" aria-hidden="true">
      <label>Company <input name="company" tabindex="-1" autocomplete="off"></label>
    </p>

    <div class="offer-form__progress js-progress" hidden>
      <div class="offer-form__bar"><span class="js-progress-fill" style="width:33%"></span></div>
      <p class="offer-form__step-label">Step <span class="js-step-num">1</span> of 3 · takes about 60 seconds</p>
    </div>

    <!-- Step 1 ---------------------------------------------------------- -->
    <fieldset class="offer-step js-step" data-step="1">
      <legend class="offer-step__legend">Where is the house?</legend>
      <div class="field">
        <label class="field__label" for="${esc(id)}-address">Property address</label>
        <input
          class="field__input field__input--lg"
          id="${esc(id)}-address"
          name="property_address"
          type="text"
          required
          autocomplete="street-address"
          placeholder="123 Main St, ${esc(site.address.city)}, ${esc(site.address.region)}"
          enterkeyhint="next"
        >
        <p class="field__error js-error" hidden>Please enter the property address.</p>
      </div>
      <button class="btn btn--primary btn--block btn--lg js-next" type="button" data-track="form-step-1">
        Get my cash offer →
      </button>
      <p class="offer-form__reassure">Free · No obligation · We never charge homeowners a fee</p>
    </fieldset>

    <!-- Step 2 ---------------------------------------------------------- -->
    <fieldset class="offer-step js-step" data-step="2">
      <legend class="offer-step__legend">Tell us about the property</legend>

      <div class="field">
        <span class="field__label" id="${esc(id)}-cond">What condition is it in?</span>
        <div class="chip-group" role="group" aria-labelledby="${esc(id)}-cond">
          ${CONDITIONS.map(
            ([label, value], i) => `
          <label class="chip">
            <input type="radio" name="condition" value="${esc(value)}">
            <span>${esc(label)}</span>
          </label>`,
          ).join('')}
        </div>
      </div>

      <div class="field">
        <span class="field__label" id="${esc(id)}-time">How soon do you want to close?</span>
        <div class="chip-group" role="group" aria-labelledby="${esc(id)}-time">
          ${TIMELINES.map(
            ([label, value]) => `
          <label class="chip">
            <input type="radio" name="timeline" value="${esc(value)}">
            <span>${esc(label)}</span>
          </label>`,
          ).join('')}
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="${esc(id)}-situation">Anything driving the sale? (optional)</label>
        <select class="field__input" id="${esc(id)}-situation" name="situation">
          <option value="">Select one…</option>
          ${situations.map((s) => `<option value="${esc(s.slug)}">${esc(s.nav)}</option>`).join('\n          ')}
          <option value="other">Something else</option>
        </select>
      </div>

      <div class="offer-form__actions">
        <button class="btn btn--link js-back" type="button">← Back</button>
        <button class="btn btn--primary js-next" type="button" data-track="form-step-2">Continue →</button>
      </div>
    </fieldset>

    <!-- Step 3 ---------------------------------------------------------- -->
    <fieldset class="offer-step js-step" data-step="3">
      <legend class="offer-step__legend">Where should we send the offer?</legend>
      <div class="field-row">
        <div class="field">
          <label class="field__label" for="${esc(id)}-name">Your name</label>
          <input class="field__input" id="${esc(id)}-name" name="name" type="text" required autocomplete="name">
          <p class="field__error js-error" hidden>Please enter your name.</p>
        </div>
        <div class="field">
          <label class="field__label" for="${esc(id)}-phone">Phone</label>
          <input class="field__input" id="${esc(id)}-phone" name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="(555) 555-5555">
          <p class="field__error js-error" hidden>Please enter a phone number we can reach you at.</p>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="${esc(id)}-email">Email <span class="field__opt">(optional)</span></label>
        <input class="field__input" id="${esc(id)}-email" name="email" type="email" autocomplete="email">
      </div>

      <label class="consent">
        <input type="checkbox" name="consent" value="yes" required>
        <span>
          I agree to be contacted by ${esc(site.name)} at the number provided, including by
          autodialed and pre-recorded calls and text messages, about my property. Consent is not a
          condition of any purchase. Message and data rates may apply; reply STOP to opt out. See our
          <a href="/privacy/">privacy policy</a>.
        </span>
      </label>
      <p class="field__error js-error js-consent-error" hidden>Please check the box so we can contact you.</p>

      <div class="offer-form__actions">
        <button class="btn btn--link js-back" type="button">← Back</button>
        <button class="btn btn--primary btn--lg" type="submit" data-track="form-submit">Get my cash offer</button>
      </div>
      <p class="offer-form__reassure">
        We call within one business day. No spam, no selling your info, no obligation.
      </p>
    </fieldset>

    <p class="form-status js-form-status" role="status" aria-live="polite" hidden></p>
  </form>

  <p class="offer-form__alt">
    Prefer to talk? Call <a href="tel:${esc(site.phoneHref)}" data-track="form-call">${esc(site.phone)}</a> — ${esc(site.hours)}.
  </p>
</div>`;
}

/* -------------------------------------------------------------- sections */

export const trustBar = () => `
<section class="trust-bar" aria-label="Why sellers choose us">
  <div class="container">
    <ul class="trust-bar__list">
      <li><strong>$0</strong><span>fees or commissions</span></li>
      <li><strong>${esc(site.stats.avgOfferHours)} hrs</strong><span>to a written offer</span></li>
      <li><strong>${esc(site.stats.fastestCloseDays)} days</strong><span>fastest close</span></li>
      <li><strong>As-is</strong><span>no repairs, no cleaning</span></li>
      <li><strong>You choose</strong><span>the closing date</span></li>
    </ul>
  </div>
</section>`;

export const steps = () => `
<section class="section section--steps" id="how">
  <div class="container">
    <p class="eyebrow">How it works</p>
    <h2 class="section__title">Three steps. About a week. Zero cost to you.</h2>
    <ol class="steps">
      <li class="step">
        <span class="step__num" aria-hidden="true">1</span>
        <h3 class="step__title">Tell us about the house</h3>
        <p>Fill out the form or call. It takes a minute, and we only need the address, rough condition, and how to reach you.</p>
      </li>
      <li class="step">
        <span class="step__num" aria-hidden="true">2</span>
        <h3 class="step__title">We look and make an offer</h3>
        <p>One short walkthrough — 20 minutes, no cleaning required — then a written cash offer within ${esc(site.stats.avgOfferHours)} hours, with the math shown.</p>
      </li>
      <li class="step">
        <span class="step__num" aria-hidden="true">3</span>
        <h3 class="step__title">You pick the closing date</h3>
        <p>Close at a licensed title company in as little as ${esc(site.stats.fastestCloseDays)} days, or months from now. Funds are wired the day we close.</p>
      </li>
    </ol>
    <p class="steps__note">
      No repairs. No cleaning. No showings. No commissions. No closing costs.
      <a href="/how-it-works/">See the full process →</a>
    </p>
  </div>
</section>`;

export const comparisonTable = () => `
<div class="table-scroll">
  <table class="compare-table">
    <caption class="visually-hidden">Comparison of selling to Porchlight Offers versus listing with a real estate agent</caption>
    <thead>
      <tr>
        <th scope="col">&nbsp;</th>
        <th scope="col" class="is-us">Sell to ${esc(site.name)}</th>
        <th scope="col">List with an agent</th>
      </tr>
    </thead>
    <tbody>
      <tr><th scope="row">Commissions</th><td class="is-us">None</td><td>Typically 5–6% of the sale price</td></tr>
      <tr><th scope="row">Seller closing costs</th><td class="is-us">We pay them</td><td>Typically 1–3%</td></tr>
      <tr><th scope="row">Repairs before selling</th><td class="is-us">None — we buy as-is</td><td>Usually required to compete</td></tr>
      <tr><th scope="row">Cleaning &amp; staging</th><td class="is-us">Leave it as it sits</td><td>Expected</td></tr>
      <tr><th scope="row">Showings</th><td class="is-us">One 20-minute walkthrough</td><td>Ongoing, on buyers' schedules</td></tr>
      <tr><th scope="row">Inspection renegotiation</th><td class="is-us">None — price is locked</td><td>Common, often $5k–$15k</td></tr>
      <tr><th scope="row">Appraisal &amp; financing risk</th><td class="is-us">None — cash</td><td>Deals fall through regularly</td></tr>
      <tr><th scope="row">Time to close</th><td class="is-us">7–21 days</td><td>Often 2–6 months, start to finish</td></tr>
      <tr><th scope="row">Closing date</th><td class="is-us">You choose it</td><td>Set by the buyer's lender</td></tr>
      <tr><th scope="row">Out of pocket before closing</th><td class="is-us">$0</td><td>Repairs, staging, holding costs</td></tr>
      <tr><th scope="row">Sale price</th><td class="is-us">Below full retail — that's the trade</td><td>Higher gross, before all of the above</td></tr>
    </tbody>
  </table>
</div>`;

export const situationsGrid = (heading = 'We buy houses in every situation') => `
<section class="section section--alt" id="situations">
  <div class="container">
    <p class="eyebrow">Any situation</p>
    <h2 class="section__title">${esc(heading)}</h2>
    <p class="section__lede">Whatever put you here, we have almost certainly bought a house exactly like it before.</p>
    <ul class="card-grid">
      ${situations
        .map(
          (s) => `
      <li class="card">
        <h3 class="card__title"><a href="/situations/${s.slug}/">${esc(s.nav)}</a></h3>
        <p class="card__text">${esc(s.description.split('.')[0])}.</p>
        <span class="card__link" aria-hidden="true">Learn more →</span>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>`;

export const testimonialsSection = ({ heading = 'What sellers say' } = {}) => `
<section class="section section--proof" id="reviews">
  <div class="container">
    <p class="eyebrow">Reviews</p>
    <h2 class="section__title">${esc(heading)}</h2>
    ${
      isSampleProof
        ? `<p class="sample-warning" role="note"><strong>Placeholder content.</strong>
      These are sample reviews shipped with the template. Replace them with real,
      permissioned customer reviews before launch — publishing invented testimonials is
      deceptive advertising. See <code>src/content/testimonials.mjs</code>.</p>`
        : ''
    }
    <ul class="quote-grid">
      ${testimonials
        .map(
          (t) => `
      <li class="quote">
        <blockquote><p>${esc(t.quote)}</p></blockquote>
        <footer class="quote__meta">
          <span class="quote__name">${esc(t.name)}</span>
          <span class="quote__city">${esc(t.city)} · ${esc(t.context)}</span>
        </footer>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>`;

export const faqSection = (faqs, { heading = 'Questions sellers ask us', showAllLink = true } = {}) => `
<section class="section" id="faq">
  <div class="container container--narrow">
    <p class="eyebrow">FAQ</p>
    <h2 class="section__title">${esc(heading)}</h2>
    <div class="faq">
      ${faqs
        .map(
          (f) => `
      <details class="faq__item">
        <summary class="faq__q">${esc(f.q)}</summary>
        <div class="faq__a"><p>${esc(f.a)}</p></div>
      </details>`,
        )
        .join('')}
    </div>
    ${showAllLink ? '<p class="faq__more"><a href="/faq/">Read all frequently asked questions →</a></p>' : ''}
  </div>
</section>`;

export const ctaBand = ({
  heading = 'Get your free cash offer today',
  text = 'One form, about a minute. A written offer within 24 hours. No fees, no obligation, no pressure.',
  source = 'cta-band',
} = {}) => `
<section class="cta-band" id="get-offer">
  <div class="container">
    <div class="cta-band__inner">
      <div class="cta-band__copy">
        <h2 class="cta-band__title">${esc(heading)}</h2>
        <p>${esc(text)}</p>
        <p class="cta-band__phone">
          Or call <a href="tel:${esc(site.phoneHref)}" data-track="cta-band-call">${esc(site.phone)}</a><br>
          <span>${esc(site.hours)}</span>
        </p>
      </div>
      <div class="cta-band__form">
        ${leadForm({ id: `offer-form-${source}`, compact: true, source })}
      </div>
    </div>
  </div>
</section>`;

export const breadcrumbs = (crumbs) => `
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <div class="container">
    <ol>
      <li><a href="/">Home</a></li>
      ${crumbs
        .map((c, i) =>
          i === crumbs.length - 1
            ? `<li><span aria-current="page">${esc(c.name)}</span></li>`
            : `<li><a href="${c.path}">${esc(c.name)}</a></li>`,
        )
        .join('\n      ')}
    </ol>
  </div>
</nav>`;

export const pageHero = ({ eyebrow, h1, lede, cta = true }) => `
<section class="page-hero">
  <div class="container">
    <div class="page-hero__inner">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="page-hero__title">${esc(h1)}</h1>
    ${lede ? `<p class="page-hero__lede">${esc(lede)}</p>` : ''}
    ${
      cta
        ? `<p class="page-hero__actions">
      <a class="btn btn--primary btn--lg" href="#get-offer" data-track="hero-cta">Get my cash offer</a>
      <a class="btn btn--ghost btn--lg" href="tel:${esc(site.phoneHref)}" data-track="hero-call">Call ${esc(site.phone)}</a>
    </p>`
        : ''
    }
    </div>
  </div>
</section>`;

export { join };
