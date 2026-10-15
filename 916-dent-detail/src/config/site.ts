// Single source of business facts. Anything marked [OWNER] is a placeholder the owner must replace
// before launch (`npm run check:owner` lists them). Never put invented facts here.

export type Placeholder<T> = { value: T; placeholder: boolean };

export const site = {
  name: '916 Dent & Detail',
  tagline: 'Precision · Care · Perfection.',
  heroLines: ['Dents gone.', 'Paint glowing.', 'We come to you.'] as const,
  heroSubhead: 'Mobile paintless dent repair & detailing across Sacramento. No body shop. No repaint.',
  description:
    'Mobile paintless dent repair and auto detailing across Sacramento. Dents removed without paint, paint corrected and ceramic coated, at your home, work or lot.',
  // [OWNER] production domain. Used for canonical URLs / OG. Falls back to localhost for local builds.
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',

  // [OWNER] real business phone. 555-0100 is a reserved fictional number (safe placeholder).
  phone: { display: '(916) 555-0100', e164: '+19165550100', placeholder: true },
  // [OWNER] real inbox
  email: { address: 'hello@example.com', placeholder: true },

  // Service-area business: no street address is shown anywhere.
  baseZip: '95624', // travel-fee origin (Phase 2), configurable
  areaLabel: 'Greater Sacramento',

  // [OWNER] hours. null = not set yet → renders an [OWNER] marker.
  hours: [
    { days: 'Mon–Fri', time: null as string | null },
    { days: 'Saturday', time: null as string | null },
    { days: 'Sunday', time: null as string | null },
  ],

  // [OWNER] profile links (used for Organization.sameAs in Phase 6). Empty = hidden.
  social: { instagram: '', facebook: '', tiktok: '', youtube: '', google: '' },
  // [OWNER] Google review link (g.page/r/...). Empty = review CTA shows an [OWNER] marker.
  googleReviewUrl: '',
} as const;

export const nav = [
  { href: '/services', label: 'Services' },
  { href: '/dealers', label: 'Dealers' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/book', label: 'Book' },
] as const;

export const telHref = `tel:${site.phone.e164}`;
export const smsHref = `sms:${site.phone.e164}`;
