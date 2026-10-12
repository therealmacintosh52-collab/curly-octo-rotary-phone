import { loadPublicEstimate } from "@/lib/estimates/public";
import { EstimateDone } from "@/components/retail/estimate-done";

export const dynamic = "force-dynamic";

/** /e/:token/done — after the answer. */
export default async function PublicEstimateDonePage(props: PageProps<"/e/[token]/done">) {
  const [{ token }, sp] = await Promise.all([props.params, props.searchParams]);
  const e = await loadPublicEstimate(token);
  return <EstimateDone token={token} declined={sp.declined === "1"} pay={sp.pay === "deposit" ? "deposit" : "at_shop"} company={e?.company.name ?? "the shop"} phone={e?.company.phone ?? null} displayNumber={e?.display_number ?? null} />;
}
