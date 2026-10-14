import "server-only";

import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { JobFinding } from "@/lib/db/types";

const muted = "#5f6b73";
const rule = "#d7dbde";
const s = StyleSheet.create({
  box: { marginTop: 4, marginBottom: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: rule },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  item: { marginBottom: 6 },
  head: { flexDirection: "row", alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  name: { fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8.5, color: muted, lineHeight: 1.35 },
});
const DOT = { urgent: "#c0392b", soon: "#d68910", ok: "#3f8f1f" } as const;
const WORD = { urgent: "needs attention now", soon: "soon", ok: "for your information" } as const;

/**
 * What the tech found, for a customer's PDF: the title and severity, the
 * notes, what we recommend, and how many photos / clips are on the online page.
 * Internal-only notes never print.
 */
export function FindingsPdfSection({ findings }: { findings: JobFinding[] | undefined }) {
  const shown = (findings ?? []).filter((f) => f.customer_visible !== false);
  if (shown.length === 0) return null;
  return (
    <View style={s.box}>
      <Text style={s.title}>What we found</Text>
      {shown.map((f) => {
        const photos = f.media.filter((m) => m.kind !== "video" && !(m.mime ?? "").startsWith("video/")).length;
        const clips = f.media.length - photos;
        return (
          <View key={f.id} style={s.item} wrap={false}>
            <View style={s.head}>
              {f.kind === "finding" ? <View style={[s.dot, { backgroundColor: DOT[f.severity] }]} /> : null}
              <Text style={s.name}>{f.title}</Text>
              {f.kind === "finding" ? <Text style={s.small}>{`  ·  ${WORD[f.severity]}`}</Text> : null}
            </View>
            {f.body ? <Text style={s.small}>{f.body}</Text> : null}
            {f.recommended_service ? <Text style={s.small}>{`We recommend: ${f.recommended_service}`}</Text> : null}
            {f.media.length ? <Text style={s.small}>{[photos ? `${photos} ${photos === 1 ? "photo" : "photos"}` : null, clips ? `${clips} ${clips === 1 ? "clip" : "clips"}` : null].filter(Boolean).join(", ")} on the online page</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
