"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { RetailCatalog, RetailCatalogService, Slot, VehicleSize } from "@/lib/db/types";
import { bookAppointmentAction, findSlotsAction } from "@/app/(app)/retail/appointments/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { quoteTotal, type QuoteModifier, type QuoteService } from "@/lib/retail/quote";
import { SIZE_CLASSES, SIZE_LABEL } from "@/lib/retail/size-class";
import { durationLabel } from "@/lib/retail/slots";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CustomerPicker, type CustomerPick, type PickedCustomer } from "./customer-picker";
import { SlotPicker } from "./slot-picker";

export interface EstimateForBooking {
  id: string;
  display_number: string;
  customer: string;
  vehicle: string | null;
  lines: { service_id: string; qty: number; label: string; price: number | null; modifiers: string[] }[];
  size_class: VehicleSize;
}

/**
 * Staff book an appointment: whose car, which services (priced by size),
 * when (from the same slot engine), a note. From an approved estimate the
 * customer, car and lines are already decided.
 */
export function AppointmentSheet({ open, onOpenChange, catalog, recent, tz, estimate, initialPick }: { open: boolean; onOpenChange: (o: boolean) => void; catalog: RetailCatalog; recent: PickedCustomer[]; tz: string; estimate?: EstimateForBooking | null; initialPick?: CustomerPick | null }) {
  const router = useRouter();
  const { demo, canPrices } = useSession();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState<CustomerPick>(initialPick ?? { customer: null, vehicleId: null });
  const pickedVehicle = pick.customer?.vehicles.find((v) => v.id === pick.vehicleId) ?? null;
  const [size, setSize] = useState<VehicleSize>(estimate?.size_class ?? pickedVehicle?.size_class ?? "sedan");
  const [services, setServices] = useState<string[]>([]);
  const [mods, setMods] = useState<string[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const menu = useMemo(() => catalog.services.filter((s) => s.active && s.retail && !s.open_amount).sort((a, b) => a.sort_order - b.sort_order), [catalog.services]);
  const lines = useMemo(() => (estimate ? estimate.lines : services.map((id, i) => ({ service_id: id, qty: 1, label: null, price: null, modifiers: i === 0 ? mods : [] }))), [estimate, services, mods]);

  const quote = useMemo(() => {
    if (!lines.length) return null;
    try {
      const qc = { services: catalog.services.map<QuoteService>((s) => ({ id: s.id, name: s.name, duration_minutes: s.duration_minutes, taxable: s.taxable, placeholder: s.placeholder, open_amount: s.open_amount, prices: s.prices ?? {}, default_price: s.default_price })), modifiers: catalog.modifiers.map<QuoteModifier>((m) => ({ code: m.code, label: m.label, kind: m.kind, amount: Number(m.amount), active: m.active })), taxRate: Number(catalog.tax_rate ?? 0), taxAllLines: !!catalog.settings?.tax_all_lines };
      return quoteTotal({ size, lines }, qc);
    } catch {
      return null;
    }
  }, [lines, size, catalog]);

  const fetchSlots = useCallback(
    async (from: string, to: string) => {
      if (!lines.length) return { ok: true as const, data: [] };
      if (demo) return { ok: true as const, data: demoSlots(from, tz) };
      return findSlotsAction(lines, from, to);
    },
    [lines, demo, tz],
  );

  function toggle(s: RetailCatalogService) {
    setServices((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]));
    setSlot(null);
  }

  function submit() {
    if (!estimate && !pick.customer) return void toast.error("Pick the customer");
    if (!lines.length) return void toast.error("Pick at least one service");
    if (!slot) return void toast.error("Pick a time");
    start(async () => {
      if (demo) {
        toast.success("Booked", { description: "Guest preview — nothing changed" });
        onOpenChange(false);
        router.push("/retail/appointments/a0000000-0000-4000-8000-000000000001");
        return;
      }
      const r = await bookAppointmentAction(estimate ? { estimate_id: estimate.id, starts_at: slot.starts_at, notes } : { customer_id: pick.customer!.id, vehicle_id: pick.vehicleId, lines, starts_at: slot.starts_at, notes, size_class: size });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Booked ${r.data.display_number}`);
      onOpenChange(false);
      router.push(`/retail/appointments/${r.data.id}`);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[94dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{estimate ? `Schedule ${estimate.display_number}` : "New appointment"}</SheetTitle>
          <SheetDescription>{estimate ? `${estimate.customer}${estimate.vehicle ? ` · ${estimate.vehicle}` : ""} · the approved services` : "Whose car, what service, when. The engine only offers times with a free bay, lift and tech."}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6" data-testid="appointment-sheet">
          {!estimate && (
            <>
              <CustomerPicker value={pick} onChange={(v) => { setPick(v); setSlot(null); }} carDraft={{ vin: "", year: "", make: "", model: "", color: "" }} recent={recent} onVehiclePicked={(v) => { if (v.size_class) setSize(v.size_class); }} />
              <div className="grid gap-1.5">
                <Label htmlFor="ap-size">Priced as</Label>
                <Select value={size} onValueChange={(v) => setSize(v as VehicleSize)}>
                  <SelectTrigger id="ap-size" aria-label="Size class" className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZE_CLASSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label} <span className="text-muted-foreground">· {s.hint}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Services</Label>
                <div className="flex flex-wrap gap-2" data-testid="appointment-chips">
                  {menu.map((s) => {
                    const on = services.includes(s.id);
                    const price = canPrices ? (s.prices?.[size] ?? s.default_price) : null;
                    return (
                      <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors", on ? "border-primary bg-accent-soft text-primary" : "border-border bg-card hover:border-border-strong")}>
                        {on && <CheckIcon className="size-3.5" />}
                        {s.name}
                        <span className="text-caption text-muted-foreground">{durationLabel(s.duration_minutes)}</span>
                        {price !== null && price !== undefined && <span className={cn("tabular-nums", on ? "text-primary/80" : "text-muted-foreground")}>{formatMoney(price)}</span>}
                      </button>
                    );
                  })}
                </div>
                {services.length > 0 && catalog.modifiers.some((m) => m.active) && (
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.modifiers.filter((m) => m.active).map((m) => {
                      const on = mods.includes(m.code);
                      return (
                        <button key={m.code} type="button" aria-pressed={on} onClick={() => setMods((prev) => (on ? prev.filter((c) => c !== m.code) : [...prev, m.code]))} className={cn("rounded-full border px-2.5 py-1 text-caption transition-colors", on ? "border-warning/50 bg-warning/12 text-warning" : "border-border text-muted-foreground hover:border-border-strong")}>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
          {quote && (
            <p className="text-sm text-muted-foreground" data-testid="appointment-quote">
              {durationLabel(quote.duration_minutes)}{canPrices ? ` · ${formatMoney(quote.total)}` : ""}{estimate ? "" : ` · priced as ${SIZE_LABEL[size]}`}
            </p>
          )}
          <div className="grid gap-2">
            <Label>When</Label>
            {lines.length ? <SlotPicker tz={tz} fetchSlots={fetchSlots} value={slot} onChange={setSlot} maxDaysAhead={catalog.settings?.max_days_ahead ?? 60} /> : <p className="text-sm text-muted-foreground">Pick the services first; the times depend on them.</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ap-notes">Notes (staff)</Label>
            <Textarea id="ap-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" placeholder="Keys in the drop box, bring the second key…" />
          </div>
          <Button size="lg" onClick={submit} loading={pending} data-testid="appointment-book">
            Book it
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Guest preview: open mornings on weekdays, nothing on Sundays. */
export function demoSlots(from: string, tz: string): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = from.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d + i));
    if (day.getUTCDay() === 0) continue;
    for (const h of [8, 9, 10, 13]) {
      const local = new Date(Date.UTC(y, m - 1, d + i, h, 0));
      // Pacific is UTC-7 or -8; the preview assumes the shop's zone for display, not the maths.
      const offset = tz === "America/Los_Angeles" ? 7 : 0;
      const start = new Date(local.getTime() + offset * 3600000);
      if (start.getTime() < Date.now() + 2 * 3600000) continue;
      out.push({ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 4 * 3600000).toISOString() });
    }
  }
  return out;
}
