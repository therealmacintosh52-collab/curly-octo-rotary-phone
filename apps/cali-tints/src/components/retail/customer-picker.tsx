"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckIcon, PlusIcon, SearchIcon, UserIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Customer, CustomerListRow, Vehicle } from "@/lib/db/types";
import { saveVehicleAction, searchCustomersAction } from "@/app/(app)/retail/actions";
import { useSession } from "@/components/app/session-provider";
import { formatPhone } from "@/lib/retail/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CustomerForm } from "./customer-form";

/** What the New job form knows about the car so far; becomes the vehicle record. */
export interface VehicleDraftFromJob {
  vin: string;
  year: string;
  make: string;
  model: string;
  color: string;
}

export interface PickedCustomer {
  id: string;
  name: string;
  phone: string | null;
  vehicles: (Pick<Vehicle, "id" | "year" | "make" | "model" | "color" | "vin" | "plate"> & { size_class?: Vehicle["size_class"] })[];
}

export interface CustomerPick {
  customer: PickedCustomer | null;
  vehicleId: string | null;
}

/**
 * On New job at the shop: who is the car for? Search by phone or name, pick
 * one of their cars (or add the car typed above as a new vehicle), or add a
 * new customer without leaving the form. Fixture rows power the guest demo.
 */
export function CustomerPicker({
  value,
  onChange,
  carDraft,
  onVehiclePicked,
  recent,
}: {
  value: CustomerPick;
  onChange: (v: CustomerPick) => void;
  /** The car as typed on the form: offered as "add as their vehicle" and filled back from a picked vehicle. */
  carDraft: VehicleDraftFromJob;
  onVehiclePicked?: (v: PickedCustomer["vehicles"][number]) => void;
  /** Recent customers (server) or fixture customers (demo) so the first tap shows faces. */
  recent: PickedCustomer[];
}) {
  const { demo } = useSession();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<{ q: string; rows: PickedCustomer[] }>({ q: "", rows: [] });
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server search, debounced; its result is only used while the query it answered is still the one typed.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const text = q.trim();
    if (!text || demo) return;
    timer.current = setTimeout(() => {
      start(async () => {
        const r = await searchCustomersAction(text);
        if (r.ok) setRemote({ q: text, rows: r.data.map(fromRow) });
        else toast.error(r.error);
      });
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, demo]);

  const hits = useMemo(() => {
    const text = q.trim();
    if (!text) return recent;
    if (demo) {
      const t = text.toLowerCase();
      const digits = t.replace(/\D/g, "");
      return recent.filter((r) => r.name.toLowerCase().includes(t) || (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits)) || r.vehicles.some((v) => [v.year, v.make, v.model].join(" ").toLowerCase().includes(t)));
    }
    return remote.q === text ? remote.rows : [];
  }, [q, demo, recent, remote]);

  const c = value.customer;
  const vehicle = c?.vehicles.find((v) => v.id === value.vehicleId) ?? null;

  function pickCustomer(p: PickedCustomer) {
    const only = p.vehicles.length === 1 ? p.vehicles[0] : null;
    onChange({ customer: p, vehicleId: only?.id ?? null });
    if (only) onVehiclePicked?.(only);
    setOpen(false);
    setQ("");
  }

  function addCarAsVehicle() {
    if (!c) return;
    start(async () => {
      if (demo) {
        const v = { id: `demo-v-${Date.now()}`, year: carDraft.year ? Number(carDraft.year) : null, make: carDraft.make || null, model: carDraft.model || null, color: carDraft.color || null, vin: carDraft.vin || null, plate: null };
        const next = { ...c, vehicles: [...c.vehicles, v] };
        onChange({ customer: next, vehicleId: v.id });
        toast.success("Vehicle added · guest preview");
        return;
      }
      const r = await saveVehicleAction({ customer_id: c.id, vin: carDraft.vin || null, year: carDraft.year ? Number(carDraft.year) : null, make: carDraft.make || null, model: carDraft.model || null, color: carDraft.color || null });
      if (!r.ok) return void toast.error(r.error);
      const v = { id: r.data.id, year: r.data.year, make: r.data.make, model: r.data.model, color: r.data.color, vin: r.data.vin, plate: r.data.plate, size_class: r.data.size_class };
      onChange({ customer: { ...c, vehicles: [...c.vehicles, v] }, vehicleId: v.id });
      toast.success("Vehicle added to the customer");
    });
  }

  const carTyped = !!(carDraft.model || carDraft.vin);

  return (
    <div className="grid gap-2" data-testid="customer-picker">
      <div className="flex items-center justify-between">
        <Label>Customer</Label>
        {c && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ customer: null, vehicleId: null })}>
            <XIcon /> Clear
          </Button>
        )}
      </div>
      {c ? (
        <div className="rounded-xl border border-primary/40 bg-accent-soft/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                <UserIcon className="size-4 text-primary" /> <span className="truncate">{c.name}</span>
              </div>
              {c.phone && <div className="text-caption text-subtle">{formatPhone(c.phone)}</div>}
            </div>
            {c.id !== "demo" && c.id !== "new" && (
              <Link href={`/retail/customers/${c.id}`} className="shrink-0 text-caption text-muted-foreground underline-offset-2 hover:underline">
                Open
              </Link>
            )}
          </div>
          <div className="mt-3 grid gap-1.5">
            <Label className="text-caption text-subtle">Their car</Label>
            {c.vehicles.length > 0 && (
              <div className="flex flex-wrap gap-2" data-testid="customer-vehicles-pick">
                {c.vehicles.map((v) => {
                  const sel = v.id === value.vehicleId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => {
                        onChange({ customer: c, vehicleId: v.id });
                        onVehiclePicked?.(v);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${sel ? "border-primary bg-accent-soft text-primary" : "border-border bg-card hover:border-border-strong"}`}
                    >
                      {sel && <CheckIcon className="size-3.5" />}
                      {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
                      {v.color ? <span className="text-muted-foreground">· {v.color}</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
            {!vehicle && (
              <div className="flex flex-wrap items-center gap-2 text-caption text-subtle">
                {carTyped ? (
                  <Button type="button" size="sm" variant="outline" onClick={addCarAsVehicle} loading={pending} data-testid="add-car-as-vehicle">
                    <PlusIcon /> Add {[carDraft.year, carDraft.make, carDraft.model].filter(Boolean).join(" ") || "this car"} as their vehicle
                  </Button>
                ) : (
                  <span>Type the car above, then add it as their vehicle.</span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="h-12 justify-start" onClick={() => setOpen(true)} data-testid="pick-customer">
          <SearchIcon /> Find or add the customer
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[88dvh] gap-0 p-0">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle>Who is the car for?</SheetTitle>
            <SheetDescription>Search by phone, name or the car. Not found? Add them.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Phone, name or car" aria-label="Search customers" autoFocus autoComplete="off" inputMode="search" />
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); setCreating(true); }} data-testid="new-customer-inline">
              <PlusIcon /> New customer{q.trim() ? ` “${q.trim()}”` : ""}
            </Button>
          </div>
          <ul className="flex-1 divide-y divide-border overflow-y-auto border-t border-border" data-testid="customer-hits">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => pickCustomer(h)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/60">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block truncate text-caption text-subtle">{[formatPhone(h.phone), h.vehicles.map((v) => [v.year, v.make, v.model].filter(Boolean).join(" ")).join(", ")].filter(Boolean).join(" · ") || "No car on file"}</span>
                  </span>
                </button>
              </li>
            ))}
            {hits.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">{pending ? "Searching…" : q ? "No one matches. Add them." : "No customers yet."}</li>}
          </ul>
        </SheetContent>
      </Sheet>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New customer</SheetTitle>
            <SheetDescription>Name and phone are enough; the rest can wait.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <CustomerForm
              compact
              onSaved={(created: Customer) => {
                setCreating(false);
                onChange({ customer: { id: created.id, name: created.display_name ?? formatPhone(created.phone), phone: created.phone, vehicles: [] }, vehicleId: null });
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function fromRow(r: CustomerListRow): PickedCustomer {
  return { id: r.id, name: r.display_name ?? formatPhone(r.phone) ?? r.email ?? "Customer", phone: r.phone, vehicles: [] };
}

/** Server rows for the picker: recent customers with their vehicles. */
export function toPickedCustomer(c: { id: string; display_name: string | null; phone: string | null; email: string | null }, vehicles: PickedCustomer["vehicles"]): PickedCustomer {
  return { id: c.id, name: c.display_name ?? formatPhone(c.phone) ?? c.email ?? "Customer", phone: c.phone, vehicles };
}
