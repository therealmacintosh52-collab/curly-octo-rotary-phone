import { redirect } from "next/navigation";

/**
 * Jobs and invoices are one thing now. Old links to the job list land on the
 * Invoices list with the closest filter.
 */
export default async function JobsRedirect(props: PageProps<"/jobs">) {
  const sp = await props.searchParams;
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v !== "string" || !v) continue;
    if (k === "status") {
      if (v === "uninvoiced") next.set("status", "draft");
      else if (v === "deleted") next.set("status", "void");
      continue; // "invoiced" / "all" → every invoice
    }
    next.set(k, v);
  }
  const qs = next.toString();
  redirect(qs ? `/invoices?${qs}` : "/invoices");
}
