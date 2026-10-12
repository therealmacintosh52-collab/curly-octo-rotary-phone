import { notFound } from "next/navigation";
import { ManageAppointment } from "@/components/retail/manage-appointment";
import { appointmentPublicFixture } from "@/test/retail-fixtures";

/** Fixture preview of the customer's appointment page (`/a/<token>` in the guest demo). */
export default async function DevManagePreview(props: PageProps<"/dev/preview/retail/appointment-public/[token]">) {
  const [{ token }, sp] = await Promise.all([props.params, props.searchParams]);
  const a = appointmentPublicFixture(token, "manage");
  if (!a) notFound();
  return <ManageAppointment a={a} token={token} isNew={sp.new === "1"} demo depositsOnline justPaid={sp.paid === "1"} failed={sp.failed === "1"} />;
}
