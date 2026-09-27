import { describe, expect, it } from "vitest";
import { matchPayment, type OpenInvoice } from "./matcher";
import { fromCents, toCents } from "./money";

const open: OpenInvoice[] = [
  { id: "a", display_number: "INV-000010", clover_order_id: "ORD1", balance: 250 },
  { id: "b", display_number: "INV-000011", clover_order_id: null, balance: 125.5 },
  { id: "c", display_number: "INV-000012", clover_order_id: null, balance: 125.5 },
];

describe("matchPayment", () => {
  it("matches by Clover order first, even when the amount differs", () => {
    expect(matchPayment({ amount: 100, orderId: "ORD1", reference: null, note: null }, open)).toEqual({ invoiceId: "a", matchedBy: "order" });
  });
  it("matches by invoice number in the reference or note", () => {
    expect(matchPayment({ amount: 1, orderId: null, reference: "inv-000011 partial", note: null }, open)).toEqual({ invoiceId: "b", matchedBy: "reference" });
    expect(matchPayment({ amount: 1, orderId: null, reference: null, note: "paying INV-000012" }, open)).toEqual({ invoiceId: "c", matchedBy: "reference" });
  });
  it("matches by exact balance only when unambiguous", () => {
    expect(matchPayment({ amount: 250, orderId: null, reference: null, note: null }, open)).toEqual({ invoiceId: "a", matchedBy: "amount" });
    // two invoices share a 125.50 balance → never auto-match
    expect(matchPayment({ amount: 125.5, orderId: null, reference: null, note: null }, open)).toBeNull();
  });
  it("ignores unknown orders and zero amounts", () => {
    expect(matchPayment({ amount: 0, orderId: "nope", reference: null, note: null }, open)).toBeNull();
  });
});

describe("cents", () => {
  it("rounds to integer cents without float drift", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("125.50")).toBe(12550);
    expect(toCents(19.999)).toBe(2000);
    expect(fromCents(12550)).toBe(125.5);
  });
  it("rejects non-numbers", () => {
    expect(() => toCents("abc")).toThrow();
  });
});
