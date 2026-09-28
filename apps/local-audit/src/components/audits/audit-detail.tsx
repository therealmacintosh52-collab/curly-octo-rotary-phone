import Link from "next/link";
import { z } from "zod";
import { Page, PageHeader, SectionHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORY_LABELS, CHECK_CATEGORIES } from "@/lib/checks/registry";
import type { Audit, AuditStatus, Business, Evidence, Finding, FindingSeverity } from "@/lib/db/types";
import { formatPhone } from "@/lib/resolve/nap";

const pretty = {
  phone: (v: string | null | undefined) => (v && /^\+1\d{10}$/.test(v) ? formatPhone(v) : (v ?? "—")),
  category: (v: string | null | undefined) => (v ? (/^[a-z_]+$/.test(v) ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : v) : "—"),
};

const STATUS_VARIANT: Record<AuditStatus, "default" | "secondary" | "destructive" | "outline"> = { queued: "outline", running: "secondary", succeeded: "default", failed: "destructive", cancelled: "outline" };
const SEVERITY_VARIANT: Record<FindingSeverity, "default" | "secondary" | "destructive" | "outline"> = { critical: "destructive", high: "destructive", medium: "secondary", low: "outline" };
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Shape of the JSON the resolver writes into source evidence excerpts. */
const SourceExcerpt = z.looseObject({
  source: z.enum(["website", "gbp", "yelp"]),
  status: z.string().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  place_id: z.string().nullable().optional(),
  alias: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  review_count: z.number().nullable().optional(),
  is_claimed: z.boolean().nullable().optional(),
  matched_by: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  pages: z.array(z.string()).optional(),
});
type SourceExcerpt = z.infer<typeof SourceExcerpt>;

const SOURCE_LABEL: Record<SourceExcerpt["source"], string> = { website: "Website", gbp: "Google Business Profile", yelp: "Yelp" };

/** Shape of what the pipeline steps merge into `audits.scores`. Everything optional: older audits and partial runs must still render. */
const PsiSummary = z.looseObject({
  status: z.string(),
  reason: z.string().optional(),
  message: z.string().optional(),
  performanceScore: z.number().nullable().optional(),
  lab: z.looseObject({ lcpMs: z.number().nullable().optional(), clsScore: z.number().nullable().optional(), ttfbMs: z.number().nullable().optional(), tbtMs: z.number().nullable().optional() }).optional(),
  field: z.looseObject({ lcpMs: z.number().nullable().optional(), inpMs: z.number().nullable().optional(), cls: z.number().nullable().optional(), ttfbMs: z.number().nullable().optional(), overall: z.string().nullable().optional() }).optional(),
});
const ScoresJson = z.looseObject({
  visibility: z.number().nullable().optional(),
  conversion: z.number().nullable().optional(),
  categories: z.record(z.string(), z.number().nullable()).optional(),
  assessed: z.array(z.string()).optional(),
  crawl: z
    .looseObject({
      status: z.string(),
      reason: z.string().optional(),
      canonical_url: z.string().optional(),
      https: z.boolean().optional(),
      pages_crawled: z.number().optional(),
      pages_discovered: z.number().optional(),
      truncated: z.boolean().optional(),
      failures: z.number().optional(),
      blocked: z.number().optional(),
      robots: z.string().optional(),
      ai_agents_blocked: z.array(z.string()).optional(),
      sitemap: z.string().optional(),
      sitemap_urls: z.number().optional(),
      llms_txt: z.string().optional(),
      soft_404: z.boolean().nullable().optional(),
      broken_links: z.number().optional(),
      pages: z.array(z.looseObject({ url: z.string(), kind: z.string(), status: z.number().nullable().optional(), title: z.string().nullable().optional(), words: z.number().optional() })).optional(),
    })
    .optional(),
  pagespeed: z.looseObject({ mobile: PsiSummary.optional(), desktop: PsiSummary.optional() }).optional(),
  checks_website: z.looseObject({ passed: z.array(z.string()).optional(), unavailable: z.array(z.looseObject({ check_id: z.string(), reason: z.string() })).optional() }).optional(),
});
type ScoresJson = z.infer<typeof ScoresJson>;

function parseScores(v: unknown): ScoresJson {
  const r = ScoresJson.safeParse(v);
  return r.success ? r.data : {};
}

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low"];
const shortUrl = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname === "/" && !x.search ? x.host : x.pathname + x.search;
  } catch {
    return u;
  }
};
const ms = (v: number | null | undefined) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
function scoreTone(n: number | null | undefined) {
  if (n == null) return "text-muted-foreground";
  return n >= 80 ? "text-emerald-600 dark:text-emerald-400" : n >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 truncate text-muted-foreground sm:w-56" title={label}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
        {value != null ? <div className={`h-full rounded ${value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${value}%` }} /> : null}
      </div>
      <span className={`w-16 shrink-0 whitespace-nowrap text-right tabular-nums ${scoreTone(value)}`} title={value == null ? "not assessed yet" : undefined}>
        {value == null ? "n/a" : `${value}/100`}
      </span>
    </div>
  );
}

function PsiCell({ label, psi }: { label: string; psi: z.infer<typeof PsiSummary> | undefined }) {
  if (!psi) return <p className="text-sm text-muted-foreground">{label}: not run</p>;
  if (psi.status !== "ok")
    return (
      <p className="text-sm">
        <span className="font-medium">{label}</span> <Badge variant="outline">UNAVAILABLE</Badge> <span className="text-muted-foreground">{psi.reason}: {psi.message}</span>
      </p>
    );
  return (
    <div className="text-sm">
      <div className="flex items-baseline gap-2">
        <span className="font-medium">{label}</span>
        <span className={`text-2xl font-semibold tabular-nums ${scoreTone(psi.performanceScore)}`}>{psi.performanceScore ?? "—"}</span>
        <span className="text-muted-foreground">/100 performance</span>
      </div>
      <dl className="mt-1 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-0.5 text-caption text-muted-foreground">
        <dt>LCP</dt>
        <dd className="tabular-nums">
          {ms(psi.field?.lcpMs)} field · {ms(psi.lab?.lcpMs)} lab
        </dd>
        <dt>INP</dt>
        <dd className="tabular-nums">{psi.field?.inpMs != null ? `${psi.field.inpMs} ms field` : "no field data"}</dd>
        <dt>CLS</dt>
        <dd className="tabular-nums">
          {psi.field?.cls ?? "—"} field · {psi.lab?.clsScore != null ? psi.lab.clsScore.toFixed(3) : "—"} lab
        </dd>
        <dt>TTFB</dt>
        <dd className="tabular-nums">
          {ms(psi.field?.ttfbMs)} field · {ms(psi.lab?.ttfbMs)} lab
        </dd>
      </dl>
    </div>
  );
}

function parseSource(excerpt: string): SourceExcerpt | null {
  try {
    const parsed = SourceExcerpt.safeParse(JSON.parse(excerpt));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface AuditDetailProps {
  audit: Audit;
  business: Business | null;
  findings: Finding[];
  evidence: Evidence[];
}

/** The audit page body. Pure presentation: the route fetches, the preview feeds fixtures. */
export function AuditDetail({ audit, business, findings, evidence }: AuditDetailProps) {
  const sources = evidence.map((e) => ({ row: e, parsed: parseSource(e.excerpt ?? "") })).filter((s): s is { row: Evidence; parsed: SourceExcerpt } => s.parsed !== null);
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const scores = parseScores(audit.scores);
  const crawl = scores.crawl;
  const assessed = new Set(scores.assessed ?? []);
  const byCategory = CHECK_CATEGORIES.map((c) => ({ category: c, items: findings.filter((f) => f.category === c).sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || (b.impact_score ?? 0) - (a.impact_score ?? 0)) })).filter((g) => g.items.length);
  const severityCounts = SEVERITY_ORDER.map((sev) => [sev, findings.filter((f) => f.severity === sev).length] as const).filter(([, n]) => n);
  const inputs = (audit.inputs ?? {}) as Record<string, unknown>;
  const inputRows = [
    ["Website", inputs.website],
    ["Google Business Profile", inputs.gbp],
    ["Yelp", inputs.yelp],
    ["Other profiles", inputs.extraUrls],
    ["Service area", inputs.serviceArea],
    ["Services", inputs.services],
    ["Average ticket", inputs.avgTicket],
  ].filter(([, v]) => (typeof v === "string" && v.trim()) || typeof v === "number") as [string, string | number][];

  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:underline">
            ← Audits
          </Link>
        }
        title={business?.name ?? "Audit"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[audit.status]}>{audit.status}</Badge>
            <span>{audit.progress_pct}%</span>
            {audit.current_step ? <span>· {audit.current_step}</span> : null}
            <span>· {usd.format(Number(audit.total_cost_usd))} API cost</span>
            <span>· v{audit.version}</span>
          </span>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resolved business</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{business?.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Domain</dt>
              <dd>{business?.canonical_domain ?? "—"}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{business?.phone ? formatPhone(business.phone) : "—"}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd>{business?.address ?? "—"}</dd>
              <dt className="text-muted-foreground">Category</dt>
              <dd>{pretty.category(business?.primary_category)}</dd>
              <dt className="text-muted-foreground">Place id</dt>
              <dd className="font-mono text-xs">{business?.place_id ?? "—"}</dd>
              <dt className="text-muted-foreground">Yelp alias</dt>
              <dd className="font-mono text-xs">{business?.yelp_alias ?? "—"}</dd>
              <dt className="text-muted-foreground">Coordinates</dt>
              <dd className="tabular-nums">{business?.lat != null && business?.lng != null ? `${business.lat.toFixed(5)}, ${business.lng.toFixed(5)}` : "—"}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent>
            {inputRows.length ? (
              <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
                {inputRows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-all">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No inputs recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {scores.visibility != null || scores.conversion != null || crawl ? (
        <>
          <SectionHeader className="mt-10" title="Scores" aside={<span className="text-caption text-muted-foreground">from {findings.length} findings across {assessed.size} assessed categories</span>} />
          <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_1fr]">
            <Card>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div>
                  <p className="text-caption text-muted-foreground">Visibility</p>
                  <p className={`text-4xl font-semibold tabular-nums ${scoreTone(scores.visibility)}`}>{scores.visibility ?? "—"}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Conversion</p>
                  <p className={`text-4xl font-semibold tabular-nums ${scoreTone(scores.conversion)}`}>{scores.conversion ?? "—"}</p>
                </div>
                <p className="text-caption text-muted-foreground">n/a = not assessed yet; those categories count as neither 0 nor 100.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                {CHECK_CATEGORIES.map((c) => (
                  <ScoreBar key={c} label={CATEGORY_LABELS[c]} value={scores.categories?.[c] ?? null} />
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {crawl ? (
        <>
          <SectionHeader className="mt-10" title="Website crawl" aside={crawl.canonical_url ? <span className="text-caption text-muted-foreground">{crawl.canonical_url}</span> : null} />
          {crawl.status !== "ok" ? (
            <p className="mt-4 text-sm text-muted-foreground">
              <Badge variant="outline">{crawl.status.toUpperCase()}</Badge> {crawl.reason}
            </p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Crawl</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-[11rem_1fr] gap-y-1.5 text-sm">
                    <dt className="text-muted-foreground">Pages fetched</dt>
                    <dd className="tabular-nums">
                      {crawl.pages_crawled ?? 0} of {crawl.pages_discovered ?? 0} discovered{crawl.truncated ? " (capped)" : ""}
                      {crawl.failures ? ` · ${crawl.failures} failed${crawl.blocked ? `, ${crawl.blocked} blocked` : ""}` : ""}
                    </dd>
                    <dt className="text-muted-foreground">HTTPS</dt>
                    <dd>{crawl.https ? "yes" : "no"}</dd>
                    <dt className="text-muted-foreground">robots.txt</dt>
                    <dd>
                      {crawl.robots}
                      {crawl.ai_agents_blocked?.length ? ` · blocks ${crawl.ai_agents_blocked.join(", ")}` : ""}
                    </dd>
                    <dt className="text-muted-foreground">Sitemap</dt>
                    <dd>
                      {crawl.sitemap}
                      {crawl.sitemap_urls ? ` · ${crawl.sitemap_urls} URLs` : ""}
                    </dd>
                    <dt className="text-muted-foreground">llms.txt</dt>
                    <dd>{crawl.llms_txt}</dd>
                    <dt className="text-muted-foreground">Missing pages</dt>
                    <dd>{crawl.soft_404 === null || crawl.soft_404 === undefined ? "not probed" : crawl.soft_404 ? "return 200 (soft 404)" : "return 404"}</dd>
                    <dt className="text-muted-foreground">Broken links</dt>
                    <dd className="tabular-nums">{crawl.broken_links ?? 0}</dd>
                  </dl>
                  {crawl.pages?.length ? (
                    <details className="mt-3 text-caption">
                      <summary className="cursor-pointer text-muted-foreground">Pages ({crawl.pages.length})</summary>
                      <ul className="mt-2 flex flex-col gap-0.5">
                        {crawl.pages.map((p) => (
                          <li key={p.url} className="flex gap-2">
                            <span className="w-16 shrink-0 text-muted-foreground">{p.kind}</span>
                            <span className="truncate" title={p.url}>
                              {p.title || p.url}
                            </span>
                            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{p.words ?? 0} w</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>PageSpeed Insights</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <PsiCell label="Mobile" psi={scores.pagespeed?.mobile} />
                  <PsiCell label="Desktop" psi={scores.pagespeed?.desktop} />
                  {scores.checks_website ? (
                    <p className="text-caption text-muted-foreground">
                      {scores.checks_website.passed?.length ?? 0} website checks passed · {scores.checks_website.unavailable?.length ?? 0} could not be judged
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : null}

      <SectionHeader className="mt-10" title="Sources" />
      <div className="mt-4 flex flex-col gap-3 md:hidden">
        {sources.map(({ row, parsed }) => (
          <Card key={row.id}>
            <CardContent className="pt-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium">{SOURCE_LABEL[parsed.source]}</span>
                {parsed.status === "UNAVAILABLE" ? <Badge variant="outline">UNAVAILABLE</Badge> : parsed.matched_by ? <span className="text-caption text-muted-foreground">score {parsed.confidence}</span> : null}
              </div>
              {parsed.status === "UNAVAILABLE" ? (
                <p className="text-sm text-muted-foreground">
                  {parsed.reason}: {parsed.message}
                </p>
              ) : (
                <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{parsed.name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="tabular-nums">{pretty.phone(parsed.phone)}</dd>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd>{parsed.address ?? "—"}</dd>
                  {parsed.website ? (
                    <>
                      <dt className="text-muted-foreground">Site</dt>
                      <dd className="break-all">{parsed.website}</dd>
                    </>
                  ) : null}
                  {parsed.rating != null ? (
                    <>
                      <dt className="text-muted-foreground">Rating</dt>
                      <dd>
                        {parsed.rating} ★ · {parsed.review_count ?? 0} reviews
                      </dd>
                    </>
                  ) : null}
                </dl>
              )}
            </CardContent>
          </Card>
        ))}
        {!sources.length ? <p className="text-sm text-muted-foreground">{audit.status === "succeeded" ? "No sources were recorded." : "Sources appear here once the resolve step has run."}</p> : null}
      </div>
      <div className="mt-4 hidden md:block">
        {sources.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map(({ row, parsed }) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{SOURCE_LABEL[parsed.source]}</TableCell>
                  {parsed.status === "UNAVAILABLE" ? (
                    <TableCell colSpan={4}>
                      <Badge variant="outline">UNAVAILABLE</Badge>{" "}
                      <span className="text-muted-foreground">
                        {parsed.reason}: {parsed.message}
                      </span>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell>{parsed.name ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{pretty.phone(parsed.phone)}</TableCell>
                      <TableCell>{parsed.address ?? "—"}</TableCell>
                      <TableCell className="text-caption text-muted-foreground">
                        {parsed.website ? <div>site: {parsed.website}</div> : null}
                        {parsed.rating != null ? (
                          <div>
                            {parsed.rating} ★ · {parsed.review_count ?? 0} reviews{parsed.is_claimed === false ? " · unclaimed" : ""}
                          </div>
                        ) : null}
                        {parsed.matched_by ? (
                          <div>
                            matched by {parsed.matched_by} (score {parsed.confidence})
                          </div>
                        ) : null}
                        {row.source_url ? (
                          <a className="underline-offset-4 hover:underline" href={row.source_url} target="_blank" rel="noreferrer">
                            open
                          </a>
                        ) : null}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{audit.status === "succeeded" ? "No sources were recorded." : "Sources appear here once the resolve step has run."}</p>
        )}
      </div>

      <SectionHeader
        className="mt-10"
        title={`Findings (${findings.length})`}
        aside={
          severityCounts.length ? (
            <span className="flex flex-wrap gap-1">
              {severityCounts.map(([sev, n]) => (
                <Badge key={sev} variant={SEVERITY_VARIANT[sev]}>
                  {n} {sev}
                </Badge>
              ))}
            </span>
          ) : null
        }
      />
      {byCategory.length ? (
        byCategory.map((group) => (
          <section key={group.category} className="mt-6">
            <h3 className="mb-3 flex items-baseline gap-2 text-base font-semibold">
              {CATEGORY_LABELS[group.category]}
              <span className="text-caption font-normal text-muted-foreground">
                {group.items.length} finding{group.items.length === 1 ? "" : "s"}
                {scores.categories?.[group.category] != null ? ` · score ${scores.categories[group.category]}/100` : ""}
              </span>
            </h3>
            <div className="flex flex-col gap-3">
              {group.items.map((f) => (
                <Card key={f.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[f.severity]}>{f.severity}</Badge>
                      <span>{f.title}</span>
                      <span className="text-caption font-normal text-muted-foreground">
                        {f.check_id} · impact {f.impact_score} · fix: {f.fix_difficulty ?? "—"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{f.plain_english}</p>
                    {f.evidence_ids.length ? (
                      <ul className="mt-3 flex flex-col gap-1 text-caption text-muted-foreground">
                        {f.evidence_ids.map((eid) => {
                          const e = evidenceById.get(eid);
                          return (
                            <li key={eid} className="break-words">
                              <span className="font-mono">{e?.type ?? "evidence"}</span> · {e?.excerpt ?? eid}
                              {e?.source_url ? (
                                <>
                                  {" "}
                                  ·{" "}
                                  <a className="underline-offset-4 hover:underline" href={e.source_url} target="_blank" rel="noreferrer" title={e.source_url}>
                                    {shortUrl(e.source_url)}
                                  </a>
                                </>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{audit.status === "succeeded" ? "No problems found by the checks that ran." : "Findings appear here as steps complete."}</p>
      )}
    </Page>
  );
}
