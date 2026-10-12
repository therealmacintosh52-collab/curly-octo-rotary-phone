import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CustomerDetail } from "@/components/retail/customer-detail";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage(props: PageProps<"/retail/customers/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("customer_timeline", { p_id: id });
  if (error || !data) notFound();
  return <CustomerDetail data={data} showMoney={session.canPrices} />;
}
