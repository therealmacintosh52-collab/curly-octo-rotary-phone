/** How a payment reads on screen and on paper: one place, so "Zelle" is Zelle everywhere. */
export const PAYMENT_METHOD: Record<string, string> = {
  clover_online: "Card online",
  clover_flex: "Card on the Clover",
  cash: "Cash",
  check: "Check",
  zelle: "Zelle",
  venmo: "Venmo",
  other: "Other",
};

export function paymentMethod(m: string): string {
  return PAYMENT_METHOD[m] ?? m;
}

/** The same, for the middle of a sentence ("Paid · card on the Clover"). */
export function paymentMethodLower(m: string): string {
  const v = paymentMethod(m);
  return v === "Zelle" || v === "Venmo" ? v : v.replace(/^\w/, (c) => c.toLowerCase());
}
