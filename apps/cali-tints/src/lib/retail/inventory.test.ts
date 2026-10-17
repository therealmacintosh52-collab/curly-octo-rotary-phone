import { describe, expect, it } from "vitest";
import { receiveDefaults, receivePayload, remaining, stockLabel, suggestedPrice } from "./inventory";

const order = { lines: [{ id: "a", item_id: null, part_number: null, name: "Rotor", qty: 4, cost: 60, received_qty: 1 }, { id: "b", item_id: null, part_number: null, name: "Pads", qty: 2, cost: 30, received_qty: 2 }] };

describe("inventory helpers", () => {
  it("says how much is in stock", () => {
    expect(stockLabel({ qty_on_hand: 5, reorder_at: 2 })).toEqual({ text: "5 in stock", tone: "ok" });
    expect(stockLabel({ qty_on_hand: 2, reorder_at: 2 })).toEqual({ text: "Low: 2 left (reorder at 2)", tone: "low" });
    expect(stockLabel({ qty_on_hand: 0, reorder_at: null })).toEqual({ text: "Out of stock", tone: "out" });
    expect(stockLabel({ qty_on_hand: -1, reorder_at: 2 })).toEqual({ text: "Count is negative (-1)", tone: "negative" });
    expect(stockLabel({ qty_on_hand: 1.5, reorder_at: null }).text).toBe("1.5 in stock");
    expect(stockLabel({ qty_on_hand: 3, reorder_at: null }).tone).toBe("ok");
  });
  it("starts the receive screen with what is outstanding", () => {
    expect(remaining(order.lines[0])).toBe(3);
    expect(receiveDefaults(order)).toEqual({ a: 3 });
  });
  it("never receives more than is outstanding and drops blanks", () => {
    expect(receivePayload(order, { a: "5", b: "1" })).toEqual([{ line_id: "a", qty: 3 }]);
    expect(receivePayload(order, { a: "", b: 0 })).toEqual([]);
    expect(receivePayload(order, { a: "1.234" })).toEqual([{ line_id: "a", qty: 1.23 }]);
  });
  it("suggests the list price, else cost plus the markup", () => {
    expect(suggestedPrice({ list_price: 95, cost: 50 }, 40)).toBe(95);
    expect(suggestedPrice({ list_price: null, cost: 50 }, 40)).toBe(70);
    expect(suggestedPrice({ list_price: null, cost: 50 }, null)).toBeNull();
    expect(suggestedPrice({ list_price: null, cost: null }, 40)).toBeNull();
  });
});
