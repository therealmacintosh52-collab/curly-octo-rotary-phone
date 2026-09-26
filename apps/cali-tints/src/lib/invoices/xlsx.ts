import "server-only";

import ExcelJS from "exceljs";
import { formatAddress, netDays, type InvoiceBundle } from "./load";
import { INVOICE_CSV_COLUMNS, invoiceCsvRows } from "./csv";
import { formatDateOnly } from "@/lib/dates";
import { addDays, format } from "date-fns";

/**
 * Two sheets: a formatted "Invoice" for humans and a flat "Lines" sheet with
 * the same columns as the CSV for the accounting import.
 */
export async function invoiceXlsx(b: InvoiceBundle): Promise<Buffer> {
  const { invoice, items, company, dealership } = b;
  const wb = new ExcelJS.Workbook();
  wb.creator = company.name;
  wb.created = new Date();

  // --- Invoice sheet ---------------------------------------------------------
  const ws = wb.addWorksheet("Invoice", { pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 } });
  ws.columns = [{ width: 12 }, { width: 10 }, { width: 20 }, { width: 28 }, { width: 26 }, { width: 14 }];

  ws.addRow([company.name]).font = { bold: true, size: 16 };
  for (const line of formatAddress(company)) ws.addRow([line]);
  if (company.phone) ws.addRow([company.phone]);
  if (company.email) ws.addRow([company.email]);
  if (company.ein) ws.addRow([`EIN ${company.ein}`]);
  ws.addRow([]);

  const issued = new Date(invoice.created_at);
  const days = netDays(invoice.payment_terms);
  ws.addRow(["INVOICE", "", invoice.display_number]).font = { bold: true, size: 14 };
  ws.addRow(["Date", "", format(issued, "yyyy-MM-dd")]);
  ws.addRow(["Period", "", `${formatDateOnly(invoice.period_start)} – ${formatDateOnly(invoice.period_end)}`]);
  ws.addRow(["Terms", "", invoice.payment_terms + (days ? ` (due ${format(addDays(issued, days), "yyyy-MM-dd")})` : "")]);
  if (invoice.ro_po_number) ws.addRow(["RO/PO", "", invoice.ro_po_number]);
  ws.addRow([]);
  ws.addRow(["Bill to", "", dealership.name]).font = { bold: true };
  for (const line of formatAddress(dealership)) ws.addRow(["", "", line]);
  if (dealership.ap_contact_name) ws.addRow(["", "", `Attn: ${dealership.ap_contact_name}`]);
  ws.addRow([]);

  const header = ws.addRow(["Date", "Tag", "VIN", "Vehicle", "Service", "Amount"]);
  header.font = { bold: true };
  header.eachCell((c) => {
    c.border = { bottom: { style: "thin" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  });
  for (const it of items) {
    const r = ws.addRow([
      it.performed_at.slice(0, 10),
      it.tag_number,
      it.vin ?? "",
      [it.year, it.make, it.model].filter(Boolean).join(" "),
      it.service_name,
      Number(it.price),
    ]);
    r.getCell(6).numFmt = '"$"#,##0.00';
  }
  ws.addRow([]);
  const sub = ws.addRow(["", "", "", "", "Subtotal", Number(invoice.subtotal)]);
  const tax = ws.addRow(["", "", "", "", `Tax (${(Number(invoice.tax_rate) * 100).toFixed(2)}%)`, Number(invoice.tax)]);
  const tot = ws.addRow(["", "", "", "", "Total", Number(invoice.total)]);
  for (const r of [sub, tax, tot]) r.getCell(6).numFmt = '"$"#,##0.00';
  tot.font = { bold: true };
  if (Number(invoice.amount_paid) > 0) {
    const paid = ws.addRow(["", "", "", "", "Paid", -Number(invoice.amount_paid)]);
    const due = ws.addRow(["", "", "", "", "Balance due", Number(invoice.total) - Number(invoice.amount_paid)]);
    paid.getCell(6).numFmt = '"$"#,##0.00';
    due.getCell(6).numFmt = '"$"#,##0.00';
    due.font = { bold: true };
  }
  ws.addRow([]);
  ws.addRow([`Payment terms: ${invoice.payment_terms}. Please reference ${invoice.display_number} on remittance.`]);

  // --- Lines sheet -----------------------------------------------------------
  const lines = wb.addWorksheet("Lines");
  lines.columns = INVOICE_CSV_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, c.header.length + 2) }));
  lines.getRow(1).font = { bold: true };
  for (const row of invoiceCsvRows(b)) {
    lines.addRow({ ...row, amount: Number(row.amount), invoice_subtotal: Number(row.invoice_subtotal), invoice_tax: Number(row.invoice_tax), invoice_total: Number(row.invoice_total) });
  }
  lines.views = [{ state: "frozen", ySplit: 1 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}
