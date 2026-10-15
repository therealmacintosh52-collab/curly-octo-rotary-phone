import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { INVOICE_TOKEN, invoiceDocFixture, receiptFixture, RECEIPT_TOKEN, retailInvoiceDetailFixture, retailInvoiceListFixture, UNSIGNED_TOKEN } from "@/test/retail-fixtures";
import { REMOTE_SIGN_CONSENT } from "@/lib/retail/receipt-consent";
import { receiptPdf } from "./pdf";
import { receiptFileStem } from "./load";
import { taxLabel } from "@/components/retail/invoice-document";
import { DEFAULT_TEMPLATES, renderTemplate } from "@/lib/retail/templates";

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

describe("the customer's unpaid invoice", () => {
  it("shows what is due and the findings the customer may see", async () => {
    const r = receiptFixture(INVOICE_TOKEN, false)!;
    expect(r.paid_at).toBeNull();
    expect(r.balance).toBe(160);
    expect((r.findings ?? []).length).toBeGreaterThan(0);
    expect((r.findings ?? []).every((f) => f.customer_visible !== false)).toBe(true);
    const buf = await receiptPdf(r, null, null);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("retail invoice fixtures", () => {
  it("keep paid and void out of the to-collect list and total it up", () => {
    const open = retailInvoiceListFixture("", "open");
    expect(open.rows.map((r) => r.status).sort()).toEqual(["partial", "unpaid", "unpaid"]);
    expect(open.unpaid_total).toBe(705);
    expect(retailInvoiceListFixture("", "paid").rows).toHaveLength(1);
    expect(retailInvoiceListFixture("ana", "all").rows[0].number).toBe("RI-000041");
    expect(new Set(retailInvoiceListFixture("", "all").rows.map((r) => r.number)).size).toBe(5);
  });
});

describe("the invoice laid out like the shop prints it", () => {
  it("renders jobs with cause and correction, declined work, the authorization log and the warranty", async () => {
    const r = invoiceDocFixture(true);
    expect((r.jobs ?? []).length).toBeGreaterThan(1);
    expect((r.jobs ?? []).some((j) => j.cause && j.correction)).toBe(true);
    expect((r.declined ?? []).length).toBeGreaterThan(0);
    expect(r.bar_license).toBeTruthy();
    const buf = await receiptPdf(r, null, null);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("labels the tax by the kinds of line that were taxed", () => {
    expect(taxLabel({ taxable_types: ["part"], tax_rate: 0.0875 })).toBe("Tax (parts only, 8.75%)");
    expect(taxLabel({ taxable_types: ["part", "labor"], tax_rate: 0.0875 })).toBe("Tax (8.75%)");
    expect(taxLabel({ taxable_types: [], tax_rate: 0.0875 })).toBe("Tax (8.75%)");
  });

  it("has a message for the car being ready and for the work they put off", () => {
    const ready = renderTemplate(DEFAULT_TEMPLATES.status_ready.body, { first_name: "Ana", vehicle: "Camry", receipt_url: "https://x/r/t", company: "Cali" });
    expect(ready).toContain("https://x/r/t");
    const later = renderTemplate(DEFAULT_TEMPLATES.declined_work.body, { first_name: "Ana", vehicle: "Camry", declined_list: "Rear pads ($240.00)", book_url: "https://x/book", company: "Cali" });
    expect(later).toContain("Rear pads ($240.00)");
    expect(later).not.toContain("{{");
  });
});

describe("signing the paid invoice", () => {
  it("an unsigned paid invoice renders with a blank signature line, a signed one with the drawn mark", async () => {
    const unsigned = receiptFixture(UNSIGNED_TOKEN, false)!;
    expect(unsigned.paid_at).not.toBeNull();
    expect(unsigned.signed_name).toBeNull();
    const blank = await receiptPdf(unsigned, null, null);
    if (process.env.RENDER_OUT_DIR) writeFileSync(`${process.env.RENDER_OUT_DIR}/invoice-unsigned.pdf`, blank);
    expect(blank.subarray(0, 5).toString()).toBe("%PDF-");
    const signed = await receiptPdf({ ...unsigned, signed_name: "Ana Lopez", has_signature: true }, null, SIG);
    expect(signed.subarray(0, 5).toString()).toBe("%PDF-");
    expect(signed.length).not.toBe(blank.length);
  });

  it("the remote signature carries the same statement as the pickup signature", () => {
    expect(REMOTE_SIGN_CONSENT).toMatch(/received my vehicle/);
    expect(REMOTE_SIGN_CONSENT).toMatch(/paid/);
  });
});
