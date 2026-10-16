/**
 * "Sold" is the delivery clean on a sold unit. It is never billed alone: the dealership pays for the
 * PDI or the Used detail too, so a job with Sold must also have PDI or Used (the database enforces
 * it, 0071; this mirrors it so a form can say so before saving). The services are matched by name,
 * the same way the database flags them.
 */
const isName = (name: string, ...names: string[]) => names.includes(name.trim().toLowerCase());

export const SOLD_NEEDS_CHARGE_MESSAGE = "A sold car must also be charged as PDI or Used";

/** True when the job has the Sold service and neither PDI nor Used. */
export function soldNeedsCharge(serviceNames: readonly string[]): boolean {
  const hasSold = serviceNames.some((n) => isName(n, "sold"));
  const charged = serviceNames.some((n) => isName(n, "pdi", "used"));
  return hasSold && !charged;
}
