import "server-only";

import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";

const x = StyleSheet.create({
  box: { marginTop: 18, borderTopWidth: 0.75, borderTopColor: "#888888", paddingTop: 8 },
  statement: { fontSize: 9, lineHeight: 1.4, color: "#222222" },
  row: { flexDirection: "row", marginTop: 26, gap: 18 },
  line: { borderBottomWidth: 0.75, borderBottomColor: "#111111", height: 16 },
  caption: { fontSize: 7.5, color: "#666666", marginTop: 2 },
});

/**
 * The blank signature block printed on an unsigned estimate or invoice: the customer who is
 * standing there signs on the paper (the statement says what the signature means); a customer
 * who is not signs from the link instead. A signed document shows the signature, not this.
 */
export function SignatureLine({ title, statement, extra }: { title: string; statement: string; extra?: string }) {
  return (
    <View style={x.box} wrap={false} data-signature-line>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{title}</Text>
      <Text style={x.statement}>{statement}</Text>
      {extra ? (
        <View style={{ marginTop: 14 }}>
          <View style={x.line} />
          <Text style={x.caption}>{extra}</Text>
        </View>
      ) : null}
      <View style={x.row}>
        <View style={{ flex: 3 }}>
          <View style={x.line} />
          <Text style={x.caption}>Customer signature</Text>
        </View>
        <View style={{ flex: 2 }}>
          <View style={x.line} />
          <Text style={x.caption}>Printed name</Text>
        </View>
        <View style={{ flex: 1.2 }}>
          <View style={x.line} />
          <Text style={x.caption}>Date</Text>
        </View>
      </View>
    </View>
  );
}
