import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FixForm } from "@/components/intel/fix-form";
import { fixFormVehicles, getFix } from "@/lib/intel/fixes-data";
import { fixToInitial } from "@/lib/intel/fixes";

export const metadata: Metadata = { title: "Edit the fix" };

export default async function EditFixPage(props: PageProps<"/intel/fixes/[id]/edit">) {
  const { id } = await props.params;
  const fix = await getFix(id);
  if (!fix) notFound();
  if (!fix.can_edit) redirect(`/intel/fixes/${id}`);
  return <FixForm vehicles={await fixFormVehicles()} initial={fixToInitial(fix)} fix={fix} />;
}
