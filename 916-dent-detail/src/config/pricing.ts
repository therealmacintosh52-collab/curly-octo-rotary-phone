// ALL prices live here. UI components must read from this file and never hardcode a number.
// Every value is null until the owner sets it → the UI renders an [OWNER] marker instead.
// Estimates are always labelled: "Estimate — final price confirmed on inspection."

export const ESTIMATE_LABEL = 'Estimate — final price confirmed on inspection.';

export type Money = number | null; // whole US dollars; null = [OWNER] not set

export type MembershipTier = {
  id: 'maintain' | 'protect' | 'showroom';
  name: string;
  priceMonthly: Money; // [OWNER]
  blurb: string;
  // [OWNER] confirm what each tier includes. These are proposals, not commitments.
  includes: string[];
  featured?: boolean;
};

export const memberships: MembershipTier[] = [
  {
    id: 'maintain',
    name: 'Maintain',
    priceMonthly: null,
    blurb: 'Keep a clean car clean without thinking about it.',
    includes: ['Monthly mobile maintenance wash', 'Interior wipe-down & vacuum', 'Priority booking'],
  },
  {
    id: 'protect',
    name: 'Protect',
    priceMonthly: null,
    blurb: 'For coated cars and daily drivers that see real miles.',
    includes: ['Everything in Maintain', 'Gloss Shield top-up each visit', 'Small door-ding check'],
    featured: true,
  },
  {
    id: 'showroom',
    name: 'Showroom',
    priceMonthly: null,
    blurb: 'Always ready to be photographed.',
    includes: ['Everything in Protect', 'Twice-monthly visits', 'Seasonal Paint Deep-Clean'],
  },
];

// Per-service "from" prices for later phases (booking + photo quote). null = [OWNER].
export const serviceFromPrice: Record<string, Money> = {
  pdr: null,
  hail: null,
  'paint-correction': null,
  ceramic: null,
  decon: null,
  interior: null,
};

export function formatMoney(v: Money, suffix = ''): { text: string; placeholder: boolean } {
  if (v === null) return { text: '[OWNER] price', placeholder: true };
  return { text: `$${v.toLocaleString('en-US')}${suffix}`, placeholder: false };
}
