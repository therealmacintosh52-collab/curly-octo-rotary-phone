"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveIcon, ArchiveRestoreIcon, ArrowLeftIcon, CarFrontIcon, MailIcon, MergeIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import type { CustomerListRow, CustomerTimeline, Vehicle } from "@/lib/db/types";
import { archiveCustomerAction, mergeCustomersAction, searchCustomersAction } from "@/app/(app)/retail/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/retail/phone";
import { SIZE_LABEL } from "@/lib/retail/size-class";
import { Page } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CustomerForm, SOURCE_LABEL } from "./customer-form";
import { VehicleForm } from "./vehicle-form";
import { ContactButtons } from "./text-customer-button";

const vehicleName = (v: { year: number | null; make: string | null; model: string | null }) => [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";

/**
 * One customer, read top to bottom: who they are and how to reach them,
 * their cars, every visit. Edit, archive and merge are admin tools; a
 * detailer sees the record and may add a vehicle.
 */
export function CustomerDetail({ data, showMoney }: { data: CustomerTimeline; showMoney: boolean }) {
  const { customer: c, vehicles, jobs, stats } = data;
  const { isAdmin, demo } = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [merging, setMerging] = useState(false);
  const [pending, start] = useTransition();
  const archived = !!c.archived_at;
  const name = c.display_name ?? formatPhone(c.phone) ?? c.email ?? "Customer";

  function toggleArchive() {
    start(async () => {
      if (demo) {
        toast.success(archived ? "Restored" : "Archived", { description: "Guest preview — nothing changed" });
        return;
      }
      const r = await archiveCustomerAction(c.id, !archived);
      if (!r.ok) return void toast.error(r.error);
      toast.success(archived ? "Restored" : "Archived");
      router.refresh();
    });
  }

  return (
    <Page>
      <Link href="/retail/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Customers
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-title">{name}</h1>
            {archived && <Badge variant="destructive">Archived</Badge>}
            {data.merged_into && (
              <Badge variant="muted" asChild>
                <Link href={`/retail/customers/${data.merged_into.id}`}>Merged into {data.merged_into.display_name}</Link>
              </Badge>
            )}
            {c.tags.map((t) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {c.phone && <span>{formatPhone(c.phone)}</span>}
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <MailIcon className="size-3.5" /> {c.email}
              </a>
            )}
            <span>{SOURCE_LABEL[c.source]}</span>
            <span>Customer since {formatDate(c.created_at)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ContactButtons phone={c.phone} name={c.first_name} />
            <Badge variant={c.sms_opt_in ? "success" : "muted"}>{c.sms_opt_in ? "Texts OK" : "No texts"}</Badge>
            <Badge variant={c.marketing_opt_in ? "success" : "muted"}>{c.marketing_opt_in ? "Marketing OK" : "No marketing"}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="default">
            <Link href={`/jobs/new?customer=${c.id}`}>
              <PlusIcon /> New job
            </Link>
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)} data-testid="customer-edit">
                <PencilIcon /> Edit
              </Button>
              <Button variant="outline" onClick={() => setMerging(true)} data-testid="customer-merge">
                <MergeIcon /> Merge
              </Button>
              <Button variant="ghost" onClick={toggleArchive} loading={pending}>
                {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {archived ? "Restore" : "Archive"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3" data-testid="customer-stats">
        <Stat label="Visits" value={String(stats.visits)} />
        <Stat label="Last visit" value={stats.last_visit ? formatDate(stats.last_visit) : "—"} />
        {showMoney && stats.lifetime_spend !== null ? <Stat label="Lifetime spend" value={formatMoney(stats.lifetime_spend)} /> : <Stat label="Vehicles" value={String(vehicles.filter((v) => !v.archived_at).length)} />}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CarFrontIcon className="size-4 text-primary" /> Vehicles
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddingVehicle(true)} data-testid="vehicle-add">
                <PlusIcon /> Add vehicle
              </Button>
            </CardHeader>
            <CardContent>
              {vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicle on file yet. Add one, or it is created when you log their first job.</p>
              ) : (
                <ul className="divide-y divide-border" data-testid="customer-vehicles">
                  {vehicles.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/retail/vehicles/${v.id}`} className="font-semibold hover:text-primary">
                          {vehicleName(v)}
                        </Link>
                        {v.archived_at && <Badge variant="muted" className="ml-2">Archived</Badge>}
                        <div className="truncate text-caption text-subtle">
                          {[v.color, v.plate, v.vin ? `VIN …${v.vin.slice(-6)}` : null, v.odometer ? `${v.odometer.reading.toLocaleString()} mi` : null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-caption text-subtle">
                        <Badge variant="outline">{SIZE_LABEL[v.size_class]}</Badge>
                        <div className="mt-1">{v.visits ? `${v.visits} ${v.visits === 1 ? "visit" : "visits"}` : "No visits"}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visits</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet. Their first job shows up here.</p>
              ) : (
                <ul className="divide-y divide-border text-sm" data-testid="customer-jobs">
                  {jobs.map((j) => (
                    <li key={j.id} className="py-2.5">
                      <Link href={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 hover:text-primary">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {formatDate(j.performed_at)} · <span className="tracking-wide">{j.tag}</span>
                            {j.deleted_at && <Badge variant="destructive" className="ml-2">Deleted</Badge>}
                          </div>
                          <div className="truncate text-caption text-subtle">{[j.vehicle, j.services.join(", ")].filter(Boolean).join(" · ")}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          {j.paid_at ? <Badge variant="success">Paid</Badge> : j.deleted_at ? null : <Badge variant="warning">Collect</Badge>}
                          {showMoney && j.paid_amount !== null && <div className="mt-1 text-caption tabular-nums text-muted-foreground">{formatMoney(j.paid_amount)}</div>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <Fact label="Phone" value={c.phone ? formatPhone(c.phone) : "—"} />
                <Fact label="Email" value={c.email ?? "—"} />
                <Fact label="Address" value={[c.address_line1, c.address_line2, [c.city, c.state].filter(Boolean).join(", "), c.postal_code].filter(Boolean).join(", ") || "—"} />
                <Fact label="Texts" value={c.sms_opt_in ? `Yes · ${formatDateTime(c.sms_opt_in_at)}${c.consent_source ? ` · ${c.consent_source}` : ""}` : "No"} />
                <Fact label="Marketing" value={c.marketing_opt_in ? `Yes · ${formatDateTime(c.marketing_opt_in_at)}` : "No"} />
                {c.notes && <Fact label="Notes" value={<span className="whitespace-pre-wrap">{c.notes}</span>} />}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit customer</SheetTitle>
            <SheetDescription>Contact details, consents, tags and notes.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <CustomerForm customer={c} onSaved={() => { setEditing(false); router.refresh(); }} onCancel={() => setEditing(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={addingVehicle} onOpenChange={setAddingVehicle}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add vehicle</SheetTitle>
            <SheetDescription>Scan the VIN and the rest fills in.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <VehicleForm customerId={c.id} onSaved={(v: Vehicle) => { setAddingVehicle(false); if (v.id !== "demo") router.push(`/retail/vehicles/${v.id}`); }} onCancel={() => setAddingVehicle(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {isAdmin && <MergeDialog open={merging} onOpenChange={setMerging} keep={{ id: c.id, name }} />}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 surface-raised">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );
}

/** Find the duplicate record and fold it into this one. Vehicles and jobs move over; the other record is archived. */
function MergeDialog({ open, onOpenChange, keep }: { open: boolean; onOpenChange: (o: boolean) => void; keep: { id: string; name: string } }) {
  const router = useRouter();
  const { demo } = useSession();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerListRow[]>([]);
  const [pick, setPick] = useState<CustomerListRow | null>(null);
  const [pending, start] = useTransition();

  function search(text: string) {
    setQ(text);
    setPick(null);
    if (text.trim().length < 2) return void setHits([]);
    start(async () => {
      if (demo) {
        setHits([{ id: "demo-dupe", display_name: "Anna L.", phone: "(916) 555-0100", email: null, tags: [], archived_at: null, vehicles: ["2018 Honda Civic"], visits: 1, last_visit: new Date().toISOString(), lifetime_spend: null }]);
        return;
      }
      const r = await searchCustomersAction(text);
      if (r.ok) setHits(r.data.filter((x) => x.id !== keep.id));
    });
  }

  function merge() {
    if (!pick) return;
    start(async () => {
      if (demo) {
        toast.success(`Merged ${pick.display_name} into ${keep.name}`, { description: "Guest preview — nothing changed" });
        onOpenChange(false);
        return;
      }
      const r = await mergeCustomersAction(keep.id, pick.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Merged ${pick.display_name ?? "the duplicate"} into ${keep.name}`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge a duplicate into {keep.name}</DialogTitle>
          <DialogDescription>The other record&apos;s vehicles and visits move here; blanks here fill from it; it is then archived. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => search(e.target.value)} placeholder="Search the duplicate by name or phone" aria-label="Search the duplicate" autoFocus autoComplete="off" />
        {hits.length > 0 && (
          <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => setPick(h)} aria-pressed={pick?.id === h.id} className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent/60 ${pick?.id === h.id ? "bg-accent-soft" : ""}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{h.display_name ?? formatPhone(h.phone)}</span>
                    <span className="block truncate text-caption text-subtle">{[formatPhone(h.phone), h.email, h.vehicles.join(", ")].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-caption text-subtle">{h.visits} {h.visits === 1 ? "visit" : "visits"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={merge} disabled={!pick} loading={pending} data-testid="merge-confirm">
            Merge {pick ? `${pick.display_name ?? "this record"} into ${keep.name}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
