import "server-only";

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { ReceiptView } from "@/lib/db/types";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatAddress } from "@/lib/address";
import { LOGO_PNG_BASE64 } from "@/lib/invoices/logo";
import { FindingsPdfSection } from "@/lib/estimates/findings-pdf";
import { taxLabel } from "@/components/retail/invoice-document";
import { PAYMENT_METHOD } from "@/lib/retail/payment-labels";

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

const TYPE_LABEL: Record<string, string> = { labor: "Labor", part: "Part", fee: "Fee", shop_supplies: "Fee", sublet: "Sublet", service: "Service" };
const AUTH_KIND: Record<string, string> = { initial: "Diagnosis approved", estimate: "Work approved", change_order: "Change order approved" };
const AUTH_HOW: Record<string, string> = { online: "link", in_person: "in person", phone: "phone or text", email: "email" };
const PRIORITY: Record<string, string> = { safety: "safety", soon: "due soon", optional: "optional" };
const REC: Record<string, string> = { replace: "recommend replace", diagnose: "recommend diagnosis", monitor: "keep an eye on it" };
const x = StyleSheet.create({
  h3: { fontSize: 9.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  block: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: rule },
  jobHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  jobLine: { flexDirection: "row", paddingVertical: 1.5 },
  jobType: { width: 42, color: muted, fontSize: 8 },
  jobName: { flex: 1 },
  jobAmt: { width: 62, textAlign: "right" },
  jobTotal: { textAlign: "right", fontFamily: "Helvetica-Bold", marginTop: 2 },
});

const METHOD = PAYMENT_METHOD;

/** Letter-size receipt: the lines, the deposit, the balance paid, every payment, the signature at pickup. */
export function ReceiptDocument({ r, logoDataUri, signatureDataUri }: { r: ReceiptView; logoDataUri: string | null; signatureDataUri: string | null }) {
  // A retail job is its own invoice (RI-…); the same page is the receipt once it is paid.
  const isInvoice = !!r.invoice_number;
  const heading = isInvoice ? "INVOICE" : "RECEIPT";
  const jobs = r.jobs ?? [];
  const extras = r.extras ?? [];
  const declined = r.declined ?? [];
  const recommended = r.recommended ?? [];
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
              {r.bar_license ? <Text style={s.small}>BAR Lic# {r.bar_license}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>{heading}</Text>
            <View style={{ marginTop: 8 }}>
              {r.invoice_number ? <View style={s.metaRow}><Text style={s.metaKey}>Invoice</Text><Text style={s.metaVal}>{r.invoice_number}</Text></View> : null}
              {r.ro_number ? <View style={s.metaRow}><Text style={s.metaKey}>RO</Text><Text style={s.metaVal}>{r.ro_number}</Text></View> : null}
              {r.advisor ? <View style={s.metaRow}><Text style={s.metaKey}>Advisor</Text><Text style={s.metaVal}>{r.advisor}</Text></View> : null}
              {r.tech ? <View style={s.metaRow}><Text style={s.metaKey}>Tech</Text><Text style={s.metaVal}>{r.tech}</Text></View> : null}
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
            {r.color || r.plate || r.odometer ? <Text style={s.small}>{[r.color, r.plate ? `Plate ${r.plate}` : null, r.odometer ? `Mileage In ${r.odometer.toLocaleString("en-US")}` : null, r.odometer_out != null ? `Out ${r.odometer_out.toLocaleString("en-US")}` : null].filter(Boolean).join(" · ")}</Text> : null}
            {r.vin ? <Text style={s.small}>VIN {r.vin}</Text> : null}
          </View>
        </View>

        {r.concern ? (
          <View style={x.block}>
            <Text style={s.billLabel}>CUSTOMER CONCERN</Text>
            <Text style={{ fontFamily: "Helvetica-Oblique" }}>&ldquo;{r.concern}&rdquo;</Text>
          </View>
        ) : null}

        {jobs.length > 0 ? (
          <>
            {jobs.map((j, i) => {
              const n = jobs.slice(0, i + 1).filter((q) => q.kind !== "diagnosis").length;
              return (
                <View key={j.id} style={x.block} wrap={false}>
                  <View style={x.jobHead}>
                    <Text style={x.h3}>{j.kind === "diagnosis" ? j.title : `Job ${n}: ${j.title}`}</Text>
                    <Text style={s.small}>[{j.status === "declined" ? "DECLINED" : "APPROVED"}]</Text>
                  </View>
                  {j.cause ? <Text style={{ marginTop: 3 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Cause: </Text>{j.cause}</Text> : null}
                  {j.correction ? <Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Correction: </Text>{j.correction}</Text> : null}
                  <View style={{ marginTop: 4 }}>
                    {j.lines.map((l, k) => (
                      <View key={k} style={x.jobLine}>
                        <Text style={x.jobType}>{TYPE_LABEL[l.type] ?? "Item"}</Text>
                        <Text style={x.jobName}>{l.name}{l.type === "labor" && l.hours ? ` · ${l.hours} h` : l.type === "part" && l.qty && l.qty !== 1 ? ` × ${l.qty}` : ""}</Text>
                        <Text style={x.jobAmt}>{formatMoney(l.total)}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={x.jobTotal}>Job Total: {formatMoney(j.total)}</Text>
                </View>
              );
            })}
            {extras.length > 0 ? (
              <View style={x.block} wrap={false}>
                <Text style={x.h3}>Other charges</Text>
                {extras.map((l, k) => (
                  <View key={k} style={x.jobLine}>
                    <Text style={x.jobType}>{TYPE_LABEL[l.type] ?? "Item"}</Text>
                    <Text style={x.jobName}>{l.name}</Text>
                    <Text style={x.jobAmt}>{formatMoney(l.total)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {declined.length > 0 || recommended.length > 0 ? (
              <View style={x.block} wrap={false}>
                <Text style={x.h3}>Declined / recommended</Text>
                {declined.map((d, k) => (
                  <View key={`d${k}`} style={x.jobLine}>
                    <Text style={x.jobName}>{d.title} · {PRIORITY[d.priority]}</Text>
                    {d.total != null ? <Text style={x.jobAmt}>{formatMoney(d.total)}</Text> : null}
                  </View>
                ))}
                {recommended.map((d, k) => (
                  <View key={`r${k}`} style={x.jobLine}>
                    <Text style={x.jobName}>{d.title}{d.recommendation ? ` · ${REC[d.recommendation]}` : ""}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <FindingsPdfSection findings={r.findings} />
            {r.lines.map((l, i) => (
              <View key={i} style={s.line}>
                <Text>{l.name}</Text>
                <Text>{formatMoney(l.price)}</Text>
              </View>
            ))}
          </>
        )}

        <View style={s.totals} wrap={false}>
          {jobs.length > 0 && r.categories ? (
            <>
              {r.categories.labor > 0 ? <View style={s.totRow}><Text style={s.totKey}>Labor</Text><Text>{formatMoney(r.categories.labor)}</Text></View> : null}
              {r.categories.parts > 0 ? <View style={s.totRow}><Text style={s.totKey}>Parts</Text><Text>{formatMoney(r.categories.parts)}</Text></View> : null}
              {r.categories.fees > 0 ? <View style={s.totRow}><Text style={s.totKey}>Fees</Text><Text>{formatMoney(r.categories.fees)}</Text></View> : null}
              {r.categories.sublets > 0 ? <View style={s.totRow}><Text style={s.totKey}>Sublets</Text><Text>{formatMoney(r.categories.sublets)}</Text></View> : null}
              {r.categories.services > 0 ? <View style={s.totRow}><Text style={s.totKey}>Services</Text><Text>{formatMoney(r.categories.services)}</Text></View> : null}
            </>
          ) : null}
          <View style={s.totRow}><Text style={s.totKey}>Subtotal</Text><Text>{formatMoney(r.subtotal)}</Text></View>
          <View style={s.totRow}><Text style={s.totKey}>{jobs.length > 0 ? taxLabel(r) : `Tax (${formatTaxRate(Number(r.tax_rate ?? 0))})`}</Text><Text>{formatMoney(r.tax)}</Text></View>
          <View style={s.totGrand}><Text>Total</Text><Text>{formatMoney(r.total)}</Text></View>
          {r.payments.map((p, i) => (
            <View key={i} style={s.totRow}>
              <Text style={s.totKey}>{p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Paid"} · {METHOD[p.method] ?? p.method}{p.note ? ` (${p.note})` : ""}{p.paid_at ? ` · ${format(new Date(p.paid_at), "MMM d")}` : ""}</Text>
              <Text>{p.kind === "refund" ? "+" : "−"}{formatMoney(p.amount)}</Text>
            </View>
          ))}
          <View style={s.totRow}><Text style={[s.totKey, { fontFamily: "Helvetica-Bold" }]}>{isInvoice && !r.paid_at ? "Balance due" : "Balance"}</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{formatMoney(r.balance)}</Text></View>
        </View>

        {(r.authorizations ?? []).length > 0 ? (
          <View style={x.block} wrap={false}>
            <Text style={x.h3}>Authorization log</Text>
            {(r.authorizations ?? []).map((a, k) => (
              <Text key={k} style={s.small}>{AUTH_KIND[a.kind]}: {AUTH_HOW[a.method]} {format(new Date(a.authorized_at), "MMM d, yyyy h:mm a")}{a.amount != null && a.amount > 0 ? ` · ${formatMoney(a.amount)}` : ""} · {a.name}</Text>
            ))}
          </View>
        ) : null}

        {r.warranty_text || r.parts_disposition ? (
          <View style={x.block} wrap={false}>
            {r.warranty_text ? <Text><Text style={{ fontFamily: "Helvetica-Bold" }}>WARRANTY: </Text>{r.warranty_text}</Text> : null}
            {r.parts_disposition ? (
              <Text style={[s.small, { marginTop: 3 }]}>Replaced parts: {(["offered", "returned", "declined"] as const).map((k) => (r.parts_disposition === k ? `[${k}]` : k)).join(" / ")}</Text>
            ) : null}
          </View>
        ) : null}

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
