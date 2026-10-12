import { notFound } from "next/navigation";
import { loadPublicEstimate } from "@/lib/estimates/public";
import { EstimatePublic } from "@/components/retail/estimate-public";

export const dynamic = "force-dynamic";

/** /e/:token — the customer's copy of the estimate, where they pick, sign and approve. */
export default async function PublicEstimatePage(props: PageProps<"/e/[token]">) {
  const { token } = await props.params;
  const e = await loadPublicEstimate(token);
  if (!e) notFound();
  return <EstimatePublic e={e} token={token} />;
}
