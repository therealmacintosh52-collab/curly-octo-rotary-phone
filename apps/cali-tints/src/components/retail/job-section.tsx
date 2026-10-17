"use client";

import { useState } from "react";
import { BookmarkPlusIcon, ChevronDownIcon, DollarSignIcon, EllipsisVerticalIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import type { EstimateJobPriority, InventoryItem } from "@/lib/db/types";
import { bucketOf, gpLabel, jobFinancials, type BucketFigures, type JobBucket, type JobLine, type JobModel } from "@/lib/retail/job-financials";
import { stockLabel } from "@/lib/retail/inventory";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { LineTech } from "./line-tech";

const PRIORITY_LABEL: Record<EstimateJobPriority, string> = { safety: "Safety", soon: "Due soon", optional: "Optional" };
const money = (n: number | null | undefined) => (n === null || n === undefined ? "" : formatMoney(n));

const TABLES: { bucket: JobBucket; title: string; cols: string; heads: string[] }[] = [
  { bucket: "labor", title: "Labor", cols: "sm:grid-cols-[minmax(0,1fr)_10rem_4.5rem_6rem]", heads: ["", "Tech", "Hours", "Total"] },
  { bucket: "parts", title: "Parts", cols: "sm:grid-cols-[minmax(0,1fr)_7rem_3.5rem_6rem_6rem]", heads: ["", "Part #", "Qty", "Sell price", "Total"] },
  { bucket: "fees", title: "Hazmats and fees", cols: "sm:grid-cols-[minmax(0,1fr)_3.5rem_6rem_6rem]", heads: ["", "Qty", "Fee", "Total"] },
  { bucket: "sublet", title: "Sublet", cols: "sm:grid-cols-[minmax(0,1fr)_10rem_6rem]", heads: ["", "Vendor", "Total"] },
];

/**
 * One job on the work order, laid out like the shop's own screens: a grey header, tables for Labor,
 * Parts, Hazmats and fees and Sublet (each with an inline add row while the estimate is being written),
 * and a dark totals bar with the profit per table for the people who may see cost. Read-only after
 * the customer approves; extra work is a new estimate.
 */
export function JobSection({ index, job, estimateId, showMoney, editable, technicians, canAssignTech, onTitle, onPriority, onOpenLine, onRemoveLine, onTech, onRemoveJob, onSaveCanned, onQuickAdd, onSearchStock, onPickStock, extra }: {
  index: number;
  job: JobModel;
  estimateId: string | null;
  showMoney: boolean;
  editable: boolean;
  technicians: { id: string; name: string; initials: string }[];
  /** Labor lines get a tech picker on an approved work order too (the advisor assigns the work). */
  canAssignTech?: boolean;
  onTitle?: (t: string) => void;
  onPriority?: (p: EstimateJobPriority) => void;
  onOpenLine?: (lineKey: string) => void;
  onRemoveLine?: (lineKey: string) => void;
  onTech?: (lineKey: string, techId: string) => void;
  onRemoveJob?: () => void;
  onSaveCanned?: () => void;
  /** The inline add rows: labor (name + hours), part (a typed name opens the dialog), fee and sublet (name + amount). */
  onQuickAdd?: (type: "labor" | "part" | "fee" | "sublet", v: { label: string; hours?: number; price?: number }) => void;
  onSearchStock?: (q: string) => Promise<InventoryItem[]>;
  onPickStock?: (i: InventoryItem) => void;
  /** Extra content under the tables (inspections, comments). */
  extra?: React.ReactNode;
}) {
  const fin = jobFinancials(job.lines);
  const [financials, setFinancials] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card surface-raised" data-testid="job-card" data-priority={job.priority} data-job={job.title}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-3 py-2.5" data-testid="line-section">
        <span className="text-base font-semibold text-muted-foreground">{index}.</span>
        {editable && onTitle ? (
          <Input value={job.title} onChange={(e) => onTitle(e.target.value)} placeholder="Name the job (Front brakes, A/C…)" aria-label="Name" maxLength={80} className="h-9 min-w-0 flex-1 basis-40 font-semibold" data-testid="job-title" />
        ) : (
          <h3 className="min-w-0 flex-1 text-base font-semibold">{job.title}</h3>
        )}
        {job.kind !== "diagnosis" &&
          (editable && onPriority ? (
            <Segmented size="sm" aria-label="Priority" value={job.priority} onValueChange={(v) => onPriority(v as EstimateJobPriority)} items={(["safety", "soon", "optional"] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
          ) : (
            <Badge variant={job.priority === "safety" ? "destructive" : job.priority === "soon" ? "warning" : "muted"} data-testid="job-priority">{PRIORITY_LABEL[job.priority]}</Badge>
          ))}
        {job.status !== "recommended" && <Badge variant={job.status === "declined" ? "muted" : "success"}>{{ approved: "Approved", declined: "Declined", done: "Done" }[job.status] ?? job.status}</Badge>}
        {showMoney && <span className="ml-auto text-base font-semibold tabular-nums" data-testid="job-price">{money(fin.all.total)}</span>}
      </header>

      <div className="divide-y divide-border">
        {TABLES.map((t) => {
          const rows = job.lines.filter((l) => bucketOf(l.type) === t.bucket);
          if (!editable && rows.length === 0) return null;
          return (
            <JobTable key={t.bucket} table={t} rows={rows} subtotal={fin[t.bucket]} estimateId={estimateId} showMoney={showMoney} editable={editable} technicians={technicians} canAssignTech={!!canAssignTech} onOpenLine={onOpenLine} onRemoveLine={onRemoveLine} onTech={onTech} onQuickAdd={onQuickAdd} onSearchStock={onSearchStock} onPickStock={onPickStock} />
          );
        })}
      </div>
      {extra}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-[#2b2f33] px-3 py-2.5 text-white" data-testid="job-totals-bar">
        {(["labor", "parts", "sublet", "fees"] as const).map((b) => (
          <Figure key={b} label={{ labor: "Labor", parts: "Parts", sublet: "Sublet", fees: "Fees" }[b]} f={fin[b]} showMoney={showMoney} />
        ))}
        <span className="ml-auto" />
        <Figure label="Total" f={fin.all} showMoney={showMoney} strong testId="job-total" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Job menu" className="grid size-8 place-items-center rounded-full border border-white/30 hover:bg-white/10" data-testid="job-menu">
              <EllipsisVerticalIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {showMoney && (
              <DropdownMenuItem onSelect={() => setFinancials(true)} data-testid="job-financials">
                <DollarSignIcon /> View financials
              </DropdownMenuItem>
            )}
            {onSaveCanned && job.lines.length > 0 && (
              <DropdownMenuItem onSelect={onSaveCanned} data-testid="job-save-canned">
                <BookmarkPlusIcon /> Save service as a canned job
              </DropdownMenuItem>
            )}
            {editable && onRemoveJob && (
              <DropdownMenuItem onSelect={onRemoveJob} data-testid="job-remove">
                <Trash2Icon /> Delete service
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {financials && <FinancialsDialog job={job} onClose={() => setFinancials(false)} />}
    </section>
  );
}

function Figure({ label, f, showMoney, strong, testId }: { label: string; f: BucketFigures; showMoney: boolean; strong?: boolean; testId?: string }) {
  const gp = showMoney ? gpLabel(f) : null;
  return (
    <div className="flex items-baseline gap-1.5 text-sm" data-testid={testId}>
      <span className="text-xs text-white/60">{label}</span>
      <span className={cn("tabular-nums", strong && "text-base font-semibold")}>{showMoney ? money(f.total) : "—"}</span>
      {gp && <span className="rounded bg-white/15 px-1 text-[11px] tabular-nums" title="Gross profit">GP {gp}</span>}
    </div>
  );
}

function JobTable({ table, rows, subtotal, estimateId, showMoney, editable, technicians, canAssignTech, onOpenLine, onRemoveLine, onTech, onQuickAdd, onSearchStock, onPickStock }: {
  table: (typeof TABLES)[number];
  rows: JobLine[];
  subtotal: BucketFigures;
  estimateId: string | null;
  showMoney: boolean;
  editable: boolean;
  technicians: { id: string; name: string; initials: string }[];
  canAssignTech: boolean;
  onOpenLine?: (k: string) => void;
  onRemoveLine?: (k: string) => void;
  onTech?: (k: string, t: string) => void;
  onQuickAdd?: (type: "labor" | "part" | "fee" | "sublet", v: { label: string; hours?: number; price?: number }) => void;
  onSearchStock?: (q: string) => Promise<InventoryItem[]>;
  onPickStock?: (i: InventoryItem) => void;
}) {
  const [open, setOpen] = useState(true);
  const type = table.bucket === "labor" ? "labor" : table.bucket === "parts" ? "part" : table.bucket === "fees" ? "fee" : "sublet";
  return (
    <div data-testid={`table-${table.bucket}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 bg-muted/70 px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <ChevronDownIcon className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
        {table.title}
        {rows.length > 0 && <span className="font-normal normal-case text-subtle">· {rows.length}</span>}
        {showMoney && rows.length > 0 && <span className="ml-auto font-semibold tabular-nums normal-case">{money(subtotal.total)}</span>}
      </button>
      {open && (
        <>
          {rows.length > 0 && (
            <div className={cn("hidden gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-subtle sm:grid", table.cols)} aria-hidden>
              {table.heads.map((h, i) => (
                <span key={i} className={cn(i > 0 && "text-right")}>{h}</span>
              ))}
            </div>
          )}
          <ul className="divide-y divide-border text-sm" data-testid="estimate-lines">
            {rows.map((l) => (
              <li key={l.key} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-3 py-2", table.cols)} data-testid={`line-${l.type}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {editable && onOpenLine && l.type !== "service" ? (
                      <button type="button" onClick={() => onOpenLine(l.key)} className="text-left font-medium underline-offset-2 hover:underline" aria-label={`Edit ${l.name}`} data-testid="line-edit">{l.name}</button>
                    ) : (
                      <span className={cn("font-medium", l.declined && "text-muted-foreground line-through")}>{l.name}</span>
                    )}
                    {l.declined && <Badge variant="muted">Declined</Badge>}
                  </div>
                  <div className="text-caption text-subtle">
                    {[l.type === "labor" && l.hours != null ? `${l.hours} h${l.rate != null && showMoney ? ` × ${formatMoney(l.rate)}` : ""}` : null, l.type === "part" && l.partNumber ? l.partNumber : null, l.note].filter(Boolean).join(" · ")}
                  </div>
                  {showMoney && l.cost !== null && <div className="text-caption text-subtle">Cost {formatMoney(l.cost)}</div>}
                </div>
                {table.bucket === "labor" && (
                  <div className="order-3 col-span-2 sm:order-none sm:col-span-1 sm:text-right">
                    {l.type === "labor" && (
                      editable && onTech && technicians.length > 0 ? (
                        <select value={l.techId ?? ""} onChange={(e) => onTech(l.key, e.target.value)} aria-label={`Tech for ${l.name}`} className="h-7 w-full rounded-md border border-border bg-input px-1.5 text-caption sm:w-auto" data-testid="line-tech">
                          <option value="">No tech yet</option>
                          {technicians.map((t) => <option key={t.id} value={t.id}>{t.initials}: {t.name}</option>)}
                        </select>
                      ) : estimateId ? (
                        <LineTech estimateId={estimateId} lineId={l.key} tech={l.tech} techId={l.techId} technicians={technicians} canAssign={canAssignTech} />
                      ) : l.tech ? (
                        <span className="text-caption text-subtle">{l.tech}</span>
                      ) : null
                    )}
                  </div>
                )}
                {table.bucket === "labor" && <span className="hidden text-right tabular-nums sm:block">{l.hours != null ? l.hours : ""}</span>}
                {table.bucket === "parts" && <span className="hidden truncate text-right text-caption text-subtle sm:block">{l.partNumber ?? ""}</span>}
                {(table.bucket === "parts" || table.bucket === "fees") && <span className="hidden text-right tabular-nums sm:block">{l.qty}</span>}
                {table.bucket === "parts" && <span className="hidden text-right tabular-nums sm:block">{showMoney ? money(l.unit) : ""}</span>}
                {table.bucket === "fees" && <span className="hidden text-right tabular-nums sm:block">{showMoney ? money(l.unit) : ""}</span>}
                {table.bucket === "sublet" && <span className="hidden truncate text-right text-caption text-subtle sm:block">{l.vendor ?? ""}</span>}
                <div className="flex items-center justify-end gap-1">
                  <span className={cn("w-24 text-right font-semibold tabular-nums", l.declined && "text-muted-foreground line-through")}>{showMoney ? money(l.total) : ""}</span>
                  {editable && onRemoveLine && (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${l.name}`} onClick={() => onRemoveLine(l.key)}>
                      <XIcon />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {editable && onQuickAdd && <QuickAddRow type={type} onQuickAdd={onQuickAdd} onSearchStock={onSearchStock} onPickStock={onPickStock} />}
        </>
      )}
    </div>
  );
}

/** The inline add row under a table. On a phone the same actions are the + chips under the tables. */
function QuickAddRow({ type, onQuickAdd, onSearchStock, onPickStock }: { type: "labor" | "part" | "fee" | "sublet"; onQuickAdd: (type: "labor" | "part" | "fee" | "sublet", v: { label: string; hours?: number; price?: number }) => void; onSearchStock?: (q: string) => Promise<InventoryItem[]>; onPickStock?: (i: InventoryItem) => void }) {
  const [name, setName] = useState("");
  const [n, setN] = useState("");
  const [hits, setHits] = useState<InventoryItem[] | null>(null);
  const needsNumber = type !== "part";
  const placeholder = { labor: "Labor item name", part: "Search part name or number", fee: "Fee name", sublet: "Sublet name" }[type];
  async function type_(v: string) {
    setName(v);
    if (type !== "part" || !onSearchStock) return;
    if (v.trim().length < 2) return void setHits(null);
    setHits(await onSearchStock(v.trim()));
  }
  function submit() {
    const label = name.trim();
    if (!label) return;
    const num = Number(n);
    onQuickAdd(type, type === "labor" ? { label, hours: num > 0 ? num : 1 } : type === "part" ? { label } : { label, price: num >= 0 && n !== "" ? num : 0 });
    setName("");
    setN("");
    setHits(null);
  }
  return (
    <div className="relative hidden items-center gap-2 border-t border-border px-3 py-2 sm:flex" data-testid={`quick-add-${type}`}>
      <Input value={name} onChange={(e) => void type_(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())} placeholder={placeholder} aria-label={placeholder} className="h-9 flex-1" data-testid={`quick-${type}-name`} />
      {needsNumber && <Input value={n} onChange={(e) => setN(e.target.value.replace(/[^\d.]/g, ""))} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())} inputMode="decimal" placeholder={type === "labor" ? "Hours" : "Amount"} aria-label={type === "labor" ? "Hours" : "Amount"} className="h-9 w-24" data-testid={`quick-${type}-n`} />}
      <Button type="button" size="icon-sm" onClick={submit} aria-label={`Add ${placeholder}`} disabled={!name.trim()} data-testid={`quick-${type}-add`}>
        <PlusIcon />
      </Button>
      {hits && (
        <ul className="absolute top-full left-3 z-20 mt-1 max-h-48 w-[min(28rem,90%)] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-popover text-sm shadow-lg" data-testid="quick-stock-hits">
          {hits.map((i) => {
            const st = stockLabel(i);
            return (
              <li key={i.id}>
                <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted" onClick={() => { onPickStock?.(i); setName(""); setHits(null); }} data-testid="quick-stock-hit">
                  <span className="min-w-0 truncate"><span className="font-medium">{i.name}</span> <span className="text-caption text-subtle">{i.part_number}</span></span>
                  <span className={cn("shrink-0 text-caption", st.tone === "ok" ? "text-success" : "text-warning")}>{st.text}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className="w-full px-3 py-2 text-left text-primary hover:bg-muted" onClick={submit}>Add &ldquo;{name.trim()}&rdquo; as a typed part…</button>
          </li>
        </ul>
      )}
    </div>
  );
}

/** Revenue, cost and profit per table: only for the people who may see prices. */
function FinancialsDialog({ job, onClose }: { job: JobModel; onClose: () => void }) {
  const f = jobFinancials(job.lines);
  const rows: [string, BucketFigures][] = [["Labor", f.labor], ["Parts", f.parts], ["Sublet", f.sublet], ["Fees", f.fees], ["Total", f.all]];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="financials-dialog">
        <DialogHeader>
          <DialogTitle>Financials · {job.title}</DialogTitle>
          <DialogDescription>What the customer pays, what it costs you, and what is left. Hidden from the customer, techs and managers.</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-caption text-subtle"><th className="py-1 font-medium"></th><th className="text-right font-medium">Sell</th><th className="text-right font-medium">Cost</th><th className="text-right font-medium">Profit</th><th className="text-right font-medium">GP</th></tr>
          </thead>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className={cn("border-t border-border", k === "Total" && "font-semibold")}>
                <td className="py-1.5">{k}</td>
                <td className="text-right tabular-nums">{money(v.total)}</td>
                <td className="text-right tabular-nums">{v.pct !== null || v.cost > 0 ? money(v.cost) : "—"}</td>
                <td className="text-right tabular-nums">{v.profit !== null ? money(v.profit) : "—"}</td>
                <td className="text-right tabular-nums">{gpLabel(v) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-caption text-subtle">A dash means some lines have no cost entered yet, so the profit would be misleading.</p>
      </DialogContent>
    </Dialog>
  );
}
