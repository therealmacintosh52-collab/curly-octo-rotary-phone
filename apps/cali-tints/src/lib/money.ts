/** Money helpers. Amounts are plain numbers with 2dp (Postgres numeric(10,2)). */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatMoney(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return usd.format(Number.isFinite(n) ? n : 0);
}

/** Round half-up to cents, avoiding float drift (0.1 + 0.2). */
export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sumPrices(items: { price: number | string }[]): number {
  return roundCents(items.reduce((acc, i) => acc + Number(i.price), 0));
}

/** Subtotal / tax / total for a set of line prices at a fractional tax rate. */
export function invoiceTotals(prices: (number | string)[], taxRate: number) {
  const subtotal = roundCents(prices.reduce<number>((acc, p) => acc + Number(p), 0));
  const tax = roundCents(subtotal * taxRate);
  return { subtotal, tax, total: roundCents(subtotal + tax) };
}

/** "0.0825" → "8.25%" */
export function formatTaxRate(rate: number): string {
  return `${roundCents(rate * 100 * 100) / 100}%`;
}
