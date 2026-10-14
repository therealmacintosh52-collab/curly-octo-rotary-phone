import { describe, expect, it } from "vitest";
import { documentNumber, isStageFilter, STAGE_FILTERS, STAGE_META, STAGE_ORDER } from "./estimate-stage";

describe("estimate stages", () => {
  it("names every stage once, in the order the shop works", () => {
    expect(STAGE_ORDER).toEqual(["draft", "sent", "in_progress", "ready", "unpaid", "paid", "closed"]);
    for (const k of [...STAGE_ORDER, "declined", "expired"] as const) expect(STAGE_META[k].label.length).toBeGreaterThan(2);
  });

  it("never says job, work order or RO", () => {
    for (const m of Object.values(STAGE_META)) expect(`${m.label} ${m.short} ${m.hint}`).not.toMatch(/\bjob\b|work order|\bRO\b|repair order/i);
    for (const f of STAGE_FILTERS) expect(f.label).not.toMatch(/\bjob\b|work\b|\bRO\b/i);
  });

  it("leads with the invoice number once there is one", () => {
    expect(documentNumber({ display_number: "EST-000045", invoice_number: null })).toEqual({ primary: "EST-000045", secondary: null, kind: "Estimate" });
    expect(documentNumber({ display_number: "EST-000045", invoice_number: null, ro_number: "RO-000044", stage: "in_progress" })).toEqual({ primary: "RO-000044", secondary: "EST-000045", kind: "Work Order" });
    expect(documentNumber({ display_number: "EST-000045", invoice_number: null, ro_number: "RO-000044", stage: "sent" }).kind).toBe("Estimate");
    expect(documentNumber({ display_number: "EST-000045", invoice_number: "RI-000044" })).toEqual({ primary: "RI-000044", secondary: "EST-000045", kind: "Invoice" });
  });

  it("only accepts the known filters", () => {
    expect(isStageFilter("unpaid")).toBe(true);
    expect(isStageFilter("work")).toBe(false);
    expect(isStageFilter(undefined)).toBe(false);
  });
});
