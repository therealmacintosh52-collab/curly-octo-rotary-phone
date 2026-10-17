import { redirect } from "next/navigation";

/** Edit Mode lives on the work order page itself: the old address forwards there (keeping ?findings= from "Add to this estimate"). */
export default async function EditEstimateRedirect(props: PageProps<"/retail/estimates/[id]/edit">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const q = new URLSearchParams({ edit: "1" });
  if (typeof sp.findings === "string") q.set("findings", sp.findings);
  redirect(`/retail/estimates/${id}?${q.toString()}`);
}
