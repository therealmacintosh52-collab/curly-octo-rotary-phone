import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** A car is its invoice: old job links open the invoice that carries the car. */
export default async function JobRedirect(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("invoice_id, tag_number").eq("id", id).maybeSingle();
  if (data?.invoice_id) redirect(`/invoices/${data.invoice_id}`);
  redirect(data ? `/invoices?q=${encodeURIComponent(data.tag_number)}` : "/invoices");
}
