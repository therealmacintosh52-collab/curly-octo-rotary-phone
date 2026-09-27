import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { invoiceBundleFixture } from "@/test/fixtures";
import { invoiceCsv, invoiceCsvRows, INVOICE_CSV_COLUMNS } from "./csv";
import { invoiceXlsx } from "./xlsx";
import { invoicePdf } from "./pdf";
import { invoiceEmailHtml, invoiceEmailText } from "./email";
import { invoiceFileStem, netDays } from "./load";

const OUT = process.env.RENDER_OUT_DIR; // set to also write the files for eyeballing

describe("invoice renderers", () => {
  const b = invoiceBundleFixture();

  it("csv has the contract header and one row per line", () => {
    const csv = invoiceCsv(b);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe(INVOICE_CSV_COLUMNS.map((c) => c.header).join(","));
    expect(lines).toHaveLength(1 + b.items.length);
    expect(invoiceCsvRows(b)[0]).toMatchObject({ invoice_number: "INV-000012", tag_number: "4821", amount: "200.00" });
    if (OUT) writeFileSync(`${OUT}/invoice.csv`, csv);
  });

  it("xlsx renders a workbook", async () => {
    const buf = await invoiceXlsx(b);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(buf.length).toBeGreaterThan(4000);
    if (OUT) writeFileSync(`${OUT}/invoice.xlsx`, buf);
  });

  it("pdf renders both variants", async () => {
    const branded = await invoicePdf(b, "branded");
    const print = await invoicePdf(b, "print");
    expect(branded.subarray(0, 5).toString()).toBe("%PDF-");
    expect(print.subarray(0, 5).toString()).toBe("%PDF-");
    if (OUT) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}/invoice-branded.pdf`, branded);
      writeFileSync(`${OUT}/invoice-print.pdf`, print);
    }
  }, 30000);

  it("email template escapes and includes the essentials", () => {
    const html = invoiceEmailHtml({ ...b, dealership: { ...b.dealership, name: "MB <Anaheim> & Co" } }, "https://app.example.com");
    expect(html).toContain("MB &lt;Anaheim&gt; &amp; Co");
    expect(html).toContain("INV-000012");
    expect(html).toContain("$790.00");
    expect(invoiceEmailText(b)).toContain("Total due: $790.00");
    expect(html).not.toContain("Pay by card");
    const withPay = invoiceEmailHtml(b, "https://app.example.com", "https://checkout.example/pay/abc");
    expect(withPay).toContain("Pay by card");
    expect(withPay).toContain('href="https://checkout.example/pay/abc"');
    expect(invoiceEmailText(b, "https://checkout.example/pay/abc")).toContain("Pay by card (secure Clover checkout): https://checkout.example/pay/abc");
    if (OUT) writeFileSync(`${OUT}/invoice-email.html`, withPay);
  });

  it("helpers", () => {
    expect(netDays("Net 30")).toBe(30);
    expect(netDays("net45")).toBe(45);
    expect(netDays("Due on receipt")).toBeNull();
    expect(invoiceFileStem(b)).toBe("INV-000012-Mercedes-Benz-of-El-Dorado-Hills");
  });
});
