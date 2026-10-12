import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPickerCustomers } from "@/lib/retail/pick";
import { EstimateBuilder } from "@/components/retail/estimate-builder";

export const metadata: Metadata = { title: "Edit estimate" };

/** Edit a draft or a sent estimate (editing a sent one puts it back to draft until it is sent again). */
export default async function EditEstimatePage(props: PageProps<"/retail/estimates/[id]/edit">) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session.canPrices) redirect(`/retail/estimates/${id}`);
  const supabase = await createClient();
  const [{ data: e }, { data: catalog }, picker] = await Promise.all([supabase.rpc("estimate_detail", { p_id: id }), supabase.rpc("retail_catalog"), loadPickerCustomers(supabase, { customer: undefined })]);
  if (!e || !catalog) notFound();
  if (e.status === "accepted" || e.status === "declined") redirect(`/retail/estimates/${id}`);
  const withCustomer = picker.recent.some((c) => c.id === e.customer.id) ? picker : await loadPickerCustomers(supabase, { customer: e.customer.id, vehicle: e.vehicle?.id });
  return <EstimateBuilder catalog={catalog} recent={withCustomer.initialPick?.customer ? [withCustomer.initialPick.customer, ...withCustomer.recent.filter((c) => c.id !== e.customer.id)] : withCustomer.recent} estimate={e} />;
}
