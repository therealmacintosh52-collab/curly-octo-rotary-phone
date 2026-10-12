import { notFound } from "next/navigation";
import { EstimatePublic } from "@/components/retail/estimate-public";
import { estimatePublicFixture } from "@/test/retail-fixtures";

/** Fixture preview of the customer's approval page (`/e/<token>` in the guest demo). Nothing is sent. */
export default async function DevEstimatePublicPreview(props: PageProps<"/dev/preview/retail/estimate-public/[token]">) {
  const { token } = await props.params;
  const e = estimatePublicFixture(token);
  if (!e) notFound();
  return <EstimatePublic e={e} token={token} demo />;
}
