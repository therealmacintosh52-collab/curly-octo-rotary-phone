import Link from "next/link";
import { AlertTriangle, Clock, DollarSign, ShieldAlert } from "lucide-react";
import type { ContextDoc, Diagnosis } from "@/lib/ai/schema";
import { SourceBadge } from "@/components/source-badge";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import { APP_NAME as APP_NAME_FALLBACK } from "@/lib/config";

export function DiagnosisView({ diagnosis, citations }: { diagnosis: Diagnosis; citations: ContextDoc[] }) {
  const byId = new Map(citations.map((c) => [c.id, c]));
  const index = new Map(citations.map((c, i) => [c.id, i + 1]));
  const Cites = ({ ids }: { ids: string[] }) =>
    ids.length ? (
      <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
        {ids.map((id) => (
          <a key={id} href={`#cite-${index.get(id)}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground" title={byId.get(id)?.title}>
            [{index.get(id)}]
          </a>
        ))}
      </span>
    ) : (
      <span className="ml-1 text-[11px] text-muted-foreground">(general reasoning, no citation)</span>
    );

  return (
    <div className="space-y-4">
      {diagnosis.safety_flags.length > 0 && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <ShieldAlert className="size-5" /> Safety systems involved
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {diagnosis.safety_flags.map((f, i) => (
              <li key={i}>
                <strong>{f.system}:</strong> {f.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-xl border border-primary/50 bg-card p-4">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessment</h2>
        <p className="text-sm leading-relaxed">{diagnosis.summary}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Probable causes</h2>
        <ol className="space-y-3">
          {diagnosis.probable_causes.map((c, i) => (
            <li key={i}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  {i + 1}. {c.cause}
                </p>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{Math.round(c.confidence)}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, c.confidence))}%` }} />
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {c.rationale}
                <Cites ids={c.citations} />
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test plan · cheapest and fastest first</h2>
        <ol className="space-y-3">
          {diagnosis.test_plan.map((t) => (
            <li key={t.step} className="rounded-lg border border-border p-3">
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{t.step}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.test}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <strong className="text-foreground">Looking for:</strong> {t.looking_for}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Rules in/out:</strong> {t.rules_in_or_out}
                    <Cites ids={t.citations} />
                  </p>
                  <p className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" /> ~{t.est_minutes} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="size-3.5" /> {t.est_cost_usd ? formatMoney(t.est_cost_usd) : "no parts"}
                    </span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {diagnosis.not_in_database.length > 0 && (
        <section className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-warning" /> Not in database — verify in OEM service information
          </p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {diagnosis.not_in_database.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources used ({citations.length})</h2>
        {citations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No database records were cited. Treat this answer as general reasoning only.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {citations.map((c, i) => (
              <li key={c.id} id={`cite-${i + 1}`} className="flex items-start gap-2">
                <span className="font-mono text-xs text-muted-foreground">[{i + 1}]</span>
                <div className="min-w-0 flex-1">
                  {c.url ? (
                    <Link href={c.url} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{c.title}</span>
                  )}
                  <span className="ml-2 inline-flex gap-1 align-middle">
                    <Badge variant="outline">{c.kind}</Badge>
                    <SourceBadge source={c.source} />
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        AI output is advisory and grounded only in {APP_NAME_FALLBACK}&apos;s database. It never includes OEM specifications. Verify every step against OEM service information.
      </p>
    </div>
  );
}


