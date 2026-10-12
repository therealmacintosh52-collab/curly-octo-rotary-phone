"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Camera, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SourceBadge } from "@/components/source-badge";
import { normalizeVin } from "@/lib/utils";
import type { DecodedVehicle } from "@/lib/providers/types";
import { saveVehicleAction } from "@/app/(app)/garage/actions";

const VinScanner = dynamic(() => import("./vin-scanner").then((m) => m.VinScanner), { ssr: false });

const YEARS = Array.from({ length: new Date().getFullYear() + 2 - 1981 }, (_, i) => new Date().getFullYear() + 1 - i);

export function VehicleLookup() {
  const [vin, setVin] = useState("");
  const [scanning, setScanning] = useState(false);
  const [decoded, setDecoded] = useState<DecodedVehicle | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const decode = useCallback(async (value: string) => {
    const v = normalizeVin(value);
    setVin(v);
    setError(null);
    setWarning(null);
    setDecoded(null);
    if (v.length !== 17) return setError("A VIN is 17 characters (no I, O or Q).");
    setBusy(true);
    try {
      const res = await fetch("/api/vehicles/decode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vin: v }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Decode failed");
      if (!json.usable) {
        setError(json.decoded?.errorText ? `NHTSA could not decode this VIN: ${json.decoded.errorText}` : "NHTSA could not decode this VIN. Try Year/Make/Model.");
        return;
      }
      if (!json.checkDigitOk) setWarning("Check digit does not match. Double-check the VIN (non-North-American VINs can still be valid).");
      setDecoded(json.decoded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decode failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const onScanned = useCallback(
    (v: string) => {
      setScanning(false);
      void decode(v);
    },
    [decode],
  );

  function save(vehicle: Parameters<typeof saveVehicleAction>[0]) {
    setError(null);
    startTransition(async () => {
      const res = await saveVehicleAction(vehicle);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <Tabs defaultValue="vin">
      <TabsList>
        <TabsTrigger value="vin">VIN</TabsTrigger>
        <TabsTrigger value="ymm">Year / Make / Model</TabsTrigger>
      </TabsList>

      <TabsContent value="vin" className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void decode(vin);
          }}
        >
          <Input
            aria-label="VIN"
            value={vin}
            onChange={(e) => setVin(normalizeVin(e.target.value).slice(0, 17))}
            placeholder="17-character VIN"
            className="font-mono uppercase tracking-wider"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={17}
            inputMode="text"
          />
          <Button type="button" variant="outline" size="icon" aria-label="Scan VIN barcode" onClick={() => setScanning(true)}>
            <Camera />
          </Button>
          <Button type="submit" size="icon" aria-label="Decode" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Search />}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">{vin.length}/17 · Decoded by NHTSA vPIC (public data), cached 24h.</p>

        <Dialog open={scanning} onOpenChange={setScanning}>
          <DialogContent title="Scan VIN barcode">{scanning && <VinScanner onVin={onScanned} onClose={() => setScanning(false)} />}</DialogContent>
        </Dialog>

        {warning && (
          <Alert variant="warning">
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {decoded && (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">
                    {decoded.year} {decoded.make} {decoded.model}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[decoded.trim, decoded.engine, decoded.driveType, decoded.bodyClass].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <SourceBadge source="NHTSA" />
              </div>
              <Button
                className="w-full"
                disabled={pending}
                onClick={() =>
                  save({
                    vin: decoded.vin,
                    year: decoded.year!,
                    make: decoded.make,
                    model: decoded.model,
                    trim: decoded.trim,
                    engine: decoded.engine,
                    displacement_l: decoded.displacementL,
                    cylinders: decoded.cylinders,
                    fuel_type: decoded.fuelType,
                    drive_type: decoded.driveType,
                    body_class: decoded.bodyClass,
                    transmission: decoded.transmission,
                    plant: decoded.plant,
                    specs: decoded.specs,
                    specs_source: "NHTSA",
                  })
                }
              >
                {pending ? <Loader2 className="animate-spin" /> : "Save to garage & open dashboard"}
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="ymm">
        <YmmForm onSave={save} pending={pending} error={error} />
      </TabsContent>
    </Tabs>
  );
}

function YmmForm({ onSave, pending, error }: { onSave: (v: Parameters<typeof saveVehicleAction>[0]) => void; pending: boolean; error: string | null }) {
  const [year, setYear] = useState<number>(YEARS[2]);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [engine, setEngine] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading("makes");
    setFetchError(null);
    fetch(`/api/vehicles/makes?year=${year}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j.makes as string[];
      })
      .then((m) => !cancelled && setMakes(m))
      .catch((e) => !cancelled && setFetchError(`${e.message}. You can still type the make and model manually.`))
      .finally(() => !cancelled && setLoading(null));
    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    if (!make) return setModels([]);
    let cancelled = false;
    setLoading("models");
    fetch(`/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j.models as string[];
      })
      .then((m) => !cancelled && setModels(m))
      .catch(() => !cancelled && setModels([]))
      .finally(() => !cancelled && setLoading(null));
    return () => {
      cancelled = true;
    };
  }, [year, make]);

  const manual = fetchError !== null || (makes.length === 0 && loading === null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!make || !model) return;
        onSave({ vin: null, year, make, model, engine: engine || null, specs: {}, specs_source: "OWNER" });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="year">Year</Label>
          <Select id="year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="engine">Engine</Label>
          <Input id="engine" value={engine} onChange={(e) => setEngine(e.target.value)} placeholder="e.g. 5.3L V8" />
        </div>
      </div>
      <div>
        <Label htmlFor="make">Make {loading === "makes" && <Loader2 className="ml-1 inline size-3 animate-spin" />}</Label>
        {manual ? (
          <Input id="make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Ford" required />
        ) : (
          <Select id="make" value={make} onChange={(e) => { setMake(e.target.value); setModel(""); }} required>
            <option value="">Select make</option>
            {makes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div>
        <Label htmlFor="model">Model {loading === "models" && <Loader2 className="ml-1 inline size-3 animate-spin" />}</Label>
        {manual || (make && models.length === 0 && loading === null) ? (
          <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="F-150" required />
        ) : (
          <Select id="model" value={model} onChange={(e) => setModel(e.target.value)} required disabled={!make}>
            <option value="">Select model</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        )}
      </div>
      {fetchError && <p className="text-xs text-warning">{fetchError}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={pending || !make || !model}>
        {pending ? <Loader2 className="animate-spin" /> : "Save to garage & open dashboard"}
      </Button>
      <p className="text-xs text-muted-foreground">Make/model lists come from NHTSA vPIC. Specs entered this way are labeled Owner-reported.</p>
    </form>
  );
}
