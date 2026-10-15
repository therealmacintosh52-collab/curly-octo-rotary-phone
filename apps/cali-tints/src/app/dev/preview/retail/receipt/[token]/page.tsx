import { notFound } from "next/navigation";
import { ReceiptView } from "@/components/retail/receipt-view";
import { receiptFixture } from "@/test/retail-fixtures";

/** Fixture preview of the customer's receipt (`/r/<token>` in the guest demo). */
export default async function DevReceiptPreview(props: PageProps<"/dev/preview/retail/receipt/[token]">) {
  const { token } = await props.params;
  const r = receiptFixture(token, false);
  if (!r) notFound();
  return <ReceiptView r={r} token={token} demo />;
}
