import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientReport } from "@/lib/reports/client-report";

export const metadata: Metadata = { title: "Your visibility report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  queued: "Your report is queued and will start shortly.",
  running: "Your report is being prepared.",
  succeeded: "Your report is ready.",
  failed: "This report could not be completed. The agency has been notified.",
  cancelled: "This report was cancelled.",
};

/**
 * The client report. Phase 0 renders the shell only; Phases 7–9 fill in
 * scores, the revenue range, the problem list and the unlock CTAs. Data comes
 * exclusively from get_client_report() through the anon-capable client.
 */
export default async function ClientReportPage(props: PageProps<"/r/[token]">) {
  const { token } = await props.params;
  const supabase = await createClient();
  const report = await loadClientReport(token, async (t) => {
    const { data, error } = await supabase.rpc("get_client_report", { p_token: t });
    return { data, error };
  });
  if (!report) notFound();

  const { audit, business, solution_counts } = report;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <p className="text-label text-subtle">Visibility &amp; revenue-leak report</p>
        <h1 className="text-title mt-1 text-balance">{business.name}</h1>
        {business.canonical_domain ? <p className="mt-1 text-sm text-muted-foreground">{business.canonical_domain}</p> : null}
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <p className="text-body">{STATUS_COPY[audit.status] ?? audit.status}</p>
        {audit.status !== "succeeded" ? (
          <p className="mt-2 text-sm text-muted-foreground">Progress: {audit.progress_pct}%</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {report.findings.length} problems found · {solution_counts.revealed} of {solution_counts.total} recommendations unlocked
          </p>
        )}
      </section>

      <footer className="text-xs text-muted-foreground">
        This report is private to the link it was sent with. Figures marked as estimates are ranges built from stated assumptions.
      </footer>
    </main>
  );
}
