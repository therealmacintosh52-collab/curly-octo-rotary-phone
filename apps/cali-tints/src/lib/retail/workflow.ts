import type { EstimateListRow, RetailTechnician } from "@/lib/db/types";

/**
 * The Workflow board's columns, left to right: estimates that are not approved yet,
 * approved work orders waiting for the advisor to send them to a tech, one column
 * per technician, and everything waiting for parts.
 */
export type LaneKey = "estimates" | "ready" | "parts" | `tech:${string}`;

export const READY_LANE_TITLE = "Ready to send RO to tech";
export const PARTS_LANE_TITLE = "Waiting for parts";

/** A card goes in exactly one column. Parts win over everything once the work order exists. */
export function laneFor(r: Pick<EstimateListRow, "status" | "parts_status" | "tech_id">): LaneKey {
  if (r.status !== "accepted") return "estimates";
  if (r.parts_status === "needed" || r.parts_status === "ordered") return "parts";
  return r.tech_id ? `tech:${r.tech_id}` : "ready";
}

export interface WorkflowLane {
  key: LaneKey;
  title: string;
  items: EstimateListRow[];
}

/** The columns for a set of rows. Every technician gets a column, even with nothing in it. */
export function workflowLanes(rows: EstimateListRow[], technicians: RetailTechnician[]): WorkflowLane[] {
  const byLane = new Map<LaneKey, EstimateListRow[]>();
  for (const r of rows) {
    const k = laneFor(r);
    byLane.set(k, [...(byLane.get(k) ?? []), r]);
  }
  const techKeys = new Set<LaneKey>(technicians.map((t) => `tech:${t.id}` as const));
  // A technician no longer on the roster but still holding cars keeps a column (initials from the card)
  const strays = [...byLane.keys()].filter((k) => k.startsWith("tech:") && !techKeys.has(k));
  const initialsOf = (k: LaneKey) => byLane.get(k)?.[0]?.holder ?? "Tech";
  return [
    { key: "estimates", title: "Estimates", items: byLane.get("estimates") ?? [] },
    { key: "ready", title: READY_LANE_TITLE, items: byLane.get("ready") ?? [] },
    ...technicians.map((t) => ({ key: `tech:${t.id}` as LaneKey, title: t.name, items: byLane.get(`tech:${t.id}` as LaneKey) ?? [] })),
    ...strays.map((k) => ({ key: k, title: initialsOf(k), items: byLane.get(k) ?? [] })),
    { key: "parts", title: PARTS_LANE_TITLE, items: byLane.get("parts") ?? [] },
  ];
}
