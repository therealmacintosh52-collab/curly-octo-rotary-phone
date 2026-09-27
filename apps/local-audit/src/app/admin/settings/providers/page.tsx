import type { Metadata } from "next";
import { Page, PageHeader, SectionHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { providerStatus } from "@/lib/providers";
import { auditCostBudgetUsd } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Providers" };
export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default async function ProvidersPage() {
  const rows = providerStatus();
  const mode = rows[0]?.mode ?? "live";
  const supabase = await createClient();
  const [{ data: snapshots }, { data: audits }] = await Promise.all([
    supabase.from("raw_snapshots").select("cost_usd, provider"),
    supabase.from("audits").select("id, business_id, total_cost_usd, status").order("total_cost_usd", { ascending: false }).limit(20),
  ]);
  const total = (snapshots ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  const byProvider = new Map<string, number>();
  for (const r of snapshots ?? []) byProvider.set(r.provider, (byProvider.get(r.provider) ?? 0) + Number(r.cost_usd));

  return (
    <Page>
      <PageHeader
        title="Providers"
        eyebrow="Settings"
        description={
          <>
            Which external services are wired, and what they have cost. Mode: <Badge variant="outline">{mode}</Badge>
            {mode === "mock" ? <span className="ml-2">All adapters serve fixtures; no network calls, no spend.</span> : null}
          </>
        }
      />

      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Environment variables</TableHead>
              <TableHead>Configured</TableHead>
              <TableHead>Live from phase</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell>
                  <div className="font-medium">{r.label}</div>
                  <a className="text-caption text-muted-foreground underline-offset-4 hover:underline" href={r.docsUrl} target="_blank" rel="noreferrer">
                    {r.docsUrl}
                  </a>
                </TableCell>
                <TableCell>
                  {r.envKeys.length ? (
                    <ul className="flex flex-col gap-1">
                      {r.envKeys.map((k) => (
                        <li key={k.key} className="flex items-center gap-2 font-mono text-xs">
                          <span className={k.set ? "text-success" : "text-muted-foreground"}>{k.set ? "●" : "○"}</span>
                          {k.key}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-caption text-muted-foreground">none needed</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={r.configured ? "default" : "outline"}>{r.configured ? "yes" : "no"}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{r.phase === "0" ? "now" : r.phase}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SectionHeader className="mt-10" title="Cost meter" aside={<span className="text-sm text-muted-foreground">Budget warning at {usd.format(auditCostBudgetUsd())} per audit</span>} />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total logged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-stat tabular-nums">{usd.format(total)}</div>
            <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
              {[...byProvider.entries()].sort((a, b) => b[1] - a[1]).map(([p, c]) => (
                <li key={p} className="flex justify-between">
                  <span>{p}</span>
                  <span className="tabular-nums">{usd.format(c)}</span>
                </li>
              ))}
              {byProvider.size === 0 ? <li>No calls logged yet.</li> : null}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most expensive audits</CardTitle>
          </CardHeader>
          <CardContent>
            {audits?.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {audits.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span className="truncate font-mono text-xs text-muted-foreground">{a.id}</span>
                    <span className={`tabular-nums ${Number(a.total_cost_usd) > auditCostBudgetUsd() ? "text-warning" : ""}`}>{usd.format(Number(a.total_cost_usd))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No audits yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
