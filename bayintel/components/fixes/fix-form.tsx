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
import type { FixInput } from "@/lib/fixes/schema";
import { createFixAction, updateFixAction } from "@/app/(app)/fixes/actions";

export interface FixFormVehicle {
  id: string;
  label: string;
  year: number;
  make: string;
  model: string;
  engine: string | null;
  mileage: number | null;
}

export interface FixFormInitial {
  vehicle_id?: string | null;
  repair_order_id?: string | null;
  title?: string;
  year?: number;
  make?: string;
  model?: string;
  engine?: string | null;
  mileage?: number | null;
  symptoms?: string;
  codes?: string[];
  freeze_frame_notes?: string | null;
  tests_performed?: { test: string; result: string }[];
  root_cause?: string;
  fix_description?: string;
  parts?: { name: string; part_number: string | null; brand?: string | null; quantity: number; unit_price: number | null }[];
  labor_hours?: number | null;
  media?: UploadedMedia[];
}

export function FixForm({ vehicles, initial, fixId }: { vehicles: FixFormVehicle[]; initial: FixFormInitial; fixId?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [vehicleId, setVehicleId] = useState(initial.vehicle_id ?? "");
  const [ymme, setYmme] = useState({ year: initial.year?.toString() ?? "", make: initial.make ?? "", model: initial.model ?? "", engine: initial.engine ?? "", mileage: initial.mileage?.toString() ?? "" });
  const [title, setTitle] = useState(initial.title ?? "");
  const [symptoms, setSymptoms] = useState(initial.symptoms ?? "");
  const [codes, setCodes] = useState((initial.codes ?? []).join(" "));
  const [freeze, setFreeze] = useState(initial.freeze_frame_notes ?? "");
  const [tests, setTests] = useState(initial.tests_performed?.length ? initial.tests_performed : [{ test: "", result: "" }]);
  const [rootCause, setRootCause] = useState(initial.root_cause ?? "");
  const [fixDesc, setFixDesc] = useState(initial.fix_description ?? "");
  const [parts, setParts] = useState(
    (initial.parts ?? []).map((p) => ({ name: p.name, part_number: p.part_number ?? "", quantity: String(p.quantity), unit_price: p.unit_price?.toString() ?? "" })),
  );
  const [labor, setLabor] = useState(initial.labor_hours?.toString() ?? "");
  const [media, setMedia] = useState<UploadedMedia[]>(initial.media ?? []);
  const [changeNote, setChangeNote] = useState("");

  function pickVehicle(id: string) {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) setYmme({ year: String(v.year), make: v.make, model: v.model, engine: v.engine ?? "", mileage: v.mileage?.toString() ?? ymme.mileage });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const payload: FixInput = {
      vehicle_id: vehicleId || null,
      repair_order_id: initial.repair_order_id ?? null,
      title,
      year: Number(ymme.year),
      make: ymme.make,
      model: ymme.model,
      engine: ymme.engine || null,
      mileage: ymme.mileage ? Number(ymme.mileage) : null,
      symptoms,
      codes: parseDtcList(codes),
      freeze_frame_notes: freeze || null,
      tests_performed: tests.filter((t) => t.test.trim()),
      root_cause: rootCause,
      fix_description: fixDesc,
      parts: parts.filter((p) => p.name.trim()).map((p) => ({ name: p.name, part_number: p.part_number || null, quantity: Number(p.quantity) || 1, unit_price: p.unit_price ? Number(p.unit_price) : null })),
      labor_hours: labor ? Number(labor) : null,
      media,
      change_note: changeNote || null,
    };
    start(async () => {
      const res = fixId ? await updateFixAction(fixId, payload) : await createFixAction(payload);
      if (res?.error) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const err = (k: string) => (fieldErrors[k] ? <p className="mt-1 text-xs text-destructive">{fieldErrors[k]}</p> : null);

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Section title="Vehicle">
        {vehicles.length > 0 && !fixId && (
          <div>
            <Label htmlFor="vehicle">From your garage</Label>
            <Select id="vehicle" value={vehicleId} onChange={(e) => pickVehicle(e.target.value)}>
              <option value="">Enter manually</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="year">Year</Label>
            <Input id="year" inputMode="numeric" value={ymme.year} onChange={(e) => setYmme({ ...ymme, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} required />
            {err("year")}
          </div>
          <div className="col-span-2">
            <Label htmlFor="make">Make</Label>
            <Input id="make" value={ymme.make} onChange={(e) => setYmme({ ...ymme, make: e.target.value })} required />
            {err("make")}
          </div>
          <div className="col-span-3">
            <Label htmlFor="model">Model</Label>
            <Input id="model" value={ymme.model} onChange={(e) => setYmme({ ...ymme, model: e.target.value })} required />
            {err("model")}
          </div>
          <div className="col-span-2">
            <Label htmlFor="engine">Engine</Label>
            <Input id="engine" value={ymme.engine} onChange={(e) => setYmme({ ...ymme, engine: e.target.value })} placeholder="5.3L V8" />
          </div>
          <div>
            <Label htmlFor="mileage">Mileage</Label>
            <Input id="mileage" inputMode="numeric" value={ymme.mileage} onChange={(e) => setYmme({ ...ymme, mileage: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>
      </Section>

      <Section title="Problem">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="P0300 with lifter tick - collapsed AFM lifters" required />
          {err("title")}
        </div>
        <div>
          <Label htmlFor="symptoms">Symptoms (customer concern + what you observed)</Label>
          <Textarea id="symptoms" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} required />
          {err("symptoms")}
        </div>
        <div>
          <Label htmlFor="codes">DTCs</Label>
          <Input id="codes" value={codes} onChange={(e) => setCodes(e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="P0300 P0301" autoCapitalize="characters" />
          {parseDtcList(codes).length > 0 && <p className="mt-1 text-xs text-muted-foreground">{parseDtcList(codes).join(", ")}</p>}
        </div>
        <div>
          <Label htmlFor="freeze">Freeze-frame notes</Label>
          <Textarea id="freeze" value={freeze} onChange={(e) => setFreeze(e.target.value)} className="min-h-16" placeholder="RPM, load, ECT, fuel trims when the code set" />
        </div>
      </Section>

      <Section title="Tests performed">
        <ul className="space-y-2">
          {tests.map((t, i) => (
            <li key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input aria-label="Test" placeholder="Test" value={t.test} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, test: e.target.value } : x)))} />
              <Input aria-label="Result" placeholder="Result" value={t.result} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove test" onClick={() => setTests(tests.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => setTests([...tests, { test: "", result: "" }])}>
          <Plus /> Add test
        </Button>
      </Section>

      <Section title="Fix">
        <div>
          <Label htmlFor="root">Root cause</Label>
          <Textarea id="root" value={rootCause} onChange={(e) => setRootCause(e.target.value)} className="min-h-16" required />
          {err("root_cause")}
        </div>
        <div>
          <Label htmlFor="fix">What fixed it</Label>
          <Textarea id="fix" value={fixDesc} onChange={(e) => setFixDesc(e.target.value)} required placeholder="What was replaced or repaired, and how you verified the repair." />
          {err("fix_description")}
        </div>
        <div>
          <Label htmlFor="labor">Actual labor time (hours)</Label>
          <Input id="labor" inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value.replace(/[^\d.]/g, ""))} placeholder="1.5" />
        </div>
      </Section>

      <Section title="Parts">
        <ul className="space-y-2">
          {parts.map((p, i) => (
            <li key={i} className="grid grid-cols-[2fr_1.5fr_0.7fr_1fr_auto] gap-2">
              <Input aria-label="Part" placeholder="Part" value={p.name} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input aria-label="Part number" placeholder="Part #" value={p.part_number} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, part_number: e.target.value } : x)))} />
              <Input aria-label="Qty" inputMode="decimal" placeholder="Qty" value={p.quantity} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
              <Input aria-label="Price" inputMode="decimal" placeholder="$" value={p.unit_price} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove part" onClick={() => setParts(parts.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => setParts([...parts, { name: "", part_number: "", quantity: "1", unit_price: "" }])}>
          <Plus /> Add part
        </Button>
      </Section>

      <Section title="Photos">
        <PhotoUpload bucket="fix-media" value={media} onChange={setMedia} />
      </Section>

      {fixId && (
        <Section title="Edit note">
          <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="What changed and why (shown in edit history)" />
        </Section>
      )}

      <p className="text-xs text-muted-foreground">
        By submitting you grant a license to this fix under the terms. Do not paste OEM service manual content, ALLDATA, Mitchell or Identifix text. Describe what you did in your own words.
      </p>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : fixId ? "Save changes" : "Submit confirmed fix"}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}
