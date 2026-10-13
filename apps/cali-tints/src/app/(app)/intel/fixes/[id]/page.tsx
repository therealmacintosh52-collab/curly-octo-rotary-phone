import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FixDetailView } from "@/components/intel/fix-detail-view";
import { getFix } from "@/lib/intel/fixes-data";

export const metadata: Metadata = { title: "Fix" };

export default async function FixPage(props: PageProps<"/intel/fixes/[id]">) {
  const { id } = await props.params;
  const fix = await getFix(id);
  if (!fix) notFound();
  return <FixDetailView fix={fix} />;
}
