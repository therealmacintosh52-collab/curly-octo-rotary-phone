import { z } from "zod";
import type { ClientReport } from "@/lib/reports/client-report";
import { REPORT_SECTIONS, SECTION_STATUS_COPY, SEVERITY_WORD, scoreWord, sectionStatus, type SectionStatus } from "@/lib/reports/customer-language";
import type { CheckCategory } from "@/lib/checks/registry";
import type { FindingSeverity } from "@/lib/db/types";

const STATUS_COPY: Record<string, string> = {
  queued: "Your report is queued and will start shortly.",
  running: "Your report is being prepared.",
  succeeded: "Your report is ready.",
  failed: "This report could not be completed. The agency has been notified.",
  cancelled: "This report was cancelled.",
};

/** Only the fields the customer view needs; everything else in the RPC row is ignored. */
const FindingRow = z.looseObject({
  id: z.string(),
  category: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string(),
  plain_english: z.string().nullable().optional(),
  evidence_ids: z.array(z.string()).optional(),
});
const EvidenceRow = z.looseObject({ id: z.string(), type: z.string().optional(), excerpt: z.string().nullable().optional(), source_url: z.string().nullable().optional() });
const ScoresRow = z.looseObject({ visibility: z.number().nullable().optional(), conversion: z.number().nullable().optional(), assessed: z.array(z.string()).optional() });

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low"];
const SEVERITY_CLASS: Record<FindingSeverity, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  high: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  low: "border-border bg-muted text-muted-foreground",
};
const STATUS_CLASS: Record<SectionStatus, string> = {
  urgent: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  attention: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  not_checked: "border-border bg-muted text-muted-foreground",
};
const scoreClass = (n: number | null | undefined) => (n == null ? "text-muted-foreground" : n >= 80 ? "text-emerald-600 dark:text-emerald-400" : n >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400");

function shortUrl(u: string) {
  try {
    const x = new URL(u);
    return x.pathname === "/" && !x.search ? x.host : x.pathname + x.search;
  } catch {
    return u;
  }
}

/**
 * The customer report. Written for a business owner: three questions, plain
 * ratings, problems in everyday words, proof folded away, and fixes shown only
 * when the agency has unlocked them. Everything here comes from
 * get_client_report(); nothing is fetched anywhere else.
 */
export function ClientReportView({ report }: { report: ClientReport }) {
  const { audit, business, solution_counts } = report;
  const findings = report.findings.map((r) => FindingRow.safeParse(r)).flatMap((p) => (p.success ? [p.data] : []));
  const evidence = new Map(report.evidence.map((r) => EvidenceRow.safeParse(r)).flatMap((p) => (p.success ? [[p.data.id, p.data] as const] : [])));
  const solutionsByFinding = new Map(report.solutions.map((s) => [s.finding_id, s]));
  const scores = ScoresRow.safeParse(audit.scores ?? {});
  const visibility = scores.success ? (scores.data.visibility ?? null) : null;
  const conversion = scores.success ? (scores.data.conversion ?? null) : null;
  const assessed = new Set(scores.success ? (scores.data.assessed ?? []) : []);

  const urgent = findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
  const sections = REPORT_SECTIONS.map((s) => {
    const items = findings.filter((f) => s.categories.includes(f.category as CheckCategory)).sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    return { ...s, items, status: sectionStatus(items, s.categories.some((c) => assessed.has(c))) };
  });
  const finished = audit.finished_at ? new Date(audit.finished_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header>
        <p className="text-label text-subtle">Your online visibility check-up</p>
        <h1 className="text-title mt-1 text-balance">{business.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[business.canonical_domain, finished ? `checked ${finished}` : null].filter(Boolean).join(" · ")}
        </p>
      </header>

      {audit.status !== "succeeded" ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-body">{STATUS_COPY[audit.status] ?? audit.status}</p>
          <p className="mt-2 text-sm text-muted-foreground">Progress: {audit.progress_pct}%</p>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-heading">The short version</h2>
            <p className="text-body mt-2">
              {findings.length === 0
                ? "We checked how you show up online and how your website handles visitors. We did not find anything holding you back."
                : urgent
                  ? `We found ${findings.length} things holding your business back online. ${urgent} of them are costing you customers right now.`
                  : `We found ${findings.length} things that could be better. None of them is urgent, but together they add up.`}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ScoreTile label="How easy you are to find" score={visibility} hint="Google, Google Maps and AI assistants" />
              <ScoreTile label="How well your site turns visitors into calls" score={conversion} hint="Especially on a phone" />
            </div>
            <p className="mt-4 text-caption text-muted-foreground">Scores run from 0 to 100. Above 80 is strong; below 50 means people are choosing someone else.</p>
          </section>

          <nav aria-label="Sections" className="grid gap-3 sm:grid-cols-3">
            {sections.map((s) => (
              <a key={s.key} href={`#${s.key}`} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent">
                <p className="text-sm font-semibold">{s.title}</p>
                <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-caption font-medium ${STATUS_CLASS[s.status]}`}>{SECTION_STATUS_COPY[s.status]}</span>
                <p className="mt-2 text-caption text-muted-foreground">{s.items.length === 0 ? (s.status === "not_checked" ? "Coming in a later check" : "Nothing found") : `${s.items.length} thing${s.items.length === 1 ? "" : "s"} to look at`}</p>
              </a>
            ))}
          </nav>

          {sections.map((s) => (
            <section key={s.key} id={s.key} className="scroll-mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-heading">{s.title}</h2>
                <span className={`rounded-full border px-2.5 py-0.5 text-caption font-medium ${STATUS_CLASS[s.status]}`}>{SECTION_STATUS_COPY[s.status]}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              <div className="mt-4 flex flex-col gap-3">
                {s.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{s.status === "not_checked" ? "We have not checked this part yet. It will appear here when we do." : "Nothing here needs your attention."}</p>
                ) : (
                  s.items.map((f) => {
                    const solution = solutionsByFinding.get(f.id);
                    const steps = Array.isArray(solution?.steps) ? (solution!.steps as unknown[]).filter((x): x is string => typeof x === "string") : [];
                    const proof = (f.evidence_ids ?? []).map((id) => evidence.get(id)).filter((e): e is NonNullable<typeof e> => !!e && !!e.excerpt);
                    return (
                      <article key={f.id} className="rounded-xl border border-border bg-card p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-caption font-medium ${SEVERITY_CLASS[f.severity]}`}>{SEVERITY_WORD[f.severity]}</span>
                          <h3 className="text-body font-semibold">{f.title}</h3>
                        </div>
                        {f.plain_english ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.plain_english}</p> : null}
                        {proof.length ? (
                          <details className="mt-3 text-caption">
                            <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline">What we saw</summary>
                            <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                              {proof.slice(0, 6).map((e) => (
                                <li key={e.id} className="break-words">
                                  {e.excerpt}
                                  {e.source_url ? (
                                    <>
                                      {" "}
                                      ·{" "}
                                      <a className="underline-offset-4 hover:underline" href={e.source_url} target="_blank" rel="noreferrer">
                                        {shortUrl(e.source_url)}
                                      </a>
                                    </>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                        <div className="mt-4 rounded-lg border border-border bg-background p-3 text-sm">
                          {steps.length ? (
                            <>
                              <p className="font-medium">How to fix it</p>
                              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                                {steps.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                              {solution?.time_estimate_hrs != null ? <p className="mt-2 text-caption text-muted-foreground">About {solution.time_estimate_hrs} hour{solution.time_estimate_hrs === 1 ? "" : "s"} of work.</p> : null}
                            </>
                          ) : (
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">How to fix it:</span> the step-by-step fix is ready in your action plan. Ask us to unlock it.
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ))}

          <section className="rounded-xl border border-border bg-card p-5 text-sm">
            <p className="font-medium">What happens next</p>
            <p className="mt-1 text-muted-foreground">
              {solution_counts.total
                ? `${solution_counts.revealed} of ${solution_counts.total} fixes are unlocked in this report. The rest are ready; we go through them with you in order of what brings customers back fastest.`
                : "We are preparing the fixes for each item above and will walk you through them in order of what brings customers back fastest."}
            </p>
          </section>
        </>
      )}

      <footer className="text-xs text-muted-foreground">This report is private to the link it was sent with. Anything we could not measure is left out rather than guessed.</footer>
    </main>
  );
}

function ScoreTile({ label, score, hint }: { label: string; score: number | null; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-stat tabular-nums ${scoreClass(score)}`}>{score ?? "—"}</span>
        {score != null ? <span className="text-sm text-muted-foreground">/ 100</span> : null}
        <span className={`ml-auto text-sm font-medium ${scoreClass(score)}`}>{scoreWord(score)}</span>
      </div>
      <p className="mt-1 text-caption text-muted-foreground">{hint}</p>
    </div>
  );
}
