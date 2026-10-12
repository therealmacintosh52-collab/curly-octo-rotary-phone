import { loadPublicEstimate } from "@/lib/estimates/public";
import { EstimateDone } from "@/components/retail/estimate-done";
import { depositsOnline } from "@/lib/clover/env";

export const dynamic = "force-dynamic";

/** /e/:token/done — after the answer. */
export default async function PublicEstimateDonePage(props: PageProps<"/e/[token]/done">) {
  const [{ token }, sp] = await Promise.all([props.params, props.searchParams]);
  const e = await loadPublicEstimate(token);
  const pay = sp.pay === "deposit" || e?.authorizations[0]?.pay_choice === "deposit" ? "deposit" : "at_shop";
  return <EstimateDone token={token} declined={sp.declined === "1"} pay={pay} company={e?.company.name ?? "the shop"} phone={e?.company.phone ?? null} displayNumber={e?.display_number ?? null} deposit={e?.deposit_required ?? 0} depositsOnline={depositsOnline()} justPaid={sp.paid === "1"} />;
}
