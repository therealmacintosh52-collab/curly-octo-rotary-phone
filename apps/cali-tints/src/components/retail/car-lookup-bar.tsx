"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CarFrontIcon, FileTextIcon, ScanLineIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { FoundVehicle } from "@/lib/db/types";
import { decodeVinAction, findCarAction } from "@/app/(app)/retail/actions";
import { isVinShape, normalizeVin, vinStatus } from "@/lib/vin";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// The barcode engine is ~200 KB; it only loads the first time the scanner opens.
const VinScanner = dynamic(() => import("@/components/jobs/vin-scanner").then((m) => m.VinScanner), { ssr: false });

type Result = { kind: "found"; car: FoundVehicle } | { kind: "new"; vin: string; plate: string; year?: number | null; make?: string | null; model?: string | null };

/**
 * The bar at the top of Retail: the car in front of you. Type the plate or the
 * VIN (and the mileage on the dash); a car on file opens its owner and starts
 * an estimate with the mileage filled in, a new one is decoded from its VIN
 * and the estimate starts with "add this car".
 */
export function CarLookupBar() {
  const { canPrices } = useSession();
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [miles, setMiles] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scanner, setScanner] = useState(false);
  const [scannerMounted, setScannerMounted] = useState(false);
  const [pending, start] = useTransition();
  const vinNorm = normalizeVin(vin);
  const vinState = vinStatus(vin);
  const odometer = miles.replace(/[^\d]/g, "");

  function lookup(vinOverride?: string) {
    const v = normalizeVin(vinOverride ?? vin);
    if (!plate.trim() && !v) return void toast.error("Type a plate or a VIN");
    if (v && !isVinShape(v)) return void toast.error("A VIN is 17 characters (no I, O or Q)");
    start(async () => {
      const r = await findCarAction({ plate, vin: v });
      if (!r.ok) return void toast.error(r.error);
      if (r.data) return void setResult({ kind: "found", car: r.data });
      // Not on file: decode the VIN so the estimate starts with the car filled in.
      const decoded = v ? await decodeVinAction(v) : null;
      setResult({ kind: "new", vin: v, plate: plate.trim(), year: decoded?.year, make: decoded?.make, model: decoded?.model });
    });
  }

  function estimateHref(): string {
    if (!result) return "/retail/estimates/new";
    const q = new URLSearchParams();
    if (result.kind === "found") {
      q.set("customer", result.car.customer_id);
      q.set("vehicle", result.car.vehicle_id);
    } else {
      if (result.vin) q.set("vin", result.vin);
      if (result.plate) q.set("plate", result.plate);
      if (result.year) q.set("year", String(result.year));
      if (result.make) q.set("make", result.make);
      if (result.model) q.set("model", result.model);
    }
    if (odometer) q.set("odometer", odometer);
    return `/retail/estimates/new?${q}`;
  }

  function clear() {
    setPlate("");
    setVin("");
    setMiles("");
    setResult(null);
  }

  return (
    <section className="mt-3 rounded-xl border border-border bg-card p-3" aria-label="Find the car" data-testid="car-bar">
      <form
        className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[9rem_1fr_8rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <div className="grid gap-1">
          <Label htmlFor="car-plate" className="text-caption">License plate</Label>
          <Input id="car-plate" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="8ABC123" maxLength={12} autoComplete="off" autoCapitalize="characters" data-testid="car-plate" />
        </div>
        <div className="order-3 col-span-2 grid gap-1 sm:order-none sm:col-span-1">
          <Label htmlFor="car-vin" className="text-caption">VIN</Label>
          <div className="flex gap-1.5">
            <Input id="car-vin" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="17 characters" maxLength={20} autoComplete="off" autoCapitalize="characters" className="font-mono" aria-invalid={vinState === "invalid"} data-testid="car-vin" />
            <Button type="button" variant="outline" size="icon" aria-label="Scan the VIN" onClick={() => { setScannerMounted(true); setScanner(true); }}>
              <ScanLineIcon />
            </Button>
          </div>
        </div>
        <div className="grid gap-1 sm:order-none">
          <Label htmlFor="car-miles" className="text-caption">Mileage</Label>
          <Input id="car-miles" inputMode="numeric" value={miles} onChange={(e) => setMiles(e.target.value.replace(/[^\d]/g, ""))} placeholder="84200" autoComplete="off" data-testid="car-miles" />
        </div>
        <Button type="submit" loading={pending} className="order-4 col-span-2 w-full sm:order-none sm:col-span-1 sm:w-auto" data-testid="car-find">
          <SearchIcon /> Find the car
        </Button>
      </form>

      {result && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between" data-testid="car-result" data-kind={result.kind}>
          <div className="min-w-0 text-sm">
            {result.kind === "found" ? (
              <>
                <div className="truncate font-semibold">{[result.car.name, result.car.color].filter(Boolean).join(" · ") || "Vehicle"}</div>
                <div className="truncate text-muted-foreground">
                  {result.car.customer ?? "Customer"}
                  {result.car.plate ? ` · ${result.car.plate}` : ""}
                  {result.car.last_odometer ? ` · last seen at ${result.car.last_odometer.toLocaleString()} mi` : ""}
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold">Not on file yet{[result.year, result.make, result.model].filter(Boolean).length ? ` · ${[result.year, result.make, result.model].filter(Boolean).join(" ")}` : ""}</div>
                <div className="text-muted-foreground">Start an estimate and add the car to its owner there.</div>
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canPrices && (
              <Button asChild size="sm">
                <Link href={estimateHref()} data-testid="car-new-estimate">
                  <FileTextIcon /> New estimate{odometer ? ` · ${Number(odometer).toLocaleString()} mi` : ""}
                </Link>
              </Button>
            )}
            {result.kind === "found" && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/retail/vehicles/${result.car.vehicle_id}`} data-testid="car-open">
                  <CarFrontIcon /> Open the car
                </Link>
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={clear} aria-label="Clear">
              <XIcon />
            </Button>
          </div>
        </div>
      )}
      {scannerMounted && (
        <VinScanner
          open={scanner}
          onOpenChange={setScanner}
          onDetected={(v) => {
            setVin(v);
            setScanner(false);
            lookup(v);
          }}
        />
      )}
      {vinNorm.length > 0 && vinState === "invalid" && <p className="mt-1 text-caption text-destructive">A VIN is 17 characters, with no I, O or Q.</p>}
    </section>
  );
}
