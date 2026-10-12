"use client";

import { useCallback, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CheckIcon, LoaderCircleIcon, ScanLineIcon } from "lucide-react";
import { toast } from "sonner";
import type { Vehicle, VehicleSize } from "@/lib/db/types";
import { saveVehicleAction } from "@/app/(app)/retail/actions";
import { useSession } from "@/components/app/session-provider";
import { decodeVin } from "@/lib/vin-client";
import { normalizeVin, vinStatus } from "@/lib/vin";
import { COLORS, yearOptions } from "@/lib/vehicles";
import { SIZE_CLASSES, sizeClassForBody } from "@/lib/retail/size-class";
import { cn, errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hint, Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// The barcode engine (ZXing) is ~200 KB; it only loads the first time the scanner opens.
const VinScanner = dynamic(() => import("@/components/jobs/vin-scanner").then((mod) => mod.VinScanner), { ssr: false });

export interface VehicleDraft {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  body_class: string;
  size_class: VehicleSize | "";
  color: string;
  plate: string;
  odometer: string;
  notes: string;
}

export const EMPTY_VEHICLE: VehicleDraft = { vin: "", year: "", make: "", model: "", trim: "", body_class: "", size_class: "", color: "", plate: "", odometer: "", notes: "" };

export function vehicleToDraft(v: Partial<Vehicle>): VehicleDraft {
  return {
    vin: v.vin ?? "",
    year: v.year ? String(v.year) : "",
    make: v.make ?? "",
    model: v.model ?? "",
    trim: v.trim ?? "",
    body_class: v.body_class ?? "",
    size_class: v.size_class ?? "",
    color: v.color ?? "",
    plate: v.plate ?? "",
    odometer: "",
    notes: v.notes ?? "",
  };
}

/**
 * A customer's car. Scan or type the VIN and NHTSA fills year, make, model,
 * trim and the body class, which picks the size class (what retail pricing
 * keys on); the size stays editable. Mileage logged here starts the
 * odometer history.
 */
export function VehicleForm({
  customerId,
  vehicle,
  initial,
  onSaved,
  onCancel,
}: {
  customerId: string;
  vehicle?: Vehicle | null;
  /** Prefill for a new vehicle (the car typed on New job). */
  initial?: Partial<VehicleDraft>;
  onSaved?: (v: Vehicle) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { demo } = useSession();
  const [d, setD] = useState<VehicleDraft>(() => ({ ...(vehicle ? vehicleToDraft(vehicle) : EMPTY_VEHICLE), ...(initial ?? {}) }));
  const [sizeTouched, setSizeTouched] = useState(!!vehicle && vehicle.size_class_source === "manual");
  const [decoding, setDecoding] = useState(false);
  const [decoded, setDecoded] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMounted, setScannerMounted] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof VehicleDraft>(k: K, v: VehicleDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const vinState = vinStatus(d.vin);
  const autoSize = sizeClassForBody(d.body_class || null);
  const size: VehicleSize = d.size_class || autoSize;

  const applyDecode = useCallback(
    async (v: string) => {
      setDecoding(true);
      try {
        const r = await decodeVin(v);
        setD((x) => ({
          ...x,
          year: r.year ? String(r.year) : x.year,
          make: r.make ?? x.make,
          model: r.model ?? x.model,
          trim: r.trim ?? x.trim,
          body_class: r.bodyClass ?? x.body_class,
          size_class: sizeTouched ? x.size_class : "",
        }));
        const label = [r.year, r.make, r.model].filter(Boolean).join(" ");
        setDecoded(label || null);
        if (!label) toast.warning("NHTSA could not decode that VIN. Fill in year / make / model by hand.");
      } catch (err) {
        setDecoded(null);
        toast.warning(navigator.onLine ? errorMessage(err, "VIN lookup failed") : "Offline: VIN saved, the rest can be filled by hand");
      } finally {
        setDecoding(false);
      }
    },
    [sizeTouched],
  );

  function onVinChange(raw: string) {
    const v = normalizeVin(raw).slice(0, 17);
    set("vin", v);
    setDecoded(null);
    if (v.length === 17 && vinStatus(v) !== "invalid") void applyDecode(v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.model.trim() && !d.vin && !d.plate.trim()) {
      toast.error("A model, VIN or plate is required");
      return;
    }
    if (d.vin && vinState === "invalid") {
      toast.error("VIN must be 17 characters (no I, O or Q)");
      return;
    }
    start(async () => {
      if (demo) {
        toast.success("Saved · guest preview, not actually saved");
        onSaved?.({ ...(vehicle ?? ({} as Vehicle)), id: vehicle?.id ?? "demo", customer_id: customerId, vin: d.vin || null, year: d.year ? Number(d.year) : null, make: d.make || null, model: d.model || null, size_class: size, color: d.color || null, plate: d.plate || null } as Vehicle);
        return;
      }
      const r = await saveVehicleAction({
        id: vehicle?.id,
        customer_id: customerId,
        vin: d.vin || null,
        year: d.year ? Number(d.year) : null,
        make: d.make || null,
        model: d.model || null,
        trim: d.trim || null,
        body_class: d.body_class || null,
        // Only an explicit choice is sent as manual; otherwise the server derives it from the body class.
        size_class: sizeTouched ? size : undefined,
        color: d.color || null,
        plate: d.plate || null,
        notes: d.notes || null,
        odometer: d.odometer ? Number(d.odometer.replace(/\D/g, "")) : null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(vehicle ? "Saved" : "Vehicle added");
      onSaved?.(r.data);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid="vehicle-form">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="v-vin">VIN (optional)</Label>
          {vinState === "warn" && <Hint tone="warning">Check digit does not match</Hint>}
          {vinState === "invalid" && <Hint tone="error">17 characters, no I / O / Q</Hint>}
        </div>
        <div className="flex gap-2">
          <Input id="v-vin" value={d.vin} onChange={(e) => onVinChange(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={17} placeholder="Scan or type 17 characters" className={cn("font-mono tracking-wide uppercase placeholder:font-sans placeholder:normal-case placeholder:tracking-normal", vinState === "valid" && "border-success/60")} aria-invalid={vinState === "invalid"} />
          <Button type="button" variant="secondary" className="shrink-0 px-3" onClick={() => { setScannerMounted(true); setScannerOpen(true); }} aria-label="Scan VIN barcode">
            {decoding ? <LoaderCircleIcon className="animate-spin" /> : <ScanLineIcon className="size-5" />} Scan
          </Button>
        </div>
        {decoded && (
          <p className="flex items-center gap-1.5 text-caption text-success">
            <CheckIcon className="size-4" /> Decoded: {decoded}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="v-year">Year</Label>
          <Select value={d.year} onValueChange={(v) => set("year", v)}>
            <SelectTrigger id="v-year" aria-label="Year">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions().map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-make">Make</Label>
          <Input id="v-make" value={d.make} onChange={(e) => set("make", e.target.value)} placeholder="Toyota" autoComplete="off" autoCapitalize="words" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-model">Model</Label>
          <Input id="v-model" value={d.model} onChange={(e) => set("model", e.target.value)} placeholder="Camry" autoComplete="off" autoCapitalize="words" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="v-size">Size (for pricing)</Label>
          <Select
            value={size}
            onValueChange={(v) => {
              setSizeTouched(true);
              set("size_class", v as VehicleSize);
            }}
          >
            <SelectTrigger id="v-size" aria-label="Size class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_CLASSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label} <span className="text-muted-foreground">· {s.hint}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!sizeTouched && d.body_class && <p className="text-caption text-subtle">From the VIN: {d.body_class}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-color">Color</Label>
          <Select value={d.color} onValueChange={(v) => set("color", v)}>
            <SelectTrigger id="v-color" aria-label="Color">
              <SelectValue placeholder="Color" />
            </SelectTrigger>
            <SelectContent>
              {COLORS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-plate">Plate</Label>
          <Input id="v-plate" value={d.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} placeholder="8ABC123" autoComplete="off" autoCapitalize="characters" className="font-mono uppercase" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="grid gap-1.5">
          <Label htmlFor="v-odo">Mileage today</Label>
          <Input id="v-odo" inputMode="numeric" value={d.odometer} onChange={(e) => set("odometer", e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 84200" autoComplete="off" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="v-notes">Notes</Label>
          <Textarea id="v-notes" value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Pre-existing scratch on rear bumper, tint on rear glass…" className="min-h-10" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={pending} data-testid="vehicle-save">
          {vehicle ? "Save" : "Add vehicle"}
        </Button>
      </div>
      {scannerMounted && <VinScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={(v) => { set("vin", v); setDecoded(null); void applyDecode(v); toast.success("VIN scanned"); }} />}
    </form>
  );
}
