import "server-only";

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { ReceiptView } from "@/lib/db/types";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatAddress } from "@/lib/address";
import { LOGO_PNG_BASE64 } from "@/lib/invoices/logo";
import { FindingsPdfSection } from "@/lib/estimates/findings-pdf";

const accent = "#3f8f1f";
const rule = "#d7dbde";
const muted = "#5f6b73";
const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 48, fontSize: 9.5, fontFamily: "Helvetica", color: "#111111" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  logo: { width: 54, height: 54, marginRight: 12 },
  companyName: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  small: { fontSize: 8.5, color: muted, lineHeight: 1.35 },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: 2, color: accent, textAlign: "right" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  metaKey: { width: 70, textAlign: "right", color: muted, fontSize: 8.5, marginRight: 8 },
  metaVal: { width: 110, textAlign: "right", fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: rule },
  billLabel: { fontSize: 7.5, color: muted, letterSpacing: 1.2, marginBottom: 3 },
  billName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: rule },
  totals: { marginTop: 12, alignSelf: "flex-end", width: 260 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totKey: { color: muted },
  totGrand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTopWidth: 1.25, borderTopColor: accent, fontFamily: "Helvetica-Bold", fontSize: 12 },
  sig: { marginTop: 22, flexDirection: "row", alignItems: "flex-end", gap: 12 },
  sigImg: { width: 160, height: 60, borderBottomWidth: 0.75, borderBottomColor: "#111111" },
  footer: { position: "absolute", left: 48, right: 48, bottom: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: muted },
});

const METHOD: Record<string, string> = { clover_online: "Card online", clover_flex: "Card at the counter", cash: "Cash", check: "Check", other: "Other" };

/** Letter-size receipt: the lines, the deposit, the balance paid, every payment, the signature at pickup. */
export function ReceiptDocument({ r, logoDataUri, signatureDataUri }: { r: ReceiptView; logoDataUri: string | null; signatureDataUri: string | null }) {
  // A retail job is its own invoice (RI-…); the same page is the receipt once it is paid.
  const isInvoice = !!r.invoice_number;
  const heading = isInvoice ? "INVOICE" : "RECEIPT";
  const logoSrc = logoDataUri ?? `data:image/png;base64,${LOGO_PNG_BASE64}`;
  return (
    <Document title={`${isInvoice ? "Invoice" : "Receipt"} ${r.invoice_number ?? r.tag} — ${r.company.name}`} author={r.company.name} subject={isInvoice ? "Invoice" : "Receipt"}>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={s.logo} />
            <View>
              <Text style={s.companyName}>{r.company.name}</Text>
              {formatAddress(r.company).map((l) => (
                <Text key={l} style={s.small}>{l}</Text>
              ))}
              {r.company.phone ? <Text style={s.small}>{r.company.phone}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>{heading}</Text>
            <View style={{ marginTop: 8 }}>
              {r.invoice_number ? <View style={s.metaRow}><Text style={s.metaKey}>Invoice</Text><Text style={s.metaVal}>{r.invoice_number}</Text></View> : null}
              {r.ro_number ? <View style={s.metaRow}><Text style={s.metaKey}>RO</Text><Text style={s.metaVal}>{r.ro_number}</Text></View> : null}
              <View style={s.metaRow}><Text style={s.metaKey}>Tag</Text><Text style={s.metaVal}>{r.tag}</Text></View>
              <View style={s.metaRow}><Text style={s.metaKey}>Date</Text><Text style={s.metaVal}>{format(new Date(r.paid_at ?? r.performed_at), "MMM d, yyyy")}</Text></View>
              {r.paid_at ? <View style={s.metaRow}><Text style={s.metaKey}>Paid</Text><Text style={s.metaVal}>{format(new Date(r.paid_at), "h:mm a")}</Text></View> : null}
            </View>
          </View>
        </View>

        <View style={s.billRow}>
          <View>
            <Text style={s.billLabel}>CUSTOMER</Text>
            <Text style={s.billName}>{r.customer?.display_name ?? r.customer?.first_name ?? "Walk-in"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.billLabel}>VEHICLE</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{r.vehicle ?? "Vehicle"}</Text>
            {r.color || r.plate || r.odometer ? <Text style={s.small}>{[r.color, r.plate ? `Plate ${r.plate}` : null, r.odometer ? `${r.odometer.toLocaleString("en-US")} mi` : null].filter(Boolean).join(" · ")}</Text> : null}
          </View>
        </View>

        <FindingsPdfSection findings={r.findings} />

        {r.lines.map((l, i) => (
          <View key={i} style={s.line}>
            <Text>{l.name}</Text>
            <Text>{formatMoney(l.price)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.totRow}><Text style={s.totKey}>Subtotal</Text><Text>{formatMoney(r.subtotal)}</Text></View>
          <View style={s.totRow}><Text style={s.totKey}>Tax ({formatTaxRate(Number(r.tax_rate ?? 0))})</Text><Text>{formatMoney(r.tax)}</Text></View>
          <View style={s.totGrand}><Text>Total</Text><Text>{formatMoney(r.total)}</Text></View>
          {r.payments.map((p, i) => (
            <View key={i} style={s.totRow}>
              <Text style={s.totKey}>{p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Paid"} · {METHOD[p.method] ?? p.method}{p.paid_at ? ` · ${format(new Date(p.paid_at), "MMM d")}` : ""}</Text>
              <Text>{p.kind === "refund" ? "+" : "−"}{formatMoney(p.amount)}</Text>
            </View>
          ))}
          <View style={s.totRow}><Text style={[s.totKey, { fontFamily: "Helvetica-Bold" }]}>{isInvoice && !r.paid_at ? "Balance due" : "Balance"}</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{formatMoney(r.balance)}</Text></View>
        </View>

        {r.signed_name ? (
          <View style={s.sig} wrap={false}>
            {signatureDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={signatureDataUri} style={s.sigImg} />
            ) : (
              <View style={[s.sigImg, { justifyContent: "flex-end" }]}><Text style={{ fontFamily: "Helvetica-Oblique", fontSize: 12 }}>{r.signed_name}</Text></View>
            )}
            <View>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Received by {r.signed_name}</Text>
              {r.signed_at ? <Text style={s.small}>{format(new Date(r.signed_at), "MMM d, yyyy h:mm a")}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>{r.company.name} · thank you</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function receiptPdf(r: ReceiptView, logoDataUri: string | null, signatureDataUri: string | null): Promise<Buffer> {
  const buf = await renderToBuffer(<ReceiptDocument r={r} logoDataUri={logoDataUri} signatureDataUri={signatureDataUri} />);
  return Buffer.from(buf);
}
