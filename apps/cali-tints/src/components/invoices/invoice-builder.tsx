"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CheckIcon, ExternalLinkIcon, FileTextIcon, LoaderCircleIcon, ReceiptIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { Dealership, InvoiceConflictRow } from "@/lib/db/types";
import type { PreviewJob } from "@/app/(app)/invoices/new/page";
import { generateInvoiceAction, generatePerJobInvoicesAction, reviewJobDuplicateAction } from "@/app/(app)/invoices/actions";
import { formatMoney, formatTaxRate, invoiceTotals } from "@/lib/money";
import { formatDate, presetRange, RANGE_PRESETS, type RangePreset } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function InvoiceBuilder({
  dealerships,
  dealershipId,
  from,
  to,
  preview,
  conflicts,
  taxRate,
}: {
  dealerships: Dealership[];
  dealershipId: string | null;
  from: string;
  to: string;
  preview: PreviewJob[];
  conflicts: InvoiceConflictRow[];
  taxRate: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const [preset, setPreset] = useState<RangePreset>("custom");
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [reviewing, setReviewing] = useState<PreviewJob | null>(null);
  const dealership = dealerships.find((d) => d.id === dealershipId) ?? null;
  const perJob = dealership?.invoice_mode === "per_job";

  // Conflicts indexed by job; a pair inside the batch is shown on both sides.
  const conflictsByJob = useMemo(() => {
    const m = new Map<string, InvoiceConflictRow[]>();
    const add = (id: string, c: InvoiceConflictRow) => m.set(id, [...(m.get(id) ?? []), c]);
    for (const c of conflicts) {
      add(c.job_id, c);
      if (c.kind === "in_batch") {
        const self = preview.find((p) => p.id === c.job_id);
        if (self) {
          add(c.other_job_id, {
            ...c,
            job_id: c.other_job_id,
            other_job_id: c.job_id,
            other_tag: self.tag_number,
            other_vin: self.vin,
            other_performed_at: self.performed_at,
            other_services: self.services.map((s) => s.name).join(", "),
          });
        }
      }
    }
    return m;
  }, [conflicts, preview]);

  const included = useMemo(() => preview.filter((p) => !excluded.has(p.id)), [preview, excluded]);
  const flagged = useMemo(() => preview.filter((p) => conflictsByJob.has(p.id)), [preview, conflictsByJob]);
  const hardFlags = flagged.filter((p) => (conflictsByJob.get(p.id) ?? []).some((c) => c.shared_services)).length;
  const totals = useMemo(() => invoiceTotals(included.map((p) => p.total), taxRate), [included, taxRate]);

  // Per-job grouping mirrors generate_per_job_invoices(): one invoice per RO/PO.
  const groups = useMemo(() => {
    const m = new Map<string, PreviewJob[]>();
    for (const j of included) {
      const key = j.ro_po_number ?? `job:${j.id}`;
      m.set(key, [...(m.get(key) ?? []), j]);
    }
    return Array.from(m.entries());
  }, [included]);

  function navigate(next: { dealership?: string; from?: string; to?: string }) {
    const p = new URLSearchParams();
    p.set("dealership", next.dealership ?? dealershipId ?? "");
    p.set("from", next.from ?? from);
    p.set("to", next.to ?? to);
    router.push(`/invoices/new?${p.toString()}`);
  }

  function applyPreset(v: RangePreset) {
    setPreset(v);
    if (v === "custom") return;
    const r = presetRange(v);
    navigate({ from: r.start, to: r.end });
  }

  function toggleExclude(id: string, on: boolean) {
    setExcluded((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function generate() {
    if (!dealershipId) return;
    const exclude = Array.from(excluded);
    start(async () => {
      if (perJob) {
        const r = await generatePerJobInvoicesAction({ dealership_id: dealershipId, notes, exclude });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success(`${r.data.length} invoice${r.data.length === 1 ? "" : "s"} generated`);
        router.push(`/invoices?created=${r.data.join(",")}`);
      } else {
        const r = await generateInvoiceAction({ dealership_id: dealershipId, start: from, end: to, notes, exclude });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success("Invoice generated");
        router.push(`/invoices/${r.data}`);
      }
    });
  }

  if (dealerships.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a dealership in Settings first.</p>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <Card className="h-fit min-w-0">
        <CardHeader>
          <CardTitle>Invoice setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Dealership</Label>
            <Select value={dealershipId ?? ""} onValueChange={(v) => navigate({ dealership: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dealerships.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dealership && (
              <p className="text-xs text-muted-foreground">
                Mode: <span className="text-foreground">{perJob ? "Per job (one invoice per RO/PO)" : "Batch (date range)"}</span> · Terms:{" "}
                <span className="text-foreground">{dealership.payment_terms ?? "company default"}</span>
              </p>
            )}
          </div>

          {!perJob && (
            <>
              <div className="grid gap-1.5">
                <Label>Period</Label>
                <Select value={preset} onValueChange={(v) => applyPreset(v as RangePreset)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANGE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="from">From</Label>
                  <Input
                    id="from"
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setPreset("custom");
                      if (e.target.value) navigate({ from: e.target.value });
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="to">To</Label>
                  <Input
                    id="to"
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setPreset("custom");
                      if (e.target.value) navigate({ to: e.target.value });
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes on invoice (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" placeholder="Shown under payment terms" />
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jobs</span>
              <span>
                {included.length}
                {excluded.size > 0 && <span className="text-muted-foreground"> ({excluded.size} excluded)</span>}
              </span>
            </div>
            {perJob && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoices to create</span>
                <span>{groups.length}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({formatTaxRate(taxRate)})</span>
              <span className="tabular-nums">{formatMoney(totals.tax)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totals.total)}</span>
            </div>
          </div>

          <Button size="lg" disabled={pending || included.length === 0} onClick={generate}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <FileTextIcon />}
            {perJob ? `Generate all pending (${groups.length})` : "Generate invoice"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      <div className="flex min-w-0 flex-col gap-4">
        {flagged.length > 0 && (
          <Alert variant={hardFlags > 0 ? "destructive" : "warning"}>
            <AlertTriangleIcon />
            <AlertTitle>
              {flagged.length} job{flagged.length === 1 ? "" : "s"} may be double-billed
              {hardFlags > 0 ? ` · ${hardFlags} for the same service` : ""}
            </AlertTitle>
            <AlertDescription>
              <p>
                Same VIN or tag as a job already invoiced in the last 30 days, or repeated in this batch. For each one: <strong>Exclude</strong> it from
                this invoice, or <strong>Mark OK</strong> with a note if it is legitimate (a second, different job on the same car). Excluded jobs stay
                uninvoiced; delete true duplicates from the job page.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>{perJob ? "Pending jobs by RO/PO" : `Uninvoiced jobs · ${formatDate(from + "T00:00:00")} – ${formatDate(to + "T00:00:00")}`}</CardTitle>
          </CardHeader>
          <CardContent>
            {preview.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing to invoice for this selection.</p>
            ) : perJob ? (
              <div className="flex flex-col gap-3">
                {groups.map(([key, jobs]) => (
                  <div key={key} className="rounded-lg border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-sm">
                      <span className="font-medium">{key.startsWith("job:") ? <Badge variant="warning">No RO/PO</Badge> : `RO/PO ${key}`}</span>
                      <span className="tabular-nums">{formatMoney(jobs.reduce((a, j) => a + j.total, 0))}</span>
                    </div>
                    <PreviewRows jobs={jobs} conflictsByJob={conflictsByJob} excluded={excluded} onExclude={toggleExclude} onReview={setReviewing} compact />
                  </div>
                ))}
                {excluded.size > 0 && <ExcludedRows jobs={preview.filter((p) => excluded.has(p.id))} onInclude={(id) => toggleExclude(id, false)} />}
              </div>
            ) : (
              <PreviewRows jobs={preview} conflictsByJob={conflictsByJob} excluded={excluded} onExclude={toggleExclude} onReview={setReviewing} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        {reviewing && <ReviewDialog job={reviewing} conflicts={conflictsByJob.get(reviewing.id) ?? []} onClose={() => setReviewing(null)} />}
      </Dialog>
    </div>
  );
}

function ConflictNote({ c }: { c: InvoiceConflictRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
      {c.kind === "invoiced" ? (
        <Badge variant="destructive">
          <ReceiptIcon /> Billed on {c.other_invoice_number}
        </Badge>
      ) : (
        <Badge variant="warning">Also in this batch</Badge>
      )}
      <span className="text-muted-foreground">
        {c.match_on === "vin" ? "same VIN" : "same tag"} · {formatDate(c.other_performed_at, "MMM d")} · {c.other_services ?? "no services"}
      </span>
      {c.shared_services ? (
        <span className="font-medium text-destructive">same service: {c.shared_services}</span>
      ) : (
        <span className="text-muted-foreground">different work</span>
      )}
      <Link href={`/jobs/${c.other_job_id}`} className="inline-flex items-center gap-0.5 text-primary hover:underline">
        view <ExternalLinkIcon className="size-3" />
      </Link>
    </div>
  );
}

function PreviewRows({
  jobs,
  conflictsByJob,
  excluded,
  onExclude,
  onReview,
  compact,
}: {
  jobs: PreviewJob[];
  conflictsByJob: Map<string, InvoiceConflictRow[]>;
  excluded: Set<string>;
  onExclude: (id: string, on: boolean) => void;
  onReview: (j: PreviewJob) => void;
  compact?: boolean;
}) {
  return (
    <Table>
      {!compact && (
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Date</TableHead>
            <TableHead>Tag</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Services</TableHead>
            <TableHead>Detailer</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {jobs.map((j) => {
          const cs = conflictsByJob.get(j.id) ?? [];
          const isExcluded = excluded.has(j.id);
          const hard = cs.some((c) => c.shared_services);
          return (
            <TableRow
              key={j.id}
              className={cn(compact && "text-sm", isExcluded && "opacity-50", cs.length > 0 && !isExcluded && (hard ? "bg-destructive/5" : "bg-warning/5"))}
            >
              <TableCell className="w-8 pr-0">
                <Checkbox checked={!isExcluded} onCheckedChange={(v) => onExclude(j.id, v !== true)} aria-label={isExcluded ? "Include job" : "Exclude job"} />
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(j.performed_at, "MMM d")}</TableCell>
              <TableCell className="font-semibold">
                <Link href={`/jobs/${j.id}`} className="hover:text-primary">
                  {j.tag_number}
                </Link>
                {j.dup_review_note && (
                  <span title={j.dup_review_note} className="ml-1.5 inline-flex align-middle text-success">
                    <ShieldCheckIcon className="size-3.5" />
                  </span>
                )}
              </TableCell>
              <TableCell className="min-w-64 whitespace-normal">
                <div>{[j.year, j.make, j.model].filter(Boolean).join(" ")}</div>
                {cs.length > 0 && !isExcluded && (
                  <div className="mt-1 flex flex-col gap-1">
                    {cs.map((c) => (
                      <ConflictNote key={c.other_job_id} c={c} />
                    ))}
                    <div className="flex gap-1.5 pt-0.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onExclude(j.id, true)}>
                        Exclude
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onReview(j)}>
                        <CheckIcon /> Mark OK
                      </Button>
                    </div>
                  </div>
                )}
                {isExcluded && <div className="mt-1 text-xs text-muted-foreground">Excluded from this invoice</div>}
              </TableCell>
              <TableCell className="max-w-56 truncate">{j.services.map((s) => s.name).join(", ")}</TableCell>
              <TableCell className="text-muted-foreground">{j.detailer}</TableCell>
              <TableCell className={cn("text-right tabular-nums", isExcluded && "line-through")}>{formatMoney(j.total)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ExcludedRows({ jobs, onInclude }: { jobs: PreviewJob[]; onInclude: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-3 text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Excluded</div>
      <ul className="flex flex-col gap-1">
        {jobs.map((j) => (
          <li key={j.id} className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {j.tag_number} · {formatDate(j.performed_at, "MMM d")} · {formatMoney(j.total)}
            </span>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onInclude(j.id)}>
              Include
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewDialog({ job, conflicts, onClose }: { job: PreviewJob; conflicts: InvoiceConflictRow[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Mark {job.tag_number} as OK to bill</DialogTitle>
        <DialogDescription>
          Confirms this is a legitimate separate job on the same vehicle. The note is kept on the job and shown in its history; it will not be flagged again.
        </DialogDescription>
      </DialogHeader>
      <ul className="rounded-lg border border-border p-3">
        {conflicts.map((c) => (
          <li key={c.other_job_id} className="py-1">
            <ConflictNote c={c} />
          </li>
        ))}
      </ul>
      <div className="grid gap-1.5">
        <Label htmlFor="rv-note">Why is this billable?</Label>
        <Textarea
          id="rv-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-16"
          placeholder="e.g. PDI on arrival, full detail at sale — approved by service manager"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={pending || note.trim().length < 3}
          onClick={() =>
            start(async () => {
              const r = await reviewJobDuplicateAction(job.id, note);
              if (r.ok) {
                toast.success("Marked OK to bill");
                onClose();
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          {pending && <LoaderCircleIcon className="animate-spin" />} Mark OK
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
