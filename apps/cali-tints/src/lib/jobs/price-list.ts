import type { PriceListRow } from "@/lib/db/types";

/**
 * The service menu without its prices. A job shows no price to anyone: every
 * line is billed at the price list in Settings when the month's invoice is
 * built, so the menu reaches the browser with only names, categories and the
 * open-amount flag ("Other").
 */
export function withoutPrices(rows: PriceListRow[]): PriceListRow[] {
  return rows.map((r) => ({ ...r, price: null, price_min: null, price_max: null, is_override: false }));
}
