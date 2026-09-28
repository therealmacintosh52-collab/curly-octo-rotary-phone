import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientReportView } from "@/components/report/client-report-view";
import { createClient } from "@/lib/supabase/server";
import { loadClientReport } from "@/lib/reports/client-report";

export const metadata: Metadata = { title: "Your visibility report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Data comes exclusively from get_client_report() through the anon-capable client. */
export default async function ClientReportPage(props: PageProps<"/r/[token]">) {
  const { token } = await props.params;
  const supabase = await createClient();
  const report = await loadClientReport(token, async (t) => {
    const { data, error } = await supabase.rpc("get_client_report", { p_token: t });
    return { data, error };
  });
  if (!report) notFound();
  return <ClientReportView report={report} />;
}
