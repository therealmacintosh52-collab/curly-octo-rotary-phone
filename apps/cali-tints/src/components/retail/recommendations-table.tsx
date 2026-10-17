"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, StickyNoteIcon, ThumbsDownIcon } from "lucide-react";
import type { EstimateOptionView, EstimateView } from "@/lib/db/types";
import { jobsFromView } from "@/lib/retail/job-model";
import { optionTotals, type SuppliesPolicy } from "@/lib/retail/quote";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type ApprovePreset = { lineIds: string[]; method: "in_person" | "phone" | "email"; declinedTitles: string[] };

const PRIORITY = { safety: "Safety", soon: "Due soon", optional: "Optional" } as const;

/**
 * The estimate's jobs as a list of recommendations the advisor takes through approval together:
 * tick the ones the customer said yes to, then approve them in person (they sign), by phone or by email.
 * What is not ticked is recorded as declined and stays on the record. Ticking everything and declining
 * declines the whole estimate. Nothing here is new to the database: it is the same approval, per line.
 */
export function RecommendationsTable({ e, option, onApprove, onDeclineAll }: { e: EstimateView; option: EstimateOptionView; onApprove: (p: ApprovePreset) => void; onDeclineAll: () => void }) {
  const jobs = useMemo(() => jobsFromView(option, { accepted: false, showMoney: true }).filter((j) => j.lines.length > 0), [option]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(jobs.map((j) => j.key)));
  if (jobs.length === 0) return null;

  const rows = jobs.map((j) => {
    const total = j.lines.reduce((s, l) => s + (l.total ?? 0), 0);
    const hours = j.lines.reduce((s, l) => s + (l.type === "labor" ? (l.hours ?? 0) : 0), 0);
    const ids = new Set(j.lines.map((l) => l.key));
    const notes = (e.findings ?? []).filter((f) => option.lines.some((l) => ids.has(l.id) && l.finding_id === f.id)).length;
    return { j, total, hours, notes, ids };
  });
  const sel = rows.filter((r) => picked.has(r.j.key));
  const rest = rows.filter((r) => !picked.has(r.j.key));
  const tot = (rs: typeof rows) => {
    const lines = option.lines.filter((l) => rs.some((r) => r.ids.has(l.id)));
    return optionTotals(lines.map((l) => ({ line_type: l.line_type ?? "service", line_total: l.line_total ?? 0, taxable: l.taxable, duration_minutes: l.duration_minutes, qty: l.qty })), e.tax_rate ?? 0, (e.policy ?? null) as SuppliesPolicy | null);
  };
  const selTotal = tot(sel);
  const selHours = sel.reduce((s, r) => s + r.hours, 0);
  const allPicked = rest.length === 0;
  const idsOf = (rs: typeof rows) => rs.flatMap((r) => [...r.ids]);
  const toggle = (k: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(k); else n.delete(k); return n; });

  function approve(method: ApprovePreset["method"]) {
    onApprove({ lineIds: idsOf(sel), method, declinedTitles: rest.map((r) => r.j.title) });
  }
  function declineSelected() {
    if (allPicked) return onDeclineAll();
    // declining some = approving the rest
    onApprove({ lineIds: idsOf(rest), method: "in_person", declinedTitles: sel.map((r) => r.j.title) });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card surface-raised" data-testid="recommendations">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2.5">
        <h2 className="text-base font-semibold">Recommendations ({rows.length})</h2>
        <span className="text-base font-semibold tabular-nums">{formatMoney(rows.reduce((s, r) => s + r.total, 0))}</span>
      </header>
      <ul className="divide-y divide-border text-sm" data-testid="recommendation-rows">
        {rows.map(({ j, total, notes }) => (
          <li key={j.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[auto_6.5rem_minmax(0,1fr)_3rem_6rem_9rem]" data-testid="recommendation-row">
            <Checkbox checked={picked.has(j.key)} onCheckedChange={(v) => toggle(j.key, v === true)} aria-label={`Select ${j.title}`} data-testid="recommendation-check" />
            <div className="hidden sm:block">{j.kind === "diagnosis" ? <Badge variant="muted">Diagnosis</Badge> : <Badge variant={j.priority === "safety" ? "destructive" : j.priority === "soon" ? "warning" : "muted"}>{PRIORITY[j.priority]}</Badge>}</div>
            <div className="min-w-0">
              <div className="font-medium">{j.title}</div>
              <div className="text-caption text-subtle">{formatDate(e.created_at)}{j.kind !== "diagnosis" && <span className="sm:hidden"> · {PRIORITY[j.priority]}</span>}</div>
            </div>
            <span className="hidden justify-self-center sm:block">{notes > 0 && <span className="inline-flex items-center gap-1 text-caption text-subtle"><StickyNoteIcon className="size-3.5" />{notes}</span>}</span>
            <span className="text-right font-semibold tabular-nums">{formatMoney(total)}</span>
            <span className="hidden text-caption text-muted-foreground sm:block">● {j.status === "declined" ? "Declined" : "Pending approval"}</span>
          </li>
        ))}
      </ul>
      <div className="bg-[#2b2f33] px-3 py-2 text-white" data-testid="recommendation-selection">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm">
          <span className="font-semibold">Selection</span>
          <span>
            <span data-testid="selection-count">{sel.length} {sel.length === 1 ? "recommendation" : "recommendations"}</span> · <span className="tabular-nums" data-testid="selection-subtotal">{formatMoney(sel.reduce((s, r) => s + r.total, 0))}</span> ({Math.round(selHours * 100) / 100} Hr) · <span className="tabular-nums" data-testid="selection-total">{formatMoney(selTotal.total)}</span> with tax and supplies
          </span>
        </div>
        <div className="mt-1 text-caption text-white/60">Current grand total $0.00 (nothing approved yet) · grand total with these <span className="tabular-nums">{formatMoney(selTotal.total)}</span></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5">
        <span className="text-sm font-medium text-muted-foreground">Bulk actions</span>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={sel.length === 0} data-testid="bulk-approve">
                <CheckIcon /> Approve selected <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => approve("in_person")} data-testid="bulk-approve-in-person">Approve selected in person</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => approve("phone")} data-testid="bulk-approve-phone">Approve selected by phone</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => approve("email")} data-testid="bulk-approve-email">Approve selected by email</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" disabled={sel.length === 0} onClick={declineSelected} data-testid="bulk-decline" className={cn("text-destructive")}>
            <ThumbsDownIcon /> Decline selected
          </Button>
        </div>
      </div>
    </section>
  );
}
