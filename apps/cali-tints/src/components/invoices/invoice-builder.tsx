"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";
import type { Dealership } from "@/lib/db/types";
import type { PreviewJob } from "@/app/(app)/invoices/new/page";
import { generateInvoiceAction, generatePerJobInvoicesAction } from "@/app/(app)/invoices/actions";
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
import { cn } from "@/lib/utils";

export function InvoiceBuilder({
  dealerships,
  dealershipId,
  from,
  to,
  preview,
  taxRate,
}: {
  dealerships: Dealership[];
  dealershipId: string | null;
  from: string;
  to: string;
  preview: PreviewJob[];
  taxRate: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const [preset, setPreset] = useState<RangePreset>("custom");
  const dealership = dealerships.find((d) => d.id === dealershipId) ?? null;
  const perJob = dealership?.invoice_mode === "per_job";

  const totals = useMemo(() => invoiceTotals(preview.map((p) => p.total), taxRate), [preview, taxRate]);

  // Per-job grouping mirrors generate_per_job_invoices(): one invoice per RO/PO.
  const groups = useMemo(() => {
    const m = new Map<string, PreviewJob[]>();
    for (const j of preview) {
      const key = j.ro_po_number ?? `job:${j.id}`;
      m.set(key, [...(m.get(key) ?? []), j]);
    }
    return Array.from(m.entries());
  }, [preview]);

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

  function generate() {
    if (!dealershipId) return;
    start(async () => {
      if (perJob) {
        const r = await generatePerJobInvoicesAction({ dealership_id: dealershipId, notes });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success(`${r.data.length} invoice${r.data.length === 1 ? "" : "s"} generated`);
        router.push(`/invoices?created=${r.data.join(",")}`);
      } else {
        const r = await generateInvoiceAction({ dealership_id: dealershipId, start: from, end: to, notes });
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
              <span>{preview.length}</span>
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

          <Button size="lg" disabled={pending || preview.length === 0} onClick={generate}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <FileTextIcon />}
            {perJob ? `Generate all pending (${groups.length})` : "Generate invoice"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>
            {perJob ? "Pending jobs by RO/PO" : `Uninvoiced jobs · ${formatDate(from + "T00:00:00")} – ${formatDate(to + "T00:00:00")}`}
          </CardTitle>
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
                  <PreviewRows jobs={jobs} compact />
                </div>
              ))}
            </div>
          ) : (
            <PreviewRows jobs={preview} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewRows({ jobs, compact }: { jobs: PreviewJob[]; compact?: boolean }) {
  return (
    <Table>
      {!compact && (
        <TableHeader>
          <TableRow>
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
        {jobs.map((j) => (
          <TableRow key={j.id} className={cn(compact && "text-sm")}>
            <TableCell className="text-muted-foreground">{formatDate(j.performed_at, "MMM d")}</TableCell>
            <TableCell className="font-semibold">{j.tag_number}</TableCell>
            <TableCell>{[j.year, j.make, j.model].filter(Boolean).join(" ")}</TableCell>
            <TableCell className="max-w-56 truncate">{j.services.map((s) => s.name).join(", ")}</TableCell>
            <TableCell className="text-muted-foreground">{j.detailer}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(j.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
