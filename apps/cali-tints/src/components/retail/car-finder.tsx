"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ScanLineIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { decodeVinAction, findCarAction, lookupPlateAction } from "@/app/(app)/retail/actions";
import { isVinShape, normalizeVin } from "@/lib/vin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// The barcode engine is ~200 KB; it only loads the first time the scanner opens.
const VinScanner = dynamic(() => import("@/components/jobs/vin-scanner").then((m) => m.VinScanner), { ssr: false });

/**
 * "Find the car": the first thing on a new estimate. A plate or a VIN: a car on file brings its
 * owner and the car with it; a car that is not on file is decoded from its VIN and the estimate
 * starts with it filled in, and the customer is picked below. It only exists on New estimate.
 */
export function CarFinder() {
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [scanner, setScanner] = useState(false);
  const [scannerMounted, setScannerMounted] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

  function lookup(vinOverride?: string) {
    const v = normalizeVin(vinOverride ?? vin);
    if (!plate.trim() && !v) return void toast.error("Type a plate or a VIN");
    if (v && !isVinShape(v)) return void toast.error("A VIN is 17 characters (no I, O or Q)");
    start(async () => {
      const r = await findCarAction({ plate, vin: v });
      if (!r.ok) return void toast.error(r.error);
      if (r.data) {
        const q = new URLSearchParams({ customer: r.data.customer_id, vehicle: r.data.vehicle_id });
        return void router.push(`/retail/estimates/new?${q}`);
      }
      // Not on file: a plate alone may be answered by the shop's plate service (off by default); a VIN is decoded.
      let vinUse = v;
      let decoded = null as Awaited<ReturnType<typeof decodeVinAction>>;
      if (!v && plate.trim()) {
        const p = await lookupPlateAction({ plate });
        if (p.ok && p.data.vin) {
          vinUse = p.data.vin;
          decoded = p.data.decoded;
        }
      }
      if (vinUse && !decoded) decoded = await decodeVinAction(vinUse);
      const q = new URLSearchParams();
      if (vinUse) q.set("vin", vinUse);
      if (plate.trim()) q.set("plate", plate.trim());
      if (decoded?.year) q.set("year", String(decoded.year));
      if (decoded?.make) q.set("make", decoded.make);
      if (decoded?.model) q.set("model", decoded.model);
      if (decoded?.trim) q.set("trim", decoded.trim);
      if (decoded?.engine_size) q.set("engine_size", decoded.engine_size);
      if (decoded?.engine_code) q.set("engine_code", decoded.engine_code);
      setNote(vinUse ? "Not on file: the car is filled in from its VIN. Pick the customer next." : "Not on file and no VIN: type or scan the VIN below.");
      router.push(`/retail/estimates/new${q.size ? `?${q}` : ""}`);
    });
  }

  return (
    <Card data-testid="car-finder">
      <CardHeader>
        <CardTitle>Find the car</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">Type the plate or the VIN: a car on file brings its customer. Or pick the customer below.</p>
        <form
          className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[10rem_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="finder-plate" className="text-caption">License plate</Label>
            <Input id="finder-plate" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="8ABC123" maxLength={12} autoComplete="off" autoCapitalize="characters" data-testid="finder-plate" />
          </div>
          <div className="order-3 col-span-2 grid gap-1 sm:order-none sm:col-span-1">
            <Label htmlFor="finder-vin" className="text-caption">VIN</Label>
            <div className="flex gap-1.5">
              <Input id="finder-vin" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="17 characters" maxLength={20} autoComplete="off" autoCapitalize="characters" className="font-mono" data-testid="finder-vin" />
              <Button type="button" variant="outline" size="icon" aria-label="Scan the VIN" onClick={() => { setScannerMounted(true); setScanner(true); }}>
                <ScanLineIcon />
              </Button>
            </div>
          </div>
          <Button type="submit" loading={pending} className="order-4 col-span-2 w-full sm:order-none sm:col-span-1 sm:w-auto" data-testid="finder-find">
            <SearchIcon /> Find the car
          </Button>
        </form>
        {note && <p className="text-caption text-subtle" data-testid="finder-note">{note}</p>}
        {scannerMounted && (
          <VinScanner
            open={scanner}
            onOpenChange={setScanner}
            onDetected={(v: string) => {
              const n = normalizeVin(v);
              setVin(n);
              setScanner(false);
              if (isVinShape(n)) lookup(n);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
