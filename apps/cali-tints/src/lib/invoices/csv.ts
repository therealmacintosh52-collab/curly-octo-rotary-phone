import { toCsv, type CsvValue } from "@/lib/csv";
import { formatAddress, type InvoiceBundle } from "./load";

/**
 * Flat line-item export. Column order is a contract for the dealership's
 * accounting import / a future DMS integration: append new columns at the
 * end, never reorder.
 */
export const INVOICE_CSV_COLUMNS = [
  { key: "invoice_number", header: "Invoice Number" },
  { key: "invoice_date", header: "Invoice Date" },
  { key: "period_start", header: "Period Start" },
  { key: "period_end", header: "Period End" },
  { key: "vendor", header: "Vendor" },
  { key: "vendor_ein", header: "Vendor EIN" },
  { key: "dealership", header: "Dealership" },
  { key: "dealership_address", header: "Dealership Address" },
  { key: "line", header: "Line" },
  { key: "service_date", header: "Service Date" },
  { key: "tag_number", header: "Key Tag" },
  { key: "vin", header: "VIN" },
  { key: "year", header: "Year" },
  { key: "make", header: "Make" },
  { key: "model", header: "Model" },
  { key: "color", header: "Color" },
  { key: "ro_po_number", header: "RO/PO" },
  { key: "service", header: "Service" },
  { key: "detailer", header: "Detailer" },
  { key: "amount", header: "Amount" },
  { key: "invoice_subtotal", header: "Invoice Subtotal" },
  { key: "invoice_tax", header: "Invoice Tax" },
  { key: "invoice_total", header: "Invoice Total" },
  { key: "payment_terms", header: "Payment Terms" },
  { key: "status", header: "Status" },
] as const;

type Key = (typeof INVOICE_CSV_COLUMNS)[number]["key"];
export type InvoiceCsvRow = Record<Key, CsvValue>;

export function invoiceCsvRows(b: InvoiceBundle): InvoiceCsvRow[] {
  const { invoice, items, company, dealership } = b;
  return items.map((it, i) => ({
    invoice_number: invoice.display_number,
    invoice_date: invoice.created_at.slice(0, 10),
    period_start: invoice.period_start,
    period_end: invoice.period_end,
    vendor: company.name,
    vendor_ein: company.ein,
    dealership: dealership.name,
    dealership_address: formatAddress(dealership).join(", "),
    line: i + 1,
    service_date: it.performed_at.slice(0, 10),
    tag_number: it.tag_number,
    vin: it.vin,
    year: it.year,
    make: it.make,
    model: it.model,
    color: it.color,
    ro_po_number: it.ro_po_number,
    service: it.service_name,
    detailer: it.detailer_name,
    amount: Number(it.price).toFixed(2),
    invoice_subtotal: Number(invoice.subtotal).toFixed(2),
    invoice_tax: Number(invoice.tax).toFixed(2),
    invoice_total: Number(invoice.total).toFixed(2),
    payment_terms: invoice.payment_terms,
    status: invoice.status,
  }));
}

export function invoiceCsv(b: InvoiceBundle): string {
  return toCsv(invoiceCsvRows(b), [...INVOICE_CSV_COLUMNS]);
}
