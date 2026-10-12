import { notFound } from "next/navigation";
import { loadPublicAppointment } from "@/lib/booking/public";
import { HoldConfirm } from "@/components/retail/hold-confirm";

export const dynamic = "force-dynamic";

/** /book/:token — the held spot: who you are, the car, finish booking. */
export default async function HoldPage(props: PageProps<"/book/[token]">) {
  const { token } = await props.params;
  const a = await loadPublicAppointment(token);
  if (!a) notFound();
  return <HoldConfirm a={a} token={token} />;
}
