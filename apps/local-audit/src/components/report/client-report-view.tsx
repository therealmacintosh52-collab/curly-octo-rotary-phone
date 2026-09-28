import type { ClientReport } from "@/lib/reports/client-report";

const STATUS_COPY: Record<string, string> = {
  queued: "Your report is queued and will start shortly.",
  running: "Your report is being prepared.",
  succeeded: "Your report is ready.",
  failed: "This report could not be completed. The agency has been notified.",
  cancelled: "This report was cancelled.",
};

/**
 * The client report shell (Phase 0/1). Phases 7–9 add scores, the revenue
 * range, the problem list, competitor and AI sections and the unlock CTAs.
 * Everything rendered here comes from get_client_report(): revealed solutions only.
 */
export function ClientReportView({ report }: { report: ClientReport }) {
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

      {report.findings.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-heading">What we found</h2>
          {report.findings.map((f) => (
            <article key={String(f.id)} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border px-2 py-0.5 text-caption uppercase tracking-wide text-muted-foreground">{String(f.severity)}</span>
                <h3 className="text-body font-semibold">{String(f.title)}</h3>
              </div>
              {typeof f.plain_english === "string" && f.plain_english ? <p className="mt-2 text-sm text-muted-foreground">{f.plain_english}</p> : null}
              <p className="mt-3 text-caption text-muted-foreground">Solution available — ask the agency to unlock it.</p>
            </article>
          ))}
        </section>
      ) : null}

      <footer className="text-xs text-muted-foreground">
        This report is private to the link it was sent with. Figures marked as estimates are ranges built from stated assumptions.
      </footer>
    </main>
  );
}
