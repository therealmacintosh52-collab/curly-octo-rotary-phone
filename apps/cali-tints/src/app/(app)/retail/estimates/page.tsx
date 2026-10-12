import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/app/page-header";
import { ESTIMATE_PAGE_SIZE, EstimateList, type EstimateFilter } from "@/components/retail/estimate-list";

export const metadata: Metadata = { title: "Estimates" };

const FILTERS: EstimateFilter[] = ["open", "all", "draft", "sent", "viewed", "accepted", "declined", "expired"];

/** Every retail estimate. Totals only for owner and admin. */
export default async function EstimatesPage(props: PageProps<"/retail/estimates">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (FILTERS as string[]).includes(String(sp.status)) ? (sp.status as EstimateFilter) : "open";
  const page = Math.max(1, Number(sp.page) || 1);
  const session = await getSession();
  const supabase = await createClient();
  const { data } = await supabase.rpc("estimates_filtered", { p_q: q || null, p_status: status, p_limit: ESTIMATE_PAGE_SIZE, p_offset: (page - 1) * ESTIMATE_PAGE_SIZE });
  return (
    <Page>
      <PageHeader title="Estimates" description="Quotes for walk-in customers: write it, send the link, they pick and sign." />
      <div className="mt-5">
        <EstimateList rows={data?.rows ?? []} count={data?.count ?? 0} page={page} q={q} status={status} showMoney={session.canPrices} />
      </div>
    </Page>
  );
}
