import type { ServiceCategory } from "@/lib/db/types";

/** Display order and labels for service categories (how the dealer buys the work). */
export const SERVICE_CATEGORIES: { value: ServiceCategory; label: string; hint: string }[] = [
  { value: "new", label: "New", hint: "PDI / new-car prep and delivery" },
  { value: "used", label: "Used", hint: "Reconditioning for used, CPO and wholesale units" },
  { value: "service", label: "Service lane", hint: "Service washes, loaners, showroom" },
  { value: "addon", label: "Add-ons", hint: "Tint, correction and extras on any car" },
];

export function categoryLabel(c: ServiceCategory | string): string {
  return SERVICE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}
