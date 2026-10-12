import { notFound } from "next/navigation";
import { loadPublicAppointment } from "@/lib/booking/public";
import { ManageAppointment } from "@/components/retail/manage-appointment";
import { depositsOnline } from "@/lib/clover/env";

export const dynamic = "force-dynamic";

/** /a/:token — see, move or cancel the appointment inside the policy. */
export default async function ManagePage(props: PageProps<"/a/[token]">) {
  const [{ token }, sp] = await Promise.all([props.params, props.searchParams]);
  const a = await loadPublicAppointment(token);
  if (!a) notFound();
  return <ManageAppointment a={a} token={token} isNew={sp.new === "1"} depositsOnline={depositsOnline()} justPaid={sp.paid === "1"} failed={sp.failed === "1"} />;
}
