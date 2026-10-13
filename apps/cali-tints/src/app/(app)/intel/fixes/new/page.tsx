import type { Metadata } from "next";
import { FixForm } from "@/components/intel/fix-form";
import { fixFormVehicles, newFixPrefill } from "@/lib/intel/fixes-data";

export const metadata: Metadata = { title: "Write down a fix" };

/** `?vehicle=` the car, `?codes=` the codes, `?job=&finding=` from a repair order's finding. */
export default async function NewFixPage(props: PageProps<"/intel/fixes/new">) {
  const sp = await props.searchParams;
  const [vehicles, initial] = await Promise.all([fixFormVehicles(), newFixPrefill(sp)]);
  return <FixForm vehicles={vehicles} initial={initial} />;
}
