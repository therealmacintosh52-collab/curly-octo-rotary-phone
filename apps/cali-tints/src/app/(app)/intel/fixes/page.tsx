import type { Metadata } from "next";
import { FixesScreen } from "@/components/intel/fixes-screen";
import { listFixes } from "@/lib/intel/fixes-data";

export const metadata: Metadata = { title: "Fixes" };

/** Intel → Fixes: `?q=` words, `?codes=` codes, `?mine=1`. */
export default async function FixesPage(props: PageProps<"/intel/fixes">) {
  const sp = await props.searchParams;
  const fixes = await listFixes(sp);
  return <FixesScreen fixes={fixes} q={typeof sp.q === "string" ? sp.q : ""} codes={typeof sp.codes === "string" ? sp.codes : ""} mine={sp.mine === "1"} />;
}
