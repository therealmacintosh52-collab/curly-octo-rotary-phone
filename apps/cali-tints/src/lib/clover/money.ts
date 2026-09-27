/** Clover amounts are integer cents. Keep the conversion in one place. */
export function toCents(amount: number | string): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) throw new Error(`Not a money amount: ${amount}`);
  return Math.round((n + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}
