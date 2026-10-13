"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, ArrowLeftIcon, GaugeIcon, PencilIcon, PlusIcon, ScanSearchIcon } from "lucide-react";
import { toast } from "sonner";
import type { OdometerReading, Vehicle } from "@/lib/db/types";
import { addOdometerAction, saveVehicleAction } from "@/app/(app)/retail/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDate } from "@/lib/dates";
import { SIZE_LABEL } from "@/lib/retail/size-class";
import { Page } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VehicleForm } from "./vehicle-form";

export interface VehicleDetailData {
  vehicle: Vehicle;
  customer: { id: string; display_name: string | null };
  odometer: Pick<OdometerReading, "id" | "reading" | "read_at" | "job_id">[];
  jobs: { id: string; performed_at: string; tag: string; services: string[]; paid_at: string | null; deleted_at: string | null }[];
}

/** One car's history: what it is, the mileage over time, every visit. */
export function VehicleDetail({ data }: { data: VehicleDetailData }) {
  const { vehicle: v, customer, odometer, jobs } = data;
  const { isAdmin, demo } = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [reading, setReading] = useState("");
  const [pending, start] = useTransition();
  const name = [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
  const archived = !!v.archived_at;

  function toggleArchive() {
    start(async () => {
      if (demo) return void toast.success(archived ? "Restored" : "Archived", { description: "Guest preview — nothing changed" });
      const r = await saveVehicleAction({ id: v.id, archived: !archived });
      if (!r.ok) return void toast.error(r.error);
      toast.success(archived ? "Restored" : "Archived");
      router.refresh();
    });
  }

  function logReading() {
    const n = Number(reading.replace(/\D/g, ""));
    if (!n) return void toast.error("Enter the mileage");
    start(async () => {
      if (demo) {
        toast.success(`Logged ${n.toLocaleString()} mi · guest preview`);
        setLogging(false);
        return;
      }
      const r = await addOdometerAction(v.id, n);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Logged ${n.toLocaleString()} mi`);
      setLogging(false);
      setReading("");
      router.refresh();
    });
  }

  return (
    <Page>
      <Link href={`/retail/customers/${customer.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {customer.display_name ?? "Customer"}
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-title">{name}</h1>
            <Badge variant="outline">{SIZE_LABEL[v.size_class]}</Badge>
            {archived && <Badge variant="destructive">Archived</Badge>}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{[v.trim, v.color, v.plate ? `Plate ${v.plate}` : null, v.vin ? <span key="vin" className="font-mono">{v.vin}</span> : null].filter(Boolean).map((x, i) => (i ? <span key={i}> · {x}</span> : <span key={i}>{x}</span>))}</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild>
            <Link href={`/jobs/new?customer=${customer.id}&vehicle=${v.id}`}>
              <PlusIcon /> New job
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setLogging(true)} data-testid="odometer-add">
            <GaugeIcon /> Log mileage
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)} data-testid="vehicle-edit">
            <PencilIcon /> Edit
          </Button>
          <Button asChild variant="outline">
            <Link href={`/intel/vehicles/${v.id}`} data-testid="vehicle-intel">
              <ScanSearchIcon /> Intel
            </Link>
          </Button>
          {isAdmin && (
            <Button variant="ghost" onClick={toggleArchive} loading={pending}>
              {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {archived ? "Restore" : "Archive"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Visits</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm" data-testid="vehicle-jobs">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {formatDate(j.performed_at)} · <span className="tracking-wide">{j.tag}</span>
                          {j.deleted_at && <Badge variant="destructive" className="ml-2">Deleted</Badge>}
                        </div>
                        <div className="truncate text-caption text-subtle">{j.services.join(", ")}</div>
                      </div>
                      {j.paid_at ? <Badge variant="success">Paid</Badge> : j.deleted_at ? null : <Badge variant="warning">Collect</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GaugeIcon className="size-4 text-primary" /> Mileage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {odometer.length === 0 ? (
                <p className="text-sm text-muted-foreground">No readings yet.</p>
              ) : (
                <ul className="divide-y divide-border text-sm" data-testid="odometer-history">
                  {odometer.map((o) => (
                    <li key={o.id} className="flex items-center justify-between py-2">
                      <span className="tabular-nums font-medium">{o.reading.toLocaleString()} mi</span>
                      <span className="text-caption text-subtle">{formatDate(o.read_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {v.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{v.notes}</CardContent>
            </Card>
          )}
        </div>
      </div>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit vehicle</SheetTitle>
            <SheetDescription>VIN, year, make, model, size, color, plate, notes.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <VehicleForm customerId={customer.id} vehicle={v} onSaved={() => { setEditing(false); router.refresh(); }} onCancel={() => setEditing(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={logging} onOpenChange={setLogging}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log mileage</DialogTitle>
            <DialogDescription>The reading on the dash today.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="odo">Miles</Label>
            <Input id="odo" inputMode="numeric" value={reading} onChange={(e) => setReading(e.target.value.replace(/[^\d]/g, ""))} placeholder="84200" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLogging(false)}>Cancel</Button>
            <Button onClick={logReading} loading={pending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
