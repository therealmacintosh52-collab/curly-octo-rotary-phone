import type { Metadata } from "next";
import { CodesScreen } from "@/components/intel/codes-screen";
import { loadCodesScreen } from "@/lib/intel/screens";

export const metadata: Metadata = { title: "Trouble codes" };

/** Intel → Codes results: `?codes=P0300,U0100&vehicle=<id>`. */
export default async function DtcPage(props: PageProps<"/intel/dtc">) {
  const sp = await props.searchParams;
  return <CodesScreen data={await loadCodesScreen(sp)} />;
}
