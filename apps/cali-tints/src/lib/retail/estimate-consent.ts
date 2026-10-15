/** What the customer ticks before signing an estimate from their link: the shop's terms, then this line. */
export const ESTIMATE_AGREE_LINE = "I have read and agree to the terms, and I approve the work at the total shown. I agree to sign electronically.";
export const DEFAULT_TERMS = "Any additional work needs your approval before it is done. Parts are new unless the estimate says used, rebuilt or reconditioned.";

/** The exact words recorded with the approval: the line they ticked and the terms they saw. */
export function consentRecord(terms: string | null | undefined): string {
  return `${ESTIMATE_AGREE_LINE}\n\nTerms: ${(terms?.trim() || DEFAULT_TERMS)}`.slice(0, 2000);
}
