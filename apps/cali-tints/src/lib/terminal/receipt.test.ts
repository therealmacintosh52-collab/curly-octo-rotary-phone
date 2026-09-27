import { describe, expect, it } from "vitest";
import type { TerminalTransaction } from "@/lib/db/types";
import { paidWith, receiptHtml, receiptNumber, receiptSubject, receiptText } from "./receipt";

const company = { name: "Cali Tints", email: "billing@calitints.example", phone: "(555) 010-2030", address_line1: "1200 Auto Center Dr", address_line2: null, city: "El Dorado Hills", state: "CA", postal_code: "95762" };

const sale: TerminalTransaction = {
  id: "7d3f9a10-1111-4222-8333-444455556666",
  kind: "sale",
  status: "captured",
  amount: 245.5,
  refunded_amount: 0,
  method: "card",
  source: "clover_card",
  invoice_id: null,
  invoice_number: null,
  dealership: null,
  payment_id: null,
  refund_of: null,
  description: "Full detail <Sprinter> & tint",
  customer_name: 'Sam "Sammy" O\'Neil',
  customer_email: "sam@example.com",
  reference: null,
  card_brand: "VISA",
  last4: "4242",
  clover_payment_id: "charge_abc",
  receipt_sent_at: null,
  at: "2026-09-27T18:30:00Z",
};

describe("terminal receipt", () => {
  it("numbers and describes the transaction", () => {
    expect(receiptNumber(sale)).toBe("TX-7D3F9A10");
    expect(receiptSubject(sale)).toBe("Full detail <Sprinter> & tint");
    expect(receiptSubject({ ...sale, invoice_number: "INV-000012", dealership: "MB of Sacramento" })).toBe("Invoice INV-000012 · MB of Sacramento");
    expect(paidWith(sale)).toBe("VISA ····4242");
    expect(paidWith({ ...sale, method: "check", card_brand: null, last4: null })).toBe("Check");
  });

  it("renders text with the total and thanks", () => {
    const t = receiptText(sale, company);
    expect(t).toContain("Cali Tints — Receipt");
    expect(t).toContain("Total: $245.50");
    expect(t).toContain("Paid with: VISA ····4242");
    expect(t).toContain("Thank you");
  });

  it("escapes html and marks refunds negative", () => {
    const h = receiptHtml(sale, company);
    expect(h).toContain("&lt;Sprinter&gt; &amp; tint");
    expect(h).toContain("&quot;Sammy&quot;");
    expect(h).not.toContain("<Sprinter>");
    const r = receiptHtml({ ...sale, kind: "refund", amount: 45 }, company);
    expect(r).toContain("Refund receipt");
    expect(r).toContain("-$45.00");
    expect(r).toContain("Refunded to");
    expect(r).toContain("5–10 business days");
  });

  it("shows earlier refunds on a sale receipt", () => {
    expect(receiptText({ ...sale, refunded_amount: 20, status: "partially_refunded" }, company)).toContain("Refunded since: -$20.00");
  });
});
