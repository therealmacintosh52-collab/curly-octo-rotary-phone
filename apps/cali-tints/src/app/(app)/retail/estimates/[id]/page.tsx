import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/retail/email";
import { EstimateDetail } from "@/components/retail/estimate-detail";

export const metadata: Metadata = { title: "Estimate" };

export default async function EstimatePage(props: PageProps<"/retail/estimates/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  const supabase = await createClient();
  const { data: e, error } = await supabase.rpc("estimate_detail", { p_id: id });
  if (error || !e) notFound();
  // The public link: the token is only handed to staff who can send (owner/admin), and only once the estimate exists.
  let publicUrl: string | null = null;
  if (session.canPrices) {
    const { data: token } = await supabase.rpc("estimate_link", { p_id: id });
    if (token) publicUrl = `${appUrl() ?? ""}/e/${token}`;
  }
  return <EstimateDetail e={e} showMoney={session.canPrices} publicUrl={publicUrl} />;
}
