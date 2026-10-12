import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { anonClient, isTokenShape } from "@/lib/estimates/public";
import { ReceiptView } from "@/components/retail/receipt-view";

export const metadata: Metadata = { title: "Your receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** /r/:token — the customer's receipt for a paid retail job. */
export default async function ReceiptPage(props: PageProps<"/r/[token]">) {
  const { token } = await props.params;
  if (!isTokenShape(token)) notFound();
  const { data, error } = await anonClient().rpc("receipt_by_token", { p_token: token });
  if (error || !data) notFound();
  return <ReceiptView r={data} token={token} />;
}
