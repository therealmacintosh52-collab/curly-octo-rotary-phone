import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { AuditStatus } from "@/lib/db/types";

export const metadata: Metadata = { title: "Audits" };

const STATUS_VARIANT: Record<AuditStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  running: "secondary",
  succeeded: "default",
  failed: "destructive",
  cancelled: "outline",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: audits } = await supabase
    .from("audits")
    .select("id, business_id, status, progress_pct, current_step, started_at, total_cost_usd, version")
    .order("created_at", { ascending: false })
    .limit(50);

  const businessIds = [...new Set((audits ?? []).map((a) => a.business_id))];
  const { data: businesses } = businessIds.length
    ? await supabase.from("businesses").select("id, name, canonical_domain").in("id", businessIds)
    : { data: [] as { id: string; name: string; canonical_domain: string | null }[] };
  const byId = new Map((businesses ?? []).map((b) => [b.id, b]));
  const totalCost = (audits ?? []).reduce((s, a) => s + Number(a.total_cost_usd), 0);

  return (
    <Page>
      <PageHeader title="Audits" description={audits?.length ? `${audits.length} audits · ${usd.format(totalCost)} in logged API cost` : "Nothing audited yet."} />
      <div className="mt-6">
        {audits?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.map((a) => {
                const b = byId.get(a.business_id);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{b?.name ?? "—"}</div>
                      <div className="text-caption text-muted-foreground">{b?.canonical_domain ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {a.progress_pct}%{a.current_step ? <span className="text-muted-foreground"> · {a.current_step}</span> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.started_at ? new Date(a.started_at).toLocaleString("en-US") : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd.format(Number(a.total_cost_usd))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={ClipboardListIcon}
            title="No audits yet"
            description="Phase 1 adds the New audit form (website, Google Business Profile link, Yelp URL). Until then, check what is wired under Settings."
            action={
              <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/admin/settings/providers">
                Open provider settings
              </Link>
            }
          />
        )}
      </div>
    </Page>
  );
}
