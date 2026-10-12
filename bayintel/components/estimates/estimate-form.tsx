"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SourceBadge } from "@/components/source-badge";
import { computeTotals } from "@/lib/estimates/calc";
import { formatMoney } from "@/lib/utils";
import { saveEstimateAction, type EstimateInput } from "@/app/(app)/estimates/actions";
import type { LaborTime } from "@/lib/providers/types";

export interface EstimateFormVehicle {
  id: string;
  label: string;
  year: number;
  make: string;
  model: string;
}

interface LineState {
  kind: "part" | "labor" | "fee";
  description: string;
  part_number: string;
  quantity: string;
  unit_price: string;
  hours: string;
}

export interface EstimateFormInitial {
  vehicle_id?: string | null;
  repair_order_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  labor_rate: number;
  tax_rate: number;
  tax_parts?: boolean;
  tax_labor?: boolean;
  notes?: string | null;
  valid_until?: string | null;
  status?: "draft" | "sent" | "approved" | "declined";
  lines?: { kind: "part" | "labor" | "fee"; description: string; part_number: string | null; quantity: number; unit_price: number; hours: number | null }[];
}

export function EstimateForm({ vehicles, initial, estimateId }: { vehicles: EstimateFormVehicle[]; initial: EstimateFormInitial; estimateId?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState(initial.vehicle_id ?? "");
  const [customer, setCustomer] = useState({ name: initial.customer_name ?? "", email: initial.customer_email ?? "", phone: initial.customer_phone ?? "" });
  const [laborRate, setLaborRate] = useState(String(initial.labor_rate));
  const [taxRate, setTaxRate] = useState(String((initial.tax_rate * 100).toFixed(3).replace(/\.?0+$/, "")));
  const [taxParts, setTaxParts] = useState(initial.tax_parts ?? true);
  const [taxLabor, setTaxLabor] = useState(initial.tax_labor ?? false);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [validUntil, setValidUntil] = useState(initial.valid_until ?? "");
  const [status, setStatus] = useState(initial.status ?? "draft");
  const [lines, setLines] = useState<LineState[]>(
    initial.lines?.length
      ? initial.lines.map((l) => ({ kind: l.kind, description: l.description, part_number: l.part_number ?? "", quantity: String(l.quantity), unit_price: String(l.unit_price), hours: l.hours?.toString() ?? "" }))
      : [
          { kind: "labor", description: "Diagnosis", part_number: "", quantity: "1", unit_price: String(initial.labor_rate), hours: "1" },
          { kind: "part", description: "", part_number: "", quantity: "1", unit_price: "", hours: "" },
        ],
  );
  const [laborQuery, setLaborQuery] = useState("");
  const [laborResults, setLaborResults] = useState<LaborTime[]>([]);

  const rate = Number(laborRate) || 0;
  const totals = useMemo(
    () =>
      computeTotals(
        lines
          .filter((l) => l.description.trim())
          .map((l) => ({ kind: l.kind, description: l.description, quantity: Number(l.quantity) || 0, unit_price: l.kind === "labor" ? rate : Number(l.unit_price) || 0, hours: l.kind === "labor" ? Number(l.hours) || 0 : null })),
        { taxRate: (Number(taxRate) || 0) / 100, taxParts, taxLabor },
      ),
    [lines, rate, taxRate, taxParts, taxLabor],
  );

  useEffect(() => {
    if (!laborQuery.trim()) return setLaborResults([]);
    const v = vehicles.find((x) => x.id === vehicleId);
    const t = setTimeout(() => {
      fetch(`/api/labor?q=${encodeURIComponent(laborQuery)}&year=${v?.year ?? ""}&make=${encodeURIComponent(v?.make ?? "")}&model=${encodeURIComponent(v?.model ?? "")}`)
        .then((r) => r.json())
        .then((j) => setLaborResults(j.results ?? []))
        .catch(() => setLaborResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [laborQuery, vehicleId, vehicles]);

  function update(i: number, patch: Partial<LineState>) {
    setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: EstimateInput = {
      vehicle_id: vehicleId || null,
      repair_order_id: initial.repair_order_id ?? null,
      customer_name: customer.name || null,
      customer_email: customer.email || null,
      customer_phone: customer.phone || null,
      labor_rate: rate,
      tax_rate: (Number(taxRate) || 0) / 100,
      tax_parts: taxParts,
      tax_labor: taxLabor,
      notes: notes || null,
      valid_until: validUntil || null,
      status,
      lines: lines
        .filter((l) => l.description.trim())
        .map((l) => ({ kind: l.kind, description: l.description, part_number: l.part_number || null, quantity: Number(l.quantity) || 1, unit_price: l.kind === "labor" ? rate : Number(l.unit_price) || 0, hours: l.kind === "labor" ? Number(l.hours) || 0 : null, taxable: null })),
    };
    start(async () => {
      const res = await saveEstimateAction(estimateId ?? null, payload);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Customer & vehicle</legend>
        <div>
          <Label htmlFor="vehicle">Vehicle</Label>
          <Select id="vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">No vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
        <Input placeholder="Customer name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="email" placeholder="Email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          <Input type="tel" placeholder="Phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rates</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="rate">Labor rate ($/h)</Label>
            <Input id="rate" inputMode="decimal" value={laborRate} onChange={(e) => setLaborRate(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div>
            <Label htmlFor="tax">Tax rate (%)</Label>
            <Input id="tax" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
        </div>
        <div className="flex items-center justify-between py-1">
          <Label htmlFor="taxParts" className="mb-0">
            Tax parts
          </Label>
          <Switch id="taxParts" checked={taxParts} onCheckedChange={setTaxParts} />
        </div>
        <div className="flex items-center justify-between py-1">
          <Label htmlFor="taxLabor" className="mb-0">
            Tax labor
          </Label>
          <Switch id="taxLabor" checked={taxLabor} onCheckedChange={setTaxLabor} />
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Line items</legend>
        <ul className="space-y-3">
          {lines.map((l, i) => (
            <li key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Select aria-label="Kind" value={l.kind} onChange={(e) => update(i, { kind: e.target.value as LineState["kind"] })} className="w-28">
                  <option value="part">Part</option>
                  <option value="labor">Labor</option>
                  <option value="fee">Fee</option>
                </Select>
                <Input aria-label="Description" placeholder="Description" value={l.description} onChange={(e) => update(i, { description: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
              {l.kind === "labor" ? (
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <Input aria-label="Hours" inputMode="decimal" placeholder="Hours" value={l.hours} onChange={(e) => update(i, { hours: e.target.value.replace(/[^\d.]/g, "") })} />
                  <span className="text-sm tabular-nums text-muted-foreground">= {formatMoney((Number(l.hours) || 0) * rate)}</span>
                </div>
              ) : (
                <div className="grid grid-cols-[1.2fr_0.7fr_1fr_auto] items-center gap-2">
                  <Input aria-label="Part number" placeholder="Part #" value={l.part_number} onChange={(e) => update(i, { part_number: e.target.value })} disabled={l.kind === "fee"} />
                  <Input aria-label="Quantity" inputMode="decimal" placeholder="Qty" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value.replace(/[^\d.]/g, "") })} />
                  <Input aria-label="Unit price" inputMode="decimal" placeholder="$ each" value={l.unit_price} onChange={(e) => update(i, { unit_price: e.target.value.replace(/[^\d.]/g, "") })} />
                  <span className="text-sm tabular-nums text-muted-foreground">= {formatMoney((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { kind: "part", description: "", part_number: "", quantity: "1", unit_price: "", hours: "" }])}>
            <Plus /> Part
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { kind: "labor", description: "", part_number: "", quantity: "1", unit_price: "", hours: "" }])}>
            <Plus /> Labor
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { kind: "fee", description: "Shop supplies", part_number: "", quantity: "1", unit_price: "", hours: "" }])}>
            <Plus /> Fee
          </Button>
        </div>
        <div>
          <Label htmlFor="laborq">Labor time lookup (LaborProvider)</Label>
          <Input id="laborq" value={laborQuery} onChange={(e) => setLaborQuery(e.target.value)} placeholder="e.g. spark plugs" />
          {laborResults.length > 0 && (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {laborResults.map((r) => (
                <li key={r.operation}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setLines([...lines, { kind: "labor", description: r.operation.replace(/^\w/, (c) => c.toUpperCase()), part_number: "", quantity: "1", unit_price: "", hours: String(r.hours) }]);
                      setLaborQuery("");
                    }}
                  >
                    <span className="capitalize">{r.operation}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {r.hours} h <SourceBadge source={r.source} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Labor hours are entered manually for now. Lookup values are SAMPLE placeholders until a licensed labor guide is connected.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes & status</legend>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes shown to the customer (warranty, what's not included, authorization language)" className="min-h-16" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="valid">Valid until</Label>
            <Input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </Select>
          </div>
        </div>
      </fieldset>

      <div className="sticky bottom-16 rounded-xl border border-border bg-card p-4 shadow-lg md:bottom-4">
        <dl className="grid grid-cols-2 gap-x-4 text-sm">
          <dt className="text-muted-foreground">Parts</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.parts)}</dd>
          <dt className="text-muted-foreground">Labor</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.labor)}</dd>
          {totals.fees > 0 && (
            <>
              <dt className="text-muted-foreground">Fees</dt>
              <dd className="text-right tabular-nums">{formatMoney(totals.fees)}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="text-right tabular-nums">{formatMoney(totals.tax)}</dd>
          <dt className="text-lg font-bold">Total</dt>
          <dd className="text-right text-lg font-bold tabular-nums">{formatMoney(totals.total)}</dd>
        </dl>
        <Button type="submit" className="mt-3 w-full" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : estimateId ? "Save estimate" : "Create estimate"}
        </Button>
      </div>
    </form>
  );
}
