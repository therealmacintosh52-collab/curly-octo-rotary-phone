import "server-only";

import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { EstimateView } from "@/lib/db/types";
import { keyTagFields, oilStickerFields, type OilStickerOptions } from "./fields";

// Points: 72 per inch. A key tag is 4 × 2 in; an oil sticker 3 × 2 in. Helvetica only.
export const KEY_TAG_SIZE: [number, number] = [288, 144];
export const OIL_STICKER_SIZE: [number, number] = [216, 144];

const s = StyleSheet.create({
  page: { padding: 10, fontFamily: "Helvetica", color: "#000000" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  big: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  kind: { fontSize: 7, letterSpacing: 1, textTransform: "uppercase" },
  car: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 4 },
  small: { fontSize: 9, marginTop: 2 },
  plate: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 2, marginTop: 4 },
  foot: { position: "absolute", left: 10, right: 10, bottom: 8, flexDirection: "row", justifyContent: "space-between", fontSize: 8 },
  box: { borderWidth: 1, borderColor: "#000000", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  next: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 2 },
});

export function KeyTagDocument({ e }: { e: EstimateView }) {
  const f = keyTagFields(e);
  return (
    <Document title={`Key tag ${f.number}`} author={e.company.name} subject="Key tag">
      <Page size={KEY_TAG_SIZE} style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={s.kind}>{f.kind}</Text>
            <Text style={s.big}>{f.number}</Text>
          </View>
          {f.label && <Text style={[s.small, s.box]}>{f.label}</Text>}
        </View>
        <Text style={s.car}>{f.car}</Text>
        <Text style={s.small}>{[f.color, f.vin6 ? `VIN …${f.vin6}` : null].filter(Boolean).join(" · ")}</Text>
        {f.plate && <Text style={s.plate}>{f.plate}</Text>}
        <View style={s.foot}>
          <Text>{f.customer}{f.mileage ? ` · ${f.mileage.toLocaleString("en-US")} mi` : ""}</Text>
          <Text>{[f.advisor ? `SA ${f.advisor}` : null, f.dueOut ? `Out ${format(new Date(f.dueOut), "M/d h:mm a")}` : null].filter(Boolean).join(" · ")}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function OilStickerDocument({ e, options }: { e: EstimateView; options: OilStickerOptions }) {
  const f = oilStickerFields(e, options);
  return (
    <Document title="Oil change sticker" author={e.company.name} subject="Oil change sticker">
      <Page size={OIL_STICKER_SIZE} style={s.page}>
        <Text style={s.kind}>{e.company.name}</Text>
        <Text style={s.small}>Oil changed {f.date}{f.mileage ? ` at ${f.mileage.toLocaleString("en-US")} mi` : ""}</Text>
        <Text style={[s.kind, { marginTop: 8 }]}>Next service</Text>
        <Text style={s.next}>{f.nextMileage ? `${f.nextMileage.toLocaleString("en-US")} mi` : f.nextDate}</Text>
        <Text style={s.small}>{f.nextMileage ? `or ${f.nextDate}, whichever comes first` : "or sooner by mileage"}</Text>
        <View style={s.foot}>
          <Text>{[f.car, f.plate].filter(Boolean).join(" · ")}</Text>
          <Text>{f.oil ?? ""}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function keyTagPdf(e: EstimateView): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<KeyTagDocument e={e} />));
}
export async function oilStickerPdf(e: EstimateView, options: OilStickerOptions): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<OilStickerDocument e={e} options={options} />));
}
