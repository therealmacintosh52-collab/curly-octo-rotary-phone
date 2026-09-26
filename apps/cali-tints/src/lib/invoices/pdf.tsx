import "server-only";

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { addDays, format } from "date-fns";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";
import { formatAddress, netDays, type InvoiceBundle } from "./load";
import { LOGO_BW_PNG_BASE64, LOGO_PNG_BASE64 } from "./logo";

export type PdfVariant = "branded" | "print";

/**
 * Letter-size invoice. "branded" uses the dark-green accent and colour
 * logo; "print" is black-and-white with no fills for dealers that print
 * and file paper copies.
 */
function styles(variant: PdfVariant) {
  const accent = variant === "branded" ? "#3f8f1f" : "#000000";
  const rule = variant === "branded" ? "#d7dbde" : "#000000";
  const muted = variant === "branded" ? "#5f6b73" : "#333333";
  const headFill = variant === "branded" ? "#111417" : "#ffffff";
  const headText = variant === "branded" ? "#ffffff" : "#000000";
  const zebra = variant === "branded" ? "#f4f6f7" : "#ffffff";
  return {
    c: { accent, rule, muted, headFill, headText, zebra },
    s: StyleSheet.create({
      page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 48, fontSize: 9.5, fontFamily: "Helvetica", color: "#111111" },
      header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
      logo: { width: 58, height: 58, marginRight: 12 },
      companyName: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 3 },
      small: { fontSize: 8.5, color: muted, lineHeight: 1.35 },
      title: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: 2, color: accent, textAlign: "right" },
      metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
      metaKey: { width: 64, textAlign: "right", color: muted, fontSize: 8.5, marginRight: 8 },
      metaVal: { width: 92, textAlign: "right", fontSize: 9.5, fontFamily: "Helvetica-Bold" },
      billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: rule },
      billLabel: { fontSize: 7.5, color: muted, letterSpacing: 1.2, marginBottom: 3 },
      billName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
      table: { borderWidth: variant === "print" ? 0.75 : 0, borderColor: rule },
      thead: { flexDirection: "row", backgroundColor: headFill, color: headText, paddingVertical: 6, paddingHorizontal: 6, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, borderBottomWidth: variant === "print" ? 0.75 : 0, borderBottomColor: rule },
      tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: rule },
      cDate: { width: "10%", paddingRight: 4 },
      cTag: { width: "9%", fontFamily: "Helvetica-Bold", paddingRight: 4 },
      cVin: { width: "19%", fontSize: 8, paddingRight: 4 },
      cVeh: { width: "27%", paddingRight: 6 },
      cSvc: { width: "24%", paddingRight: 6 },
      cAmt: { width: "11%", textAlign: "right" },
      totals: { marginTop: 12, alignSelf: "flex-end", width: 220 },
      totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
      totKey: { color: muted },
      totGrand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTopWidth: 1.25, borderTopColor: accent, fontFamily: "Helvetica-Bold", fontSize: 12 },
      notes: { marginTop: 22, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: rule },
      footer: { position: "absolute", left: 48, right: 48, bottom: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: muted },
    }),
  };
}

export function InvoiceDocument({ bundle, variant }: { bundle: InvoiceBundle; variant: PdfVariant }) {
  const { invoice, items, company, dealership, logoDataUri } = bundle;
  const { s, c } = styles(variant);
  const issued = new Date(invoice.created_at);
  const days = netDays(invoice.payment_terms);
  const due = days !== null ? addDays(issued, days) : null;
  const balance = Number(invoice.total) - Number(invoice.amount_paid);
  const logoSrc = variant === "print" ? `data:image/png;base64,${LOGO_BW_PNG_BASE64}` : (logoDataUri ?? `data:image/png;base64,${LOGO_PNG_BASE64}`);

  return (
    <Document title={`${invoice.display_number} — ${dealership.name}`} author={company.name} subject="Invoice">
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={s.logo} />
            <View>
              <Text style={s.companyName}>{company.name}</Text>
              {formatAddress(company).map((l) => (
                <Text key={l} style={s.small}>
                  {l}
                </Text>
              ))}
              {company.phone ? <Text style={s.small}>{company.phone}</Text> : null}
              {company.email ? <Text style={s.small}>{company.email}</Text> : null}
              {company.ein ? <Text style={s.small}>EIN {company.ein}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>INVOICE</Text>
            <View style={{ marginTop: 8 }}>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Invoice #</Text>
                <Text style={s.metaVal}>{invoice.display_number}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Date</Text>
                <Text style={s.metaVal}>{format(issued, "MMM d, yyyy")}</Text>
              </View>
              {due ? (
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>Due</Text>
                  <Text style={s.metaVal}>{format(due, "MMM d, yyyy")}</Text>
                </View>
              ) : null}
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Terms</Text>
                <Text style={s.metaVal}>{invoice.payment_terms}</Text>
              </View>
              {invoice.ro_po_number ? (
                <View style={s.metaRow}>
                  <Text style={s.metaKey}>RO / PO</Text>
                  <Text style={s.metaVal}>{invoice.ro_po_number}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Bill to / period */}
        <View style={s.billRow}>
          <View>
            <Text style={s.billLabel}>BILL TO</Text>
            <Text style={s.billName}>{dealership.name}</Text>
            {formatAddress(dealership).map((l) => (
              <Text key={l} style={s.small}>
                {l}
              </Text>
            ))}
            {dealership.ap_contact_name ? <Text style={s.small}>Attn: {dealership.ap_contact_name}</Text> : null}
            {dealership.ap_emails.length ? <Text style={s.small}>{dealership.ap_emails.join(", ")}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.billLabel}>SERVICE PERIOD</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              {formatDateOnly(invoice.period_start)} – {formatDateOnly(invoice.period_end)}
            </Text>
            <Text style={[s.small, { marginTop: 2 }]}>
              {items.length} line{items.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        {/* Lines */}
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={s.cDate}>DATE</Text>
            <Text style={s.cTag}>TAG</Text>
            <Text style={s.cVin}>VIN</Text>
            <Text style={s.cVeh}>VEHICLE</Text>
            <Text style={s.cSvc}>SERVICE</Text>
            <Text style={s.cAmt}>AMOUNT</Text>
          </View>
          {items.map((it, i) => (
            <View key={it.id} style={[s.tr, { backgroundColor: i % 2 ? c.zebra : "#ffffff" }]} wrap={false}>
              <Text style={s.cDate}>{format(new Date(it.performed_at), "MM/dd/yy")}</Text>
              <Text style={s.cTag}>{it.tag_number}</Text>
              <Text style={s.cVin}>{it.vin ?? ""}</Text>
              <Text style={s.cVeh}>{[it.year, it.make, it.model].filter(Boolean).join(" ")}</Text>
              <Text style={s.cSvc}>{it.service_name}</Text>
              <Text style={s.cAmt}>{formatMoney(it.price)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totals} wrap={false}>
          <View style={s.totRow}>
            <Text style={s.totKey}>Subtotal</Text>
            <Text>{formatMoney(invoice.subtotal)}</Text>
          </View>
          <View style={s.totRow}>
            <Text style={s.totKey}>Tax ({formatTaxRate(Number(invoice.tax_rate))})</Text>
            <Text>{formatMoney(invoice.tax)}</Text>
          </View>
          <View style={s.totGrand}>
            <Text>Total</Text>
            <Text>{formatMoney(invoice.total)}</Text>
          </View>
          {Number(invoice.amount_paid) > 0 ? (
            <>
              <View style={s.totRow}>
                <Text style={s.totKey}>Paid</Text>
                <Text>-{formatMoney(invoice.amount_paid)}</Text>
              </View>
              <View style={[s.totRow, { fontFamily: "Helvetica-Bold" }]}>
                <Text>Balance due</Text>
                <Text>{formatMoney(balance)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Terms / notes */}
        <View style={s.notes} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Payment terms</Text>
          <Text style={s.small}>
            {invoice.payment_terms}. Please reference {invoice.display_number} on remittance
            {company.email ? ` and send remittance advice to ${company.email}` : ""}.
          </Text>
          {invoice.notes ? (
            <>
              <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 }}>Notes</Text>
              <Text style={s.small}>{invoice.notes}</Text>
            </>
          ) : null}
          <Text style={[s.small, { marginTop: 10 }]}>Thank you for your business.</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {company.name} · {invoice.display_number}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function invoicePdf(bundle: InvoiceBundle, variant: PdfVariant = "branded"): Promise<Buffer> {
  const buf = await renderToBuffer(<InvoiceDocument bundle={bundle} variant={variant} />);
  return Buffer.from(buf);
}
