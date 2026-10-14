import type { PartCondition } from "@/lib/db/types";

/**
 * Part condition (migration 0065). California: each part on an invoice says whether it
 * was new, used, reconditioned or rebuilt (16 CCR §3356, B&P §9884.8); on an estimate a
 * part is presumed new unless it is identified otherwise (B&P §9884.9, 16 CCR §3353(a)).
 * Checked 2026-10-14 against search results quoting the BAR "Write It Right" page; the
 * official pages could not be opened from the build machine, so read them once.
 * Crash-part (OEM / non-OEM aftermarket) wording is for collision work and is not built.
 */
export const PART_CONDITIONS: { value: PartCondition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "reconditioned", label: "Reconditioned" },
];

export const partConditionLabel = (c: PartCondition | string | null | undefined): string => PART_CONDITIONS.find((p) => p.value === c)?.label ?? "New";

/** On an estimate only a part that is not new is called out (the rest is presumed new). */
export const estimateConditionNote = (c: PartCondition | string | null | undefined): string | null => (c && c !== "new" ? partConditionLabel(c) : null);

/** On the invoice every part line states its condition. */
export const invoiceConditionNote = (c: PartCondition | string | null | undefined): string => partConditionLabel(c);

/** One line under a job that mixes new parts with used, rebuilt or reconditioned ones (B&P §9884.8). */
export const MIXED_CONDITION_NOTE = "This job includes new parts together with used, rebuilt or reconditioned parts: each part line says which.";

export function mixesConditions(lines: { type?: string; line_type?: string; part_condition?: string | null }[]): boolean {
  const parts = lines.filter((l) => (l.type ?? l.line_type) === "part");
  const conds = new Set(parts.map((l) => l.part_condition ?? "new"));
  return conds.has("new") && conds.size > 1;
}
