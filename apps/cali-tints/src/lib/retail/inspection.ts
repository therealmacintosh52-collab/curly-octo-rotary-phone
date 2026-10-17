import type { InspectionItem, InspectionState } from "@/lib/db/types";

/** The tap cycle on a checklist row: grey → green → red → not applicable → grey. */
const CYCLE: InspectionState[] = ["pending", "ok", "attention", "na"];
export const nextInspectionState = (s: InspectionState): InspectionState => CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length];

export const INSPECTION_STATE_LABEL: Record<InspectionState, string> = { pending: "Not checked", ok: "Good", attention: "Needs attention", na: "Not applicable" };

/** "9/12 checked · 2 need attention": a row that is not applicable counts as checked. */
export function inspectionProgress(items: Pick<InspectionItem, "state">[]) {
  const total = items.length;
  const checked = items.filter((i) => i.state !== "pending").length;
  const attention = items.filter((i) => i.state === "attention").length;
  const label = total === 0 ? "No items yet" : `${checked}/${total} checked${attention ? ` · ${attention} need${attention === 1 ? "s" : ""} attention` : ""}`;
  return { total, checked, attention, done: total > 0 && checked === total, label };
}

/** Items grouped under their group heading, in order; ungrouped items first. */
export function groupInspectionItems<T extends { group: string | null }>(items: T[]): { group: string | null; items: T[] }[] {
  const out: { group: string | null; items: T[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.group === it.group) last.items.push(it);
    else out.push({ group: it.group, items: [it] });
  }
  return out;
}
