import type { Metadata } from "next";
import { CodesScreen } from "@/components/intel/codes-screen";
import { loadCodesScreen } from "@/lib/intel/screens";

export const metadata: Metadata = { title: "Intel" };

/** Intel → Codes: the lookup box and the shop's recent lookups. Results render on /intel/dtc. */
export default async function IntelPage(props: PageProps<"/intel">) {
  const sp = await props.searchParams;
  return <CodesScreen data={await loadCodesScreen(sp)} />;
}
