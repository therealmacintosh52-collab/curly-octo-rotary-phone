import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/app/page-header";
import { ESTIMATE_PAGE_SIZE, EstimateList, type EstimateFilter } from "@/components/retail/estimate-list";
import { isStageFilter } from "@/lib/retail/estimate-stage";

export const metadata: Metadata = { title: "Estimates" };

/** Every retail estimate. Totals only for owner and admin. */
export default async function EstimatesPage(props: PageProps<"/retail/estimates">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  // The old ?status= links keep working: "all" means all, anything else falls back to Open.
  const asked = sp.stage ?? sp.status;
  const status: EstimateFilter = isStageFilter(asked) ? asked : "open";
  const page = Math.max(1, Number(sp.page) || 1);
  const session = await getSession();
  const supabase = await createClient();
  const { data } = await supabase.rpc("estimates_filtered", { p_q: q || null, p_status: "all", p_stage: status === "all" ? null : status, p_limit: ESTIMATE_PAGE_SIZE, p_offset: (page - 1) * ESTIMATE_PAGE_SIZE });
  return (
    <Page>
      <PageHeader title="Estimates" description="Every customer visit, from the quote to the signed invoice. One document, one place." />
      <div className="mt-5">
        <EstimateList rows={data?.rows ?? []} count={data?.count ?? 0} counts={data?.counts} page={page} q={q} status={status} showMoney={session.canPrices} />
      </div>
    </Page>
  );
}
