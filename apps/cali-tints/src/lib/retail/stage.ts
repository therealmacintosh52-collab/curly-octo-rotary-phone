import type { EstimateStatus } from "@/lib/db/types";

/** The four stages of one repair order: nothing is retyped between them, the same RO number follows it (0052). */
export const RO_STAGES = [
  { key: "estimate", label: "Estimate" },
  { key: "in_progress", label: "Work in progress" },
  { key: "invoice", label: "Invoice" },
  { key: "closed", label: "Paid / Closed" },
] as const;
export type RoStageKey = (typeof RO_STAGES)[number]["key"];

export type RoStageInput = {
  /** Estimate stage: where the estimate stands, when there is no repair order yet (or nothing approved on it). */
  estimateStatus?: EstimateStatus | null;
  /** The repair order exists (the customer approved something, or the car was checked in). */
  hasJob: boolean;
  /** Lines on the repair order: a checked-in car with no work approved yet is still being inspected. */
  lineCount?: number;
  invoicedAt?: string | null;
  paidAt?: string | null;
  /** "Close job · Picked up" was pressed (0056). Left out by callers that do not track it. */
  pickedUpAt?: string | null;
  /** An estimate or supplement is out with the customer. */
  waitingOnApproval?: boolean;
};

export type RoStage = { key: RoStageKey; index: number; label: string; sub: string | null };

/** The stage is derived from the facts, never typed in. */
export function roStage(i: RoStageInput): RoStage {
  const at = (key: RoStageKey, sub: string | null): RoStage => {
    const index = RO_STAGES.findIndex((s) => s.key === key);
    return { key, index, label: RO_STAGES[index].label, sub };
  };
  if (i.hasJob && i.invoicedAt) {
    if (!i.paidAt) return at("invoice", "Waiting on payment");
    return at("closed", i.pickedUpAt ? "Picked up" : i.pickedUpAt === null ? "Paid · waiting for pickup" : "Paid");
  }
  if (i.hasJob && (i.lineCount ?? 1) > 0) {
    return at("in_progress", i.waitingOnApproval ? "Waiting on approval" : "Work approved");
  }
  if (i.hasJob) return at("estimate", i.waitingOnApproval ? "Waiting on approval" : "Inspecting");
  switch (i.estimateStatus) {
    case "sent":
    case "viewed":
      return at("estimate", "Waiting on the customer");
    case "declined":
      return at("estimate", "Declined");
    case "expired":
      return at("estimate", "Expired");
    default:
      return at("estimate", "Being written");
  }
}
