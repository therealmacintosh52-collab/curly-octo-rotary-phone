import type { EstimateLabel, PartsStatus } from "@/lib/db/types";

/** The tags a visit can carry, as on the shop's own board. */
export const LABELS: EstimateLabel[] = ["VIP Customer", "Drop-off", "Waiting", "Fleet"];
export const LABEL_VARIANT: Record<EstimateLabel, "info" | "success" | "warning" | "outline"> = { "VIP Customer": "info", "Drop-off": "success", Waiting: "warning", Fleet: "outline" };

export const PARTS: { value: PartsStatus; label: string }[] = [
  { value: "none", label: "None" },
  { value: "needed", label: "Needed" },
  { value: "ordered", label: "Ordered" },
  { value: "arrived", label: "Arrived" },
];
export const PARTS_VARIANT: Record<PartsStatus, "muted" | "destructive" | "warning" | "success"> = { none: "muted", needed: "destructive", ordered: "warning", arrived: "success" };
export const partsLabel = (p: PartsStatus | undefined) => PARTS.find((x) => x.value === (p ?? "none"))?.label ?? "None";

/** The status words a visit can show beside its stage (a transfer sets one too). */
export const STATUS_WORDS = ["Checked in", "Diagnosis / inspection", "Waiting for approval", "Needs parts ordered", "In progress", "Ready for pickup"] as const;
