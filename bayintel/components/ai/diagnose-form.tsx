"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseDtcList } from "@/lib/utils";

export interface GarageVehicle {
  id: string;
  label: string;
}

export function DiagnoseForm({ vehicles, initialVehicle, initialCodes }: { vehicles: GarageVehicle[]; initialVehicle: string; initialCodes: string }) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(initialVehicle || vehicles[0]?.id || "");
  const [manual, setManual] = useState({ year: "", make: "", model: "", engine: "" });
  const [symptoms, setSymptoms] = useState("");
  const [codes, setCodes] = useState(initialCodes);
  const [mileage, setMileage] = useState("");
  const [tests, setTests] = useState<{ test: string; result: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId || null,
          vehicle: vehicleId ? undefined : { year: Number(manual.year), make: manual.make, model: manual.model, engine: manual.engine || null },
          symptoms,
          codes: parseDtcList(codes),
          tests: tests.filter((t) => t.test.trim()),
          mileage: mileage ? Number(mileage) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      router.push(`/assistant/${json.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <Label htmlFor="vehicle">Vehicle</Label>
          <Select id="vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Enter year / make / model</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
        {!vehicleId && (
          <div className="grid grid-cols-3 gap-2">
            <Input aria-label="Year" placeholder="Year" inputMode="numeric" value={manual.year} onChange={(e) => setManual({ ...manual, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} required />
            <Input aria-label="Make" placeholder="Make" value={manual.make} onChange={(e) => setManual({ ...manual, make: e.target.value })} required />
            <Input aria-label="Model" placeholder="Model" value={manual.model} onChange={(e) => setManual({ ...manual, model: e.target.value })} required />
            <Input aria-label="Engine" placeholder="Engine (optional)" className="col-span-3" value={manual.engine} onChange={(e) => setManual({ ...manual, engine: e.target.value })} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="codes">DTCs</Label>
            <Input id="codes" value={codes} onChange={(e) => setCodes(e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="P0300 P0171" autoCapitalize="characters" />
          </div>
          <div>
            <Label htmlFor="mileage">Mileage</Label>
            <Input id="mileage" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        <div>
          <Label htmlFor="symptoms">Symptoms and conditions</Label>
          <Textarea id="symptoms" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} required placeholder="What the customer reports, when it happens (cold/hot, idle/load), what you've observed, freeze-frame highlights." />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <Label>Tests already performed (optional)</Label>
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
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="animate-spin" /> Retrieving fixes, complaints, recalls…
          </>
        ) : (
          <>
            <Sparkles /> Diagnose
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">Grounded only in this database (confirmed fixes, DTC definitions, NHTSA recalls and complaints). The assistant never generates torque specs, capacities, pinouts or calibration values.</p>
    </form>
  );
}
