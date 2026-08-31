/**
 * Single source of truth for brand, contact (NAP) and conversion settings.
 *
 * EVERY placeholder below is marked TODO. Swap these before launch — the
 * phone number is a reserved-for-fiction 555 number and the domain is not
 * registered yet.
 */

export const site = {
  // --- Brand -------------------------------------------------------------
  name: 'Porchlight Offers',
  legalName: 'Porchlight Home Offers LLC', // TODO: real registered entity
  tagline: 'We left the light on for you.',
  // One-line description used in meta tags + Organization schema.
  description:
    'Porchlight Offers buys houses for cash in any condition. Get a fair, ' +
    'no-obligation cash offer in 24 hours and close on the day you choose — ' +
    'no repairs, no commissions, no fees.',

  // --- Deployment --------------------------------------------------------
  origin: 'https://www.porchlightoffers.com', // TODO: your real domain, no trailing slash
  locale: 'en_US',

  // --- Contact (NAP — keep IDENTICAL everywhere: GBP, directories, site) --
  phone: '(555) 012-3456', // TODO
  phoneHref: '+15550123456', // TODO: E.164
  email: 'offers@porchlightoffers.com', // TODO
  address: {
    street: '1200 Main Street, Suite 400', // TODO
    city: 'Dallas',
    region: 'TX',
    postalCode: '75202',
    country: 'US',
  },
  geo: { lat: 32.7793, lng: -96.8005 }, // TODO: your office coordinates
  hours: 'Mon–Sat 8am–8pm CT',
  openingHours: ['Mo-Sa 08:00-20:00'],

  // Social / citation profiles. Used in Organization `sameAs` — every real
  // profile you add here strengthens entity recognition in Google.
  sameAs: [
    // TODO: 'https://www.facebook.com/porchlightoffers',
    // TODO: 'https://www.google.com/maps/place/?cid=YOUR_CID',
    // TODO: 'https://www.bbb.org/us/tx/dallas/profile/...',
  ],

  // --- Market ------------------------------------------------------------
  marketName: 'Dallas–Fort Worth', // TODO
  marketShort: 'DFW',
  stateName: 'Texas',
  stateAbbr: 'TX',

  // --- Conversion --------------------------------------------------------
  // Where the lead form posts. Options:
  //   'netlify'  → Netlify Forms (zero backend, works on Netlify deploys)
  //   a URL      → Formspree / your CRM / Zapier catch hook / API endpoint
  formAction: 'netlify',
  // Fires on every step + submit. Wire to GA4 / Google Ads via GTM.
  analytics: {
    gtmId: '', // TODO: 'GTM-XXXXXXX' — leave blank to ship no third-party JS
    gaId: '', // TODO: 'G-XXXXXXXXXX' (only used if gtmId is blank)
  },

  // --- Proof -------------------------------------------------------------
  // TODO: REPLACE WITH REAL, VERIFIABLE NUMBERS BEFORE LAUNCH.
  // Unsubstantiated stats are an FTC problem and a trust problem.
  stats: {
    housesBought: '400+',
    yearsBuying: '12',
    avgOfferHours: '24',
    fastestCloseDays: '7',
  },
};

/** Blank = no third-party tag. Keeps the default build at zero external JS. */
export const hasAnalytics = Boolean(site.analytics.gtmId || site.analytics.gaId);
