import { EstimateDone } from "@/components/retail/estimate-done";
import { estimatePublicFixture } from "@/test/retail-fixtures";

/** Fixture preview of the thank-you page. */
export default async function DevEstimateDonePreview(props: PageProps<"/dev/preview/retail/estimate-public/[token]/done">) {
  const [{ token }, sp] = await Promise.all([props.params, props.searchParams]);
  const e = estimatePublicFixture(token);
  return <EstimateDone token={token} declined={sp.declined === "1"} pay={sp.pay === "deposit" ? "deposit" : "at_shop"} company={e?.company.name ?? "Cali Tints"} phone={e?.company.phone ?? null} displayNumber={e?.display_number ?? null} />;
}
