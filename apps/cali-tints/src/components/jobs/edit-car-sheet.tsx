"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ScanLineIcon } from "lucide-react";
import { toast } from "sonner";
import type { PriceListRow } from "@/lib/db/types";
import type { ActionResult } from "@/app/(app)/jobs/actions";
import type { UpdateJobInput } from "@/lib/jobs/schema";
import { dateInputToIso, toDateInput } from "@/lib/dates";
import { normalizeVin, vinStatus } from "@/lib/vin";
import { COLORS, DEFAULT_MAKE, MAKES, MERCEDES_MODELS, yearOptions } from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServicePicker, type SelectedService } from "./service-picker";
import { ModelCombobox } from "./model-combobox";
// The barcode engine (ZXing) is ~200 KB; it only loads the first time the scanner opens.
const VinScanner = dynamic(() => import("./vin-scanner").then((mod) => mod.VinScanner), { ssr: false });

/** The car as logged: what the edit sheet starts from. */
export interface EditableCar {
  id: string;
  dealership_id: string;
  detailer_id: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  performed_at: string;
  ro_po_number: string | null;
  notes: string | null;
  services: { service_id: string; name: string; price: number; override_reason: string | null }[];
}

/**
 * Bottom sheet to fix a car after it was logged: tag, VIN, year/model/color,
 * date, detailer (admins), services and notes. `save` decides where the
 * change goes (the car's invoice, normally).
 */
export function EditCarSheet({
  car,
  priceList,
  detailers,
  isAdmin,
  title,
  description,
  save,
  onClose,
  onSaved,
}: {
  car: EditableCar;
  priceList: PriceListRow[];
  detailers: { id: string; full_name: string }[];
  isAdmin: boolean;
  title?: string;
  description?: string;
  save: (input: UpdateJobInput) => Promise<ActionResult>;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const listRow = (id: string) => priceList.find((p) => p.service_id === id);
  const listPrice = (id: string) => Number(listRow(id)?.price ?? 0);
  const num = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));

  const [tag, setTag] = useState(car.tag_number);
  const [vin, setVin] = useState(car.vin ?? "");
  const [year, setYear] = useState(car.year ? String(car.year) : "");
  const [make, setMake] = useState(car.make ?? DEFAULT_MAKE);
  const [model, setModel] = useState(car.model ?? "");
  const [color, setColor] = useState(car.color ?? "");
  const [performedAt, setPerformedAt] = useState(toDateInput(new Date(car.performed_at)));
  const [notes, setNotes] = useState(car.notes ?? "");
  const [detailerId, setDetailerId] = useState(car.detailer_id);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMounted, setScannerMounted] = useState(false);
  const [services, setServices] = useState<SelectedService[]>(
    car.services.map((s) => ({
      service_id: s.service_id,
      name: s.name,
      list_price: listPrice(s.service_id),
      price_min: num(listRow(s.service_id)?.price_min),
      price_max: num(listRow(s.service_id)?.price_max),
      price: s.price,
      override_reason: s.override_reason,
    })),
  );

  function submit() {
    if (!tag.trim()) return toast.error("Tag number is required");
    if (vin && vinStatus(vin) === "invalid") return toast.error("VIN must be 17 characters");
    if (services.length === 0) return toast.error("Select at least one service");
    start(async () => {
      const r = await save({
        id: car.id,
        detailer_id: isAdmin ? detailerId : undefined,
        tag_number: tag.trim().toUpperCase(),
        vin: vin ? normalizeVin(vin) : null,
        year: year ? Number(year) : null,
        make: make || null,
        model: model.trim() || null,
        color: color || null,
        // Unchanged date keeps the original timestamp; a new date is stored per dateInputToIso.
        performed_at: performedAt === toDateInput(new Date(car.performed_at)) ? car.performed_at : dateInputToIso(performedAt),
        ro_po_number: car.ro_po_number ?? null,
        notes: notes.trim() || null,
        services: services.map((s) => ({ service_id: s.service_id, price: s.price, override_reason: s.override_reason })),
      });
      if (r.ok) {
        toast.success("Car updated · invoice refreshed");
        onClose();
        onSaved?.();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const modelOptions = make.startsWith("Mercedes") ? MERCEDES_MODELS : [];

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[94dvh] overflow-y-auto sm:mx-auto sm:max-w-2xl sm:rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{title ?? `Edit car ${car.tag_number}`}</SheetTitle>
          <SheetDescription>{description ?? "The invoice keeps its number; its lines and total follow the car."}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="e-tag">Tag</Label>
              <Input id="e-tag" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} autoCapitalize="characters" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-vin">VIN</Label>
              <div className="flex gap-1.5">
                <Input id="e-vin" value={vin} onChange={(e) => setVin(normalizeVin(e.target.value).slice(0, 17))} className="min-w-0 font-mono" maxLength={17} />
                <Button type="button" variant="secondary" size="icon" className="shrink-0" onClick={() => { setScannerMounted(true); setScannerOpen(true); }} aria-label="Scan VIN barcode" title="Scan the VIN barcode">
                  <ScanLineIcon className="size-5" />
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-year">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="e-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions(25).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-make">Make</Label>
              <Select value={make} onValueChange={setMake}>
                <SelectTrigger id="e-make">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAKES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                  {!MAKES.includes(make as (typeof MAKES)[number]) && make && <SelectItem value={make}>{make}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-model">Model</Label>
              <ModelCombobox id="e-model" value={model} onChange={setModel} options={modelOptions} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-color">Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger id="e-color">
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  {!COLORS.includes(color as (typeof COLORS)[number]) && color && <SelectItem value={color}>{color}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} />
            </div>
            {isAdmin && detailers.length > 1 && (
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="e-detailer">Detailer</Label>
                <Select value={detailerId} onValueChange={setDetailerId}>
                  <SelectTrigger id="e-detailer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {detailers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Services</Label>
            <ServicePicker priceList={priceList} value={services} onChange={setServices} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="e-notes">Notes</Label>
            <Textarea id="e-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />
          </div>
        </div>
        {scannerMounted && (
          <VinScanner
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onDetected={(v) => {
              setVin(v);
              toast.success("VIN scanned");
            }}
          />
        )}
        <div className="flex gap-2 px-5 pb-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={pending} onClick={submit}>
            Save changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
