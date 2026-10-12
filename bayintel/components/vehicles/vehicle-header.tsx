"use client";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceBadge } from "@/components/source-badge";
import { deleteVehicleAction, updateVehicleAction } from "@/app/(app)/garage/actions";
import type { VehicleRow } from "@/lib/vehicles/data";

export function VehicleHeader({ vehicle }: { vehicle: VehicleRow }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    nickname: vehicle.nickname ?? "",
    plate: vehicle.plate ?? "",
    mileage: vehicle.mileage?.toString() ?? "",
    engine: vehicle.engine ?? "",
  });
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight tracking-tight">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[vehicle.trim, vehicle.engine, vehicle.drive_type, vehicle.transmission].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {vehicle.vin && <span className="font-mono">{vehicle.vin}</span>}
          {vehicle.plate && <span>{vehicle.plate}</span>}
          {vehicle.mileage != null && <span>{vehicle.mileage.toLocaleString()} mi</span>}
          <SourceBadge source={vehicle.specs_source} />
        </p>
      </div>
      <Button variant="outline" size="icon" aria-label="Edit vehicle" onClick={() => setOpen(true)}>
        <Pencil />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Edit vehicle">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                await updateVehicleAction(vehicle.id, {
                  nickname: form.nickname || null,
                  plate: form.plate || null,
                  mileage: form.mileage ? Number(form.mileage) : null,
                  engine: form.engine || null,
                });
                setOpen(false);
              });
            }}
          >
            <div>
              <Label htmlFor="nickname">Nickname</Label>
              <Input id="nickname" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Customer or unit name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plate">Plate</Label>
                <Input id="plate" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="mileage">Mileage</Label>
                <Input id="mileage" inputMode="numeric" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value.replace(/\D/g, "") })} />
              </div>
            </div>
            <div>
              <Label htmlFor="engine">Engine</Label>
              <Input id="engine" value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} placeholder="5.0L V8" />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-destructive"
              disabled={pending}
              onClick={() => {
                if (confirm("Remove this vehicle from the garage? Repair orders and estimates attached to it will be removed too.")) start(async () => {
                  await deleteVehicleAction(vehicle.id);
                });
              }}
            >
              <Trash2 /> Remove from garage
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
