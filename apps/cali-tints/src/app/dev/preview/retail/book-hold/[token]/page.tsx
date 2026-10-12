import { notFound } from "next/navigation";
import { HoldConfirm } from "@/components/retail/hold-confirm";
import { appointmentPublicFixture } from "@/test/retail-fixtures";

/** Fixture preview of the held spot (`/book/<token>` in the guest demo). */
export default async function DevHoldPreview(props: PageProps<"/dev/preview/retail/book-hold/[token]">) {
  const { token } = await props.params;
  const a = appointmentPublicFixture(token, "hold");
  if (!a) notFound();
  return <HoldConfirm a={a} token={token} demo />;
}
