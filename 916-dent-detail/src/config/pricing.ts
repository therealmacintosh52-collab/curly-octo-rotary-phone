// ALL prices live here. UI components must read from this file and never hardcode a number.
// Every value is null until the owner sets it → the UI renders an [OWNER] marker instead.
// Estimates are always labelled: "Estimate — final price confirmed on inspection."

import type { AddonId, ServiceId, SizeClass } from '@/config/booking';

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

// ======================================================================================================
// PHASE 2 BOOKING ENGINE PRICES. Every number below is an [OWNER] placeholder so the demo works with zero
// setup. Replace them, then set PRICES_ARE_PLACEHOLDERS = false (the booking UI shows a "demo pricing"
// banner while it is true). Whole US dollars. Logic and UI never hardcode a price: they read this file.
// ======================================================================================================

/** [OWNER] flip to false once every price below is real. */
export const PRICES_ARE_PLACEHOLDERS = true;

/** [OWNER] fixed price by vehicle size for non-dent services. */
export const fixedPrices: Partial<Record<ServiceId, Record<SizeClass, number>>> = {
  'paint-correction': { compact: 450, sedan: 500, suv: 600, truck: 700, xl: 800 },
  ceramic: { compact: 900, sedan: 1000, suv: 1200, truck: 1400, xl: 1600 },
  decon: { compact: 120, sedan: 140, suv: 170, truck: 200, xl: 230 },
  interior: { compact: 180, sedan: 200, suv: 240, truck: 280, xl: 320 },
};

/** [OWNER] condition spread: detailing "high" = price x (1 + spread) for heavy condition found on inspection. */
export const detailSpread = 0.15;

/** [OWNER] add-on prices (flat). */
export const addonPrices: Record<AddonId, number> = {
  headlights: 90,
  'pet-hair': 60,
  'engine-bay': 50,
  odor: 70,
};

/**
 * [OWNER] Dent pricing. Never a fixed price without photos. The photo quote supplies panel count and a range;
 * the server clamps it to bounds below. perPanel is the range per damaged panel by vehicle size.
 */
export const dentPricing = {
  perPanel: {
    compact: { low: 125, high: 250 },
    sedan: { low: 135, high: 275 },
    suv: { low: 150, high: 300 },
    truck: { low: 165, high: 325 },
    xl: { low: 185, high: 350 },
  } as Record<SizeClass, { low: number; high: number }>,
  /** Hail work is quoted at this multiple of normal dent rates. */
  hailMultiplier: 1.6,
  minimum: 100,
  maximum: 6000,
  maxPanels: 14,
  /** Below this model confidence the range is widened by widenFactor on both ends. */
  lowConfidenceBelow: 0.5,
  widenFactor: 0.25,
  roundTo: 5,
};

/** [OWNER] deposit charged at booking. Credited against the final invoice. */
export const depositAmount = 50;

/** [OWNER] travel fee by straight-line distance from the base ZIP (config/site.ts baseZip). */
export const travelFees = {
  freeRadiusMiles: 15,
  tiers: [
    { upToMiles: 25, fee: 25 },
    { upToMiles: 35, fee: 50 },
  ],
  /** Farther than this is out of area for online booking. */
  maxServiceMiles: 35,
};

/** [OWNER] referral credit (Phase 3). */
export const referralCredit = 25;

// ======================================================================================================
// PHASE 5 DEALER PORTAL (/dealers). Wholesale rates are [OWNER] decisions: NO number below is real. While a rate
// is null the UI says "Request wholesale sheet" and never shows a price (marketing/dealers/wholesale-price-sheet-
// template.md explains how to choose them). A per-dealer override can be set by the owner in /admin/dealers
// (stored in dealers.wholesale_pricing) and wins over this file. Whole US dollars.
// ======================================================================================================

export const dealerServiceIds = ['pdr_panel', 'hail_panel', 'interior_reset', 'paint_deep_clean', 'swirl_erase', 'gloss_shield', 'headlights'] as const;
export type DealerServiceId = (typeof dealerServiceIds)[number];

/** [OWNER] wholesale rate per service. pdr_panel and hail_panel are per damaged panel; the rest are per vehicle. */
export const dealerWholesale: Record<DealerServiceId, Money> = {
  pdr_panel: null,
  hail_panel: null,
  interior_reset: null,
  paint_deep_clean: null,
  swirl_erase: null,
  gloss_shield: null,
  headlights: null,
};

/** [OWNER] net terms a dealer may be approved for (days). The owner approves each dealer by hand. */
export const dealerNetTerms = { options: [15, 30] as readonly number[], defaultDays: 30 };
