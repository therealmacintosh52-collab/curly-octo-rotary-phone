import { redirect } from "next/navigation";
import { ESTIMATE_FOR_JOB } from "@/test/retail-fixtures";

/** Fixture twin of an old invoice link: it opens the estimate that became the invoice. */
export default async function DevRetailInvoiceRedirect(props: PageProps<"/dev/preview/retail/invoice/[id]">) {
  const { id } = await props.params;
  redirect(ESTIMATE_FOR_JOB[id] ? `/retail/estimates/${ESTIMATE_FOR_JOB[id]}` : "/retail/estimates?stage=unpaid");
}
