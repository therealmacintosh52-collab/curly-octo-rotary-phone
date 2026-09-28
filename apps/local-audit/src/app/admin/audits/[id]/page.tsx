import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Page, PageHeader, SectionHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORY_LABELS, type CheckCategory } from "@/lib/checks/registry";
import type { AuditStatus, FindingSeverity } from "@/lib/db/types";
import { formatPhone } from "@/lib/resolve/nap";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit" };
export const dynamic = "force-dynamic";

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

function parseSource(excerpt: string): SourceExcerpt | null {
  try {
    const parsed = SourceExcerpt.safeParse(JSON.parse(excerpt));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function AuditDetailPage(props: PageProps<"/admin/audits/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: audit } = await supabase.from("audits").select("*").eq("id", id).maybeSingle();
  if (!audit) notFound();
  const [{ data: business }, { data: findings }, { data: evidence }] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", audit.business_id).single(),
    supabase.from("findings").select("*").eq("audit_id", id).order("severity").order("impact_score", { ascending: false }),
    supabase.from("evidence").select("*").eq("audit_id", id).order("captured_at"),
  ]);

  const sources = (evidence ?? []).map((e) => ({ row: e, parsed: parseSource(e.excerpt ?? "") })).filter((s) => s.parsed !== null) as { row: NonNullable<typeof evidence>[number]; parsed: SourceExcerpt }[];
  const evidenceById = new Map((evidence ?? []).map((e) => [e.id, e]));
  const inputs = (audit.inputs ?? {}) as Record<string, unknown>;
  const inputRows = [
    ["Website", inputs.website],
    ["Google Business Profile", inputs.gbp],
    ["Yelp", inputs.yelp],
    ["Other profiles", inputs.extraUrls],
    ["Service area", inputs.serviceArea],
    ["Services", inputs.services],
    ["Average ticket", inputs.avgTicket],
  ].filter(([, v]) => typeof v === "string" && v.trim()) as [string, string][];

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
              <dd>{business?.primary_category ?? "—"}</dd>
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
                    <dd className="break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No inputs recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <SectionHeader className="mt-10" title="Sources" />
      <div className="mt-4">
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
                      <Badge variant="outline">UNAVAILABLE</Badge> <span className="text-muted-foreground">{parsed.reason}: {parsed.message}</span>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell>{parsed.name ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{parsed.phone ?? "—"}</TableCell>
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

      <SectionHeader className="mt-10" title={`Findings (${findings?.length ?? 0})`} />
      <div className="mt-4 flex flex-col gap-3">
        {findings?.length ? (
          findings.map((f) => (
            <Card key={f.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Badge variant={SEVERITY_VARIANT[f.severity]}>{f.severity}</Badge>
                  <span>{f.title}</span>
                  <span className="text-caption font-normal text-muted-foreground">
                    {CATEGORY_LABELS[f.category as CheckCategory] ?? f.category} · {f.check_id} · fix: {f.fix_difficulty ?? "—"}
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
                        <li key={eid}>
                          <span className="font-mono">{e?.type ?? "evidence"}</span> · {e?.excerpt ?? eid}
                          {e?.source_url ? (
                            <>
                              {" "}
                              ·{" "}
                              <a className="underline-offset-4 hover:underline" href={e.source_url} target="_blank" rel="noreferrer">
                                source
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
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{audit.status === "succeeded" ? "No problems found by the checks that ran." : "Findings appear here as steps complete."}</p>
        )}
      </div>
    </Page>
  );
}
