/** Rename the product here; nothing else references the literal name. */
export const APP_NAME = "BayIntel";
export const APP_TAGLINE = "Repair intelligence for the bay";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const NHTSA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const FREE_AI_QUERIES_PER_MONTH = 5;

export const TIERS = {
  free: { label: "Free", aiQueriesPerMonth: FREE_AI_QUERIES_PER_MONTH, seats: 1, price: 0 },
  pro_tech: { label: "Pro Tech", aiQueriesPerMonth: Infinity, seats: 1, price: 29 },
  shop: { label: "Shop", aiQueriesPerMonth: Infinity, seats: 5, price: 99 },
} as const;
export type Tier = keyof typeof TIERS;

export const NOT_IN_DATABASE = "Not in database — verify in OEM service information.";
