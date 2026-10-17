import { describe, expect, it } from "vitest";
import { historyWindows, parseBilledLine, toBilledRows } from "./history-parse";

describe("reading a QuickBooks invoice line", () => {
  it("reads the line this app writes", () => {
    const p = parseBilledLine("Sep 12 · Stock 4821 · 2024 Mercedes-Benz GLE 450 · Used · RO/PO 7", "2026-09-12", "2026-09-30");
    expect(p).toEqual({ stock: "4821", vin: null, servedOn: "2026-09-12", ok: true });
  });
  it("reads free text written by hand", () => {
    expect(parseBilledLine("Detail - stock #A1234 - 2022 GLC 300").stock).toBe("A1234");
    expect(parseBilledLine("STK: 99871 sold delivery clean").stock).toBe("99871");
    expect(parseBilledLine("PDI #55120 EQS", null, "2026-03-01")).toEqual({ stock: "55120", vin: null, servedOn: "2026-03-01", ok: true });
    expect(parseBilledLine("Detail for stock no. C9").stock).toBe("C9");
  });
  it("finds a VIN, upper-cased", () => {
    const p = parseBilledLine("Used detail w1kzf8db5na123456 Mercedes");
    expect(p.vin).toBe("W1KZF8DB5NA123456");
    expect(p.ok).toBe(true);
  });
  it("does not take a 17-letter word for a VIN", () => {
    expect(parseBilledLine("ABCDEFGHJKLMNPQRS something").vin).toBeNull();
  });
  it("marks a line with neither as unread", () => {
    const p = parseBilledLine("Detailing services, September", "2026-09-30");
    expect(p.ok).toBe(false);
    expect(p.stock).toBeNull();
    expect(p.vin).toBeNull();
    expect(parseBilledLine(null).ok).toBe(false);
  });
  it("prefers the line's service date over the invoice date, and ignores a bad date", () => {
    expect(parseBilledLine("Stock 1", "2026-01-05", "2026-01-31").servedOn).toBe("2026-01-05");
    expect(parseBilledLine("Stock 1", "Jan 5", "2026-01-31").servedOn).toBe("2026-01-31");
    expect(parseBilledLine("Stock 1", null, null).servedOn).toBeNull();
  });
});

describe("history windows", () => {
  it("covers the period in windows of at most six months, oldest first, with no gap or overlap", () => {
    const w = historyWindows("2026-10-16", 24);
    expect(w[0].from).toBe("2024-10-16");
    expect(w.at(-1)!.to).toBe("2026-10-16");
    expect(w.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < w.length; i++) {
      const prevEnd = new Date(`${w[i - 1].to}T00:00:00Z`).getTime();
      const nextStart = new Date(`${w[i].from}T00:00:00Z`).getTime();
      expect(nextStart - prevEnd).toBe(86400000);
    }
  });
  it("one short window for a short period", () => {
    expect(historyWindows("2026-10-16", 3)).toEqual([{ from: "2026-07-16", to: "2026-10-16" }]);
  });
});

describe("invoices into already-billed rows", () => {
  const ctx = { companyId: "c1", dealershipId: "d1", appInvoiceIds: new Set(["9"]) };
  const inv = (id: string, lines: { Id?: string; Description?: string; Amount?: number; DetailType?: string; SalesItemLineDetail?: { ServiceDate?: string } }[]) => ({ Id: id, DocNumber: `10${id}`, TxnDate: "2026-02-28", Line: lines });

  it("keeps each described line with its parsed stock, and skips subtotal rows", () => {
    const rows = toBilledRows([inv("1", [
      { Id: "1", Description: "Feb 3 · Stock 4821 · 2024 Mercedes-Benz GLE 450 · Used", Amount: 200, DetailType: "SalesItemLineDetail", SalesItemLineDetail: { ServiceDate: "2026-02-03" } },
      { Id: "2", Description: "Detailing services", Amount: 60, DetailType: "SalesItemLineDetail" },
      { Amount: 260, DetailType: "SubTotalLineDetail" },
    ])], ctx);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ qbo_invoice_id: "1", doc_number: "101", line_key: "1", stock_number: "4821", service_date: "2026-02-03", amount: 200, parsed_ok: true, source: "history", dealership_id: "d1" });
    expect(rows[1]).toMatchObject({ stock_number: null, parsed_ok: false, service_date: "2026-02-28" });
  });

  it("tags the invoices this app wrote itself", () => {
    const rows = toBilledRows([inv("9", [{ Id: "1", Description: "Stock 77", Amount: 20, DetailType: "SalesItemLineDetail" }])], ctx);
    expect(rows[0].source).toBe("app");
  });

  it("is stable: the same invoice gives the same row keys", () => {
    const a = toBilledRows([inv("1", [{ Id: "5", Description: "Stock 1", Amount: 1 }])], ctx);
    const b = toBilledRows([inv("1", [{ Id: "5", Description: "Stock 1", Amount: 1 }])], ctx);
    expect(a.map((r) => r.line_key)).toEqual(b.map((r) => r.line_key));
  });
});
