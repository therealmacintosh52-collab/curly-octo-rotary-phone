import "server-only";

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { EstimateView } from "@/lib/db/types";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatAddress } from "@/lib/invoices/load";
import { LOGO_PNG_BASE64 } from "@/lib/invoices/logo";
import { SIZE_LABEL } from "@/lib/retail/size-class";

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
  metaVal: { width: 92, textAlign: "right", fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: rule },
  billLabel: { fontSize: 7.5, color: muted, letterSpacing: 1.2, marginBottom: 3 },
  billName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  option: { marginTop: 10, borderWidth: 0.75, borderColor: rule, borderRadius: 4, padding: 10 },
  optionChosen: { borderColor: accent, borderWidth: 1.5 },
  optionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  optionName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  optionTotal: { fontSize: 13, fontFamily: "Helvetica-Bold", color: accent },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: rule },
  lineName: { flex: 1, paddingRight: 8 },
  lineAmt: { width: 70, textAlign: "right" },
  totals: { marginTop: 12, alignSelf: "flex-end", width: 240 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totKey: { color: muted },
  totGrand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTopWidth: 1.25, borderTopColor: accent, fontFamily: "Helvetica-Bold", fontSize: 12 },
  notes: { marginTop: 18, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: rule },
  sig: { marginTop: 16, flexDirection: "row", alignItems: "flex-end", gap: 12 },
  sigImg: { width: 160, height: 60, borderBottomWidth: 0.75, borderBottomColor: "#111111" },
  footer: { position: "absolute", left: 48, right: 48, bottom: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: muted },
});

/**
 * Letter-size estimate: the options side by side (the chosen one outlined once
 * accepted), the add-ons, the policy, and the customer's signature with its
 * timestamp when they approved online.
 */
export function EstimateDocument({ e, logoDataUri, signatureDataUri }: { e: EstimateView; logoDataUri: string | null; signatureDataUri: string | null }) {
  const accepted = e.status === "accepted";
  const auth = e.authorizations[0] ?? null;
  const chosen = e.selected_option_id;
  const approvedAddons = e.addons.filter((a) => (accepted ? a.customer_approved === true : a.default_on));
  const logoSrc = logoDataUri ?? `data:image/png;base64,${LOGO_PNG_BASE64}`;
  return (
    <Document title={`${e.display_number} — ${e.company.name}`} author={e.company.name} subject="Estimate">
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={s.logo} />
            <View>
              <Text style={s.companyName}>{e.company.name}</Text>
              {formatAddress(e.company).map((l) => (
                <Text key={l} style={s.small}>{l}</Text>
              ))}
              {e.company.phone ? <Text style={s.small}>{e.company.phone}</Text> : null}
              {e.company.email ? <Text style={s.small}>{e.company.email}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>ESTIMATE</Text>
            <View style={{ marginTop: 8 }}>
              <View style={s.metaRow}><Text style={s.metaKey}>Estimate #</Text><Text style={s.metaVal}>{e.display_number}</Text></View>
              <View style={s.metaRow}><Text style={s.metaKey}>Date</Text><Text style={s.metaVal}>{format(new Date(e.created_at), "MMM d, yyyy")}</Text></View>
              {e.expires_at ? <View style={s.metaRow}><Text style={s.metaKey}>Good until</Text><Text style={s.metaVal}>{format(new Date(e.expires_at), "MMM d, yyyy")}</Text></View> : null}
              {e.po_number ? <View style={s.metaRow}><Text style={s.metaKey}>PO</Text><Text style={s.metaVal}>{e.po_number}</Text></View> : null}
            </View>
          </View>
        </View>

        <View style={s.billRow}>
          <View>
            <Text style={s.billLabel}>PREPARED FOR</Text>
            <Text style={s.billName}>{e.customer.display_name ?? e.customer.first_name}</Text>
            {e.customer.phone ? <Text style={s.small}>{e.customer.phone}</Text> : null}
            {e.customer.email ? <Text style={s.small}>{e.customer.email}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.billLabel}>VEHICLE</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{e.vehicle?.name ?? "Vehicle"}</Text>
            <Text style={s.small}>{[e.vehicle?.color, e.vehicle?.plate ? `Plate ${e.vehicle.plate}` : null, e.odometer ? `${e.odometer.toLocaleString("en-US")} mi` : null, SIZE_LABEL[e.size_class]].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>

        {e.options.map((o) => (
          <View key={o.id} style={[s.option, chosen === o.id ? s.optionChosen : {}]} wrap={false}>
            <View style={s.optionHead}>
              <Text style={s.optionName}>{o.name}{o.recommended && !accepted ? "  · recommended" : ""}{chosen === o.id && accepted ? "  · chosen" : ""}</Text>
              <Text style={s.optionTotal}>{formatMoney(o.total ?? 0)}</Text>
            </View>
            {o.description ? <Text style={[s.small, { marginBottom: 4 }]}>{o.description}</Text> : null}
            {o.lines.filter((l) => !(accepted && o.tier === "single" && l.customer_approved === false)).map((l) => (
              <View key={l.id} style={s.line}>
                <View style={s.lineName}>
                  <Text>{l.name}{(l.line_type ?? "service") === "service" && l.qty !== 1 ? ` × ${l.qty}` : ""}</Text>
                  {l.line_type === "labor" ? <Text style={s.small}>{`${l.hours} h × ${formatMoney(l.rate ?? 0)}`}</Text> : null}
                  {l.line_type === "part" ? <Text style={s.small}>{[l.qty !== 1 ? `${l.qty} × ${formatMoney(l.unit_price ?? 0)}` : null, l.part_number, l.vendor].filter(Boolean).join(" · ")}</Text> : null}
                  {l.line_type === "sublet" && l.vendor ? <Text style={s.small}>{l.vendor}</Text> : null}
                  {l.benefit_text ? <Text style={s.small}>{l.benefit_text}</Text> : null}
                  {l.modifiers.length ? <Text style={s.small}>{l.modifiers.map((m) => m.label).join(", ")}</Text> : null}
                </View>
                <Text style={s.lineAmt}>{formatMoney(l.line_total ?? 0)}</Text>
              </View>
            ))}
            {(o.shop_supplies ?? 0) > 0 ? (
              <View style={s.line}>
                <View style={s.lineName}><Text>Shop supplies</Text></View>
                <Text style={s.lineAmt}>{formatMoney(o.shop_supplies ?? 0)}</Text>
              </View>
            ) : null}
          </View>
        ))}

        {e.addons.length ? (
          <View style={s.option} wrap={false}>
            <View style={s.optionHead}>
              <Text style={s.optionName}>{accepted ? "Add-ons chosen" : "Add-ons"}</Text>
            </View>
            {(accepted ? approvedAddons : e.addons).map((l) => (
              <View key={l.id} style={s.line}>
                <View style={s.lineName}>
                  <Text>{l.name}</Text>
                  {l.benefit_text ? <Text style={s.small}>{l.benefit_text}</Text> : null}
                </View>
                <Text style={s.lineAmt}>{formatMoney(l.line_total ?? 0)}</Text>
              </View>
            ))}
            {accepted && approvedAddons.length === 0 ? <Text style={s.small}>None</Text> : null}
          </View>
        ) : null}

        <View style={s.totals} wrap={false}>
          <View style={s.totRow}><Text style={s.totKey}>{accepted ? "Subtotal" : "Subtotal (recommended option)"}</Text><Text>{formatMoney(e.subtotal ?? 0)}</Text></View>
          <View style={s.totRow}><Text style={s.totKey}>Tax ({formatTaxRate(Number(e.tax_rate ?? 0))})</Text><Text>{formatMoney(e.tax ?? 0)}</Text></View>
          <View style={s.totGrand}><Text>Total</Text><Text>{formatMoney(e.total ?? 0)}</Text></View>
          {(e.deposit_required ?? 0) > 0 ? <View style={s.totRow}><Text style={s.totKey}>Deposit to book</Text><Text>{formatMoney(e.deposit_required ?? 0)}</Text></View> : null}
        </View>

        <View style={s.notes} wrap={false}>
          {e.customer_notes ? (
            <>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Notes</Text>
              <Text style={s.small}>{e.customer_notes}</Text>
            </>
          ) : null}
          {e.policy?.policy_text ? (
            <>
              <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 }}>Terms</Text>
              <Text style={s.small}>{e.policy.policy_text}</Text>
            </>
          ) : null}
          {accepted && auth ? (
            <View style={s.sig}>
              {signatureDataUri ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={signatureDataUri} style={s.sigImg} />
              ) : (
                <View style={[s.sigImg, { justifyContent: "flex-end" }]}><Text style={{ fontFamily: "Helvetica-Oblique", fontSize: 12 }}>{auth.name}</Text></View>
              )}
              <View>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Approved by {auth.name}</Text>
                <Text style={s.small}>{format(new Date(auth.authorized_at), "MMM d, yyyy h:mm a")} · {auth.method === "online" ? "signed online" : auth.method.replace("_", " ")}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text>{e.company.name} · {e.display_number}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function estimatePdf(e: EstimateView, logoDataUri: string | null, signatureDataUri: string | null): Promise<Buffer> {
  const buf = await renderToBuffer(<EstimateDocument e={e} logoDataUri={logoDataUri} signatureDataUri={signatureDataUri} />);
  return Buffer.from(buf);
}
