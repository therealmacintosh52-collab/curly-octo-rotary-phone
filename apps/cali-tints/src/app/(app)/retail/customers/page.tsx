import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/app/page-header";
import { CUSTOMER_PAGE_SIZE, CustomerList } from "@/components/retail/customer-list";

export const metadata: Metadata = { title: "Customers" };

/** Every retail customer. Money (lifetime spend) only for owner and admin. */
export default async function CustomersPage(props: PageProps<"/retail/customers">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const archived = sp.archived === "1";
  const page = Math.max(1, Number(sp.page) || 1);
  const session = await getSession();
  const supabase = await createClient();
  const { data } = await supabase.rpc("customers_filtered", { p_q: q || null, p_archived: archived, p_limit: CUSTOMER_PAGE_SIZE, p_offset: (page - 1) * CUSTOMER_PAGE_SIZE });
  return (
    <Page>
      <PageHeader title="Customers" description="Walk-in customers at the shop and their cars." />
      <div className="mt-5">
        <CustomerList rows={data?.rows ?? []} count={data?.count ?? 0} page={page} q={q} archived={archived} showMoney={session.canPrices} />
      </div>
    </Page>
  );
}
