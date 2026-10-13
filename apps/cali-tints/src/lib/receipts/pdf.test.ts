import { describe, expect, it } from "vitest";
import { receiptFixture, RECEIPT_TOKEN, retailInvoiceDetailFixture, retailInvoiceListFixture } from "@/test/retail-fixtures";
import { receiptPdf } from "./pdf";
import { receiptFileStem } from "./load";

const SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("receipt pdf", () => {
  it("renders the paid job with its deposit, balance and signature", async () => {
    const r = receiptFixture(RECEIPT_TOKEN, true)!;
    expect(r.total).toBe(240);
    expect(r.deposit_paid).toBe(48);
    expect(r.balance).toBe(0);
    const buf = await receiptPdf(r, null, SIG);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(receiptFileStem(r)).toBe("ri-000041-r-101-ana-lopez");
    expect(receiptFileStem({ ...r, invoice_number: null })).toBe("receipt-r-101-ana-lopez");
  });

  it("renders an unpaid retail invoice (balance due, no signature)", async () => {
    const open = retailInvoiceListFixture("", "open").rows.find((x) => x.status === "partial")!;
    const inv = retailInvoiceDetailFixture(open.id)!;
    expect(inv.invoice_number).toBe("RI-000042");
    expect(inv.balance).toBe(160);
    expect(inv.has_signature).toBe(false);
    const buf = await receiptPdf(inv, null, null);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("retail invoice fixtures", () => {
  it("keep paid and void out of the to-collect list and total it up", () => {
    const open = retailInvoiceListFixture("", "open");
    expect(open.rows.map((r) => r.status).sort()).toEqual(["partial", "unpaid"]);
    expect(open.unpaid_total).toBe(290);
    expect(retailInvoiceListFixture("", "paid").rows).toHaveLength(1);
    expect(retailInvoiceListFixture("ana", "all").rows[0].number).toBe("RI-000041");
    expect(new Set(retailInvoiceListFixture("", "all").rows.map((r) => r.number)).size).toBe(4);
  });
});
