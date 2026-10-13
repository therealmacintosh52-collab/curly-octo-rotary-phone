"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { FixDetail } from "@/lib/db/types";
import { addFixPhotosAction, removeFixPhotoAction, saveFixAction } from "@/app/(app)/intel/actions";
import { useSession } from "@/components/app/session-provider";
import { PhotoPicker, type PendingPhoto } from "@/components/jobs/photo-picker";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseDtcList } from "@/lib/intel/dtc";
import type { FixInput } from "@/lib/intel/fix-schema";

export interface FixFormVehicle {
  id: string;
  label: string;
  year: number;
  make: string;
  model: string;
  engine: string | null;
}

export interface FixFormInitial {
  vehicle_id?: string | null;
  job_id?: string | null;
  title?: string;
  year?: number;
  make?: string;
  model?: string;
  engine?: string | null;
  mileage?: number | null;
  symptoms?: string;
  codes?: string[];
  freeze_frame_notes?: string | null;
  tests?: { test: string; result: string }[];
  root_cause?: string;
  fix_description?: string;
  parts?: { name: string; part_number: string | null; quantity: number; unit_price: number | null }[];
  labor_hours?: number | null;
}

/** Write a fix down once: the car, the codes, what you saw, what you tested, the cause, the fix, the parts and the time it took. */
export function FixForm({ vehicles, initial, fix }: { vehicles: FixFormVehicle[]; initial: FixFormInitial; fix?: FixDetail }) {
  const router = useRouter();
  const { demo, canPrices } = useSession();
  const [pending, start] = useTransition();
  const [vehicleId, setVehicleId] = useState(initial.vehicle_id ?? "");
  const [car, setCar] = useState({ year: initial.year?.toString() ?? "", make: initial.make ?? "", model: initial.model ?? "", engine: initial.engine ?? "", mileage: initial.mileage?.toString() ?? "" });
  const [title, setTitle] = useState(initial.title ?? "");
  const [symptoms, setSymptoms] = useState(initial.symptoms ?? "");
  const [codes, setCodes] = useState((initial.codes ?? []).join(" "));
  const [freeze, setFreeze] = useState(initial.freeze_frame_notes ?? "");
  const [tests, setTests] = useState(initial.tests?.length ? initial.tests : [{ test: "", result: "" }]);
  const [rootCause, setRootCause] = useState(initial.root_cause ?? "");
  const [fixText, setFixText] = useState(initial.fix_description ?? "");
  const [parts, setParts] = useState((initial.parts ?? []).map((p) => ({ name: p.name, part_number: p.part_number ?? "", quantity: String(p.quantity), unit_price: p.unit_price?.toString() ?? "" })));
  const [labor, setLabor] = useState(initial.labor_hours?.toString() ?? "");
  const [changeNote, setChangeNote] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [existing, setExisting] = useState(fix?.media ?? []);
  const parsed = parseDtcList(codes);

  function pickVehicle(id: string) {
    const v = vehicles.find((x) => x.id === id);
    setVehicleId(v ? id : "");
    if (v) setCar((c) => ({ ...c, year: String(v.year), make: v.make, model: v.model, engine: v.engine ?? "" }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: FixInput = {
      id: fix?.id,
      vehicle_id: vehicleId || null,
      job_id: initial.job_id ?? fix?.job_id ?? null,
      title,
      year: Number(car.year),
      make: car.make,
      model: car.model,
      engine: car.engine || null,
      mileage: car.mileage ? Number(car.mileage) : null,
      symptoms,
      codes: parsed,
      freeze_frame_notes: freeze || null,
      tests: tests.filter((t) => t.test.trim()),
      root_cause: rootCause,
      fix_description: fixText,
      parts: parts.filter((p) => p.name.trim()).map((p) => ({ name: p.name, part_number: p.part_number || null, brand: null, quantity: Number(p.quantity) || 1, unit_price: p.unit_price ? Number(p.unit_price) : null })),
      labor_hours: labor ? Number(labor) : null,
      change_note: changeNote || null,
    };
    start(async () => {
      if (demo) {
        toast.success(fix ? "Changes saved" : "Fix saved", { description: "Guest preview — nothing changed" });
        router.push("/intel/fixes");
        return;
      }
      const r = await saveFixAction(payload);
      if (!r.ok) return void toast.error(r.error);
      if (photos.length) {
        const form = new FormData();
        for (const ph of photos) form.append("photo", new File([ph.blob], ph.name || "photo.jpg", { type: "image/jpeg" }));
        const pr = await addFixPhotosAction(r.data.id, form);
        if (!pr.ok) toast.error(`Fix saved, photos not: ${pr.error}`);
      }
      toast.success(fix ? "Changes saved" : "Fix saved");
      router.push(`/intel/fixes/${r.data.id}`);
      router.refresh();
    });
  }

  async function removeExisting(id: string) {
    if (demo) return void toast.success("Photo removed", { description: "Guest preview — nothing changed" });
    const r = await removeFixPhotoAction(id, fix!.id);
    if (!r.ok) return void toast.error(r.error);
    setExisting((m) => m.filter((x) => x.id !== id));
  }

  return (
    <Page narrow>
      <PageHeader eyebrow="Intel · Fixes" title={fix ? "Edit the fix" : "Write down a fix"} description="What you saw, what you tested, what it was and what fixed it, so the next tech starts from here." />
      <form onSubmit={submit} className="mt-6 space-y-6" data-testid="fix-form">
        <Section title="The car">
          {vehicles.length > 0 && !fix && (
            <div>
              <Label htmlFor="fx-vehicle">From the garage</Label>
              <Select value={vehicleId || "none"} onValueChange={(v) => pickVehicle(v === "none" ? "" : v)}>
                <SelectTrigger id="fx-vehicle" className="h-11" data-testid="fix-vehicle">
                  <SelectValue placeholder="Type it in" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Type it in</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Field label="Year" id="fx-year">
              <Input id="fx-year" inputMode="numeric" value={car.year} onChange={(e) => setCar({ ...car, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} required data-testid="fix-year" />
            </Field>
            <Field label="Make" id="fx-make" className="col-span-2">
              <Input id="fx-make" value={car.make} onChange={(e) => setCar({ ...car, make: e.target.value })} required data-testid="fix-make" />
            </Field>
            <Field label="Model" id="fx-model" className="col-span-3">
              <Input id="fx-model" value={car.model} onChange={(e) => setCar({ ...car, model: e.target.value })} required data-testid="fix-model" />
            </Field>
            <Field label="Engine" id="fx-engine" className="col-span-2">
              <Input id="fx-engine" value={car.engine} onChange={(e) => setCar({ ...car, engine: e.target.value })} placeholder="2.5L I4" />
            </Field>
            <Field label="Mileage" id="fx-mileage">
              <Input id="fx-mileage" inputMode="numeric" value={car.mileage} onChange={(e) => setCar({ ...car, mileage: e.target.value.replace(/\D/g, "") })} />
            </Field>
          </div>
        </Section>

        <Section title="The problem">
          <Field label="Title" id="fx-title">
            <Input id="fx-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="P0300 on a cold start, oil-soaked coil boots" required data-testid="fix-title" />
          </Field>
          <Field label="Symptoms (the customer's concern and what you saw)" id="fx-symptoms">
            <Textarea id="fx-symptoms" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} required data-testid="fix-symptoms" />
          </Field>
          <Field label="Trouble codes" id="fx-codes">
            <Input id="fx-codes" value={codes} onChange={(e) => setCodes(e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="P0300 P0301" autoCapitalize="characters" autoCorrect="off" spellCheck={false} data-testid="fix-codes" />
            {parsed.length > 0 && <p className="mt-1 font-mono text-caption text-muted-foreground">{parsed.join(", ")}</p>}
          </Field>
          <Field label="Freeze-frame notes" id="fx-freeze">
            <Textarea id="fx-freeze" value={freeze} onChange={(e) => setFreeze(e.target.value)} className="min-h-16" placeholder="RPM, load, coolant temp and fuel trims when the code set" />
          </Field>
        </Section>

        <Section title="What you tested">
          <ul className="space-y-2">
            {tests.map((t, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input aria-label="Test" placeholder="Test" value={t.test} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, test: e.target.value } : x)))} />
                <Input aria-label="Result" placeholder="Result" value={t.result} onChange={(e) => setTests(tests.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove test" onClick={() => setTests(tests.filter((_, j) => j !== i))}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={() => setTests([...tests, { test: "", result: "" }])}>
            <PlusIcon /> Add a test
          </Button>
        </Section>

        <Section title="The fix">
          <Field label="Root cause" id="fx-root">
            <Textarea id="fx-root" value={rootCause} onChange={(e) => setRootCause(e.target.value)} className="min-h-16" required data-testid="fix-root" />
          </Field>
          <Field label="What fixed it" id="fx-fix">
            <Textarea id="fx-fix" value={fixText} onChange={(e) => setFixText(e.target.value)} required placeholder="What was replaced or repaired, and how you checked it" data-testid="fix-text" />
          </Field>
          <Field label="Actual time it took (hours)" id="fx-labor">
            <Input id="fx-labor" inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value.replace(/[^\d.]/g, ""))} placeholder="1.5" data-testid="fix-labor" />
          </Field>
        </Section>

        <Section title="Parts">
          <ul className="space-y-2">
            {parts.map((p, i) => (
              <li key={i} className={`grid gap-2 ${canPrices ? "grid-cols-[2fr_1.4fr_0.8fr_1fr_auto]" : "grid-cols-[2fr_1.4fr_0.8fr_auto]"}`}>
                <Input aria-label="Part" placeholder="Part" value={p.name} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} data-testid="fix-part-name" />
                <Input aria-label="Part number" placeholder="Part #" value={p.part_number} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, part_number: e.target.value } : x)))} />
                <Input aria-label="Quantity" inputMode="decimal" placeholder="Qty" value={p.quantity} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                {canPrices && <Input aria-label="Price" inputMode="decimal" placeholder="$" value={p.unit_price} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} data-testid="fix-part-price" />}
                <Button type="button" variant="ghost" size="icon" aria-label="Remove part" onClick={() => setParts(parts.filter((_, j) => j !== i))}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={() => setParts([...parts, { name: "", part_number: "", quantity: "1", unit_price: "" }])} data-testid="fix-part-add">
            <PlusIcon /> Add a part
          </Button>
        </Section>

        <Section title="Photos">
          {existing.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {existing.map((m) => (
                <li key={m.id} className="relative size-20 overflow-hidden rounded-lg border border-border bg-muted">
                  {m.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.caption ?? "Photo"} className="size-full object-cover" />
                  )}
                  <button type="button" aria-label="Remove photo" onClick={() => void removeExisting(m.id)} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
                    <Trash2Icon className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <PhotoPicker photos={photos} onChange={setPhotos} disabled={pending} max={Math.max(0, 8 - existing.length)} />
        </Section>

        {fix && (
          <Section title="Edit note">
            <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="What changed and why (kept in the edit history)" maxLength={300} data-testid="fix-change-note" />
          </Section>
        )}

        <Button type="submit" size="lg" className="w-full" loading={pending} data-testid="fix-save">
          {fix ? "Save changes" : "Save the fix"}
        </Button>
      </form>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
      <legend className="px-1 text-label text-subtle">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
