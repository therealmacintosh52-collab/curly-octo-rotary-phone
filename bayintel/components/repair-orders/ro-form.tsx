"use client";
import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PhotoUpload, type UploadedMedia } from "@/components/fixes/photo-upload";
import { parseDtcList } from "@/lib/utils";
import { saveRepairOrderAction, type RoInput } from "@/app/(app)/repair-orders/actions";

export interface RoFormInitial {
  vehicle_id?: string;
  status?: "open" | "in_progress" | "completed" | "invoiced";
  mileage?: number | null;
  customer_name?: string | null;
  concern?: string;
  cause?: string | null;
  correction?: string | null;
  dtc_codes?: string[];
  tests_performed?: { test: string; result: string }[];
  parts?: { name: string; part_number: string | null; quantity: number; unit_price: number | null }[];
  labor_hours?: number | null;
  notes?: string | null;
  media?: UploadedMedia[];
}

export function RoForm({ vehicles, initial, roId }: { vehicles: { id: string; label: string; mileage: number | null }[]; initial: RoFormInitial; roId?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState(initial.vehicle_id ?? vehicles[0]?.id ?? "");
  const [status, setStatus] = useState(initial.status ?? "open");
  const [mileage, setMileage] = useState(initial.mileage?.toString() ?? vehicles.find((v) => v.id === (initial.vehicle_id ?? vehicles[0]?.id))?.mileage?.toString() ?? "");
  const [customer, setCustomer] = useState(initial.customer_name ?? "");
  const [concern, setConcern] = useState(initial.concern ?? "");
  const [cause, setCause] = useState(initial.cause ?? "");
  const [correction, setCorrection] = useState(initial.correction ?? "");
  const [codes, setCodes] = useState((initial.dtc_codes ?? []).join(" "));
  const [tests, setTests] = useState(initial.tests_performed ?? []);
  const [parts, setParts] = useState((initial.parts ?? []).map((p) => ({ name: p.name, part_number: p.part_number ?? "", quantity: String(p.quantity), unit_price: p.unit_price?.toString() ?? "" })));
  const [labor, setLabor] = useState(initial.labor_hours?.toString() ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [media, setMedia] = useState<UploadedMedia[]>(initial.media ?? []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: RoInput = {
      vehicle_id: vehicleId,
      status,
      mileage: mileage ? Number(mileage) : null,
      customer_name: customer || null,
      concern,
      cause: cause || null,
      correction: correction || null,
      dtc_codes: parseDtcList(codes),
      tests_performed: tests.filter((t) => t.test.trim()),
      parts: parts.filter((p) => p.name.trim()).map((p) => ({ name: p.name, part_number: p.part_number || null, quantity: Number(p.quantity) || 1, unit_price: p.unit_price ? Number(p.unit_price) : null })),
      labor_hours: labor ? Number(labor) : null,
      notes: notes || null,
      media,
    };
    start(async () => {
      const res = await saveRepairOrderAction(roId ?? null, payload);
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
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vehicle</legend>
        <Select aria-label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required disabled={Boolean(roId)}>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="mileage">Mileage in</Label>
            <Input id="mileage" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="invoiced">Invoiced</option>
            </Select>
          </div>
        </div>
        <Input placeholder="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Three Cs</legend>
        <div>
          <Label htmlFor="concern">Concern</Label>
          <Textarea id="concern" value={concern} onChange={(e) => setConcern(e.target.value)} required className="min-h-16" placeholder="Customer states..." />
        </div>
        <div>
          <Label htmlFor="codes">DTCs</Label>
          <Input id="codes" value={codes} onChange={(e) => setCodes(e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="P0300 P0171" autoCapitalize="characters" />
        </div>
        <div>
          <Label htmlFor="cause">Cause</Label>
          <Textarea id="cause" value={cause} onChange={(e) => setCause(e.target.value)} className="min-h-16" placeholder="Root cause found" />
        </div>
        <div>
          <Label htmlFor="correction">Correction</Label>
          <Textarea id="correction" value={correction} onChange={(e) => setCorrection(e.target.value)} className="min-h-16" placeholder="What was done" />
        </div>
        <div>
          <Label htmlFor="labor">Labor hours (actual)</Label>
          <Input id="labor" inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
      </fieldset>

      <fieldset className="space-y-2 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tests</legend>
        {tests.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input aria-label="Test" placeholder="Test" value={t.test} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, test: e.target.value } : x)))} />
            <Input aria-label="Result" placeholder="Result" value={t.result} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setTests(tests.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setTests([...tests, { test: "", result: "" }])}>
          <Plus /> Add test
        </Button>
      </fieldset>

      <fieldset className="space-y-2 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parts</legend>
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-[2fr_1.5fr_0.7fr_1fr_auto] gap-2">
            <Input aria-label="Part" placeholder="Part" value={p.name} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input aria-label="Part number" placeholder="Part #" value={p.part_number} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, part_number: e.target.value } : x)))} />
            <Input aria-label="Qty" inputMode="decimal" placeholder="Qty" value={p.quantity} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
            <Input aria-label="Price" inputMode="decimal" placeholder="$" value={p.unit_price} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setParts(parts.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setParts([...parts, { name: "", part_number: "", quantity: "1", unit_price: "" }])}>
          <Plus /> Add part
        </Button>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Photos & notes</legend>
        <PhotoUpload bucket="ro-media" value={media} onChange={setMedia} />
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" placeholder="Internal notes" />
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !vehicleId}>
        {pending ? <Loader2 className="animate-spin" /> : roId ? "Save repair order" : "Open repair order"}
      </Button>
    </form>
  );
}
