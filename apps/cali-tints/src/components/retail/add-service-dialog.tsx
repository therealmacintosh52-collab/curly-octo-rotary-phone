"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import type { CannedJob, CannedLine, EstimateJobPriority, PastService, RetailCatalogService, VehicleSize } from "@/lib/db/types";
import { pastServicesAction } from "@/app/(app)/retail/canned-actions";
import { useSession } from "@/components/app/session-provider";
import { cannedMatchesCar, cannedScope, cannedSummary, type CannedContext } from "@/lib/retail/canned";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NO_PAST: PastService[] = [];
export type AddServicePick = { title: string; priority: EstimateJobPriority; lines: CannedLine[]; inspectionTemplateId?: string | null };

/**
 * "Add a Service": the shop's canned jobs (filtered to this car), the jobs approved on this car's earlier
 * visits, and the plain menu. One tap drops a whole job (its labor, parts and fees) on the estimate; the
 * server prices every line again when the estimate is saved, so these prices are what the shop saved.
 */
export function AddServiceDialog({ canned, car, vehicleId, customerId, ctx, menu, onPick, onMenuPick, onBlankJob, demoPast = NO_PAST }: { canned: CannedJob[]; car: { year: string; make: string; model: string }; vehicleId: string | null; customerId: string | null; ctx: CannedContext; menu: RetailCatalogService[]; onPick: (pick: AddServicePick) => void; onMenuPick: (svc: RetailCatalogService) => void; onBlankJob: () => void; /** Guest preview: past services come from the fixtures, not the database. */ demoPast?: PastService[] }) {
  const { demo } = useSession();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [byYear, setByYear] = useState(true);
  const [byMake, setByMake] = useState(true);
  const [past, setPast] = useState<PastService[] | null>(null);
  const [tab, setTab] = useState("canned");

  // Past services load when the tab is opened (the car or the customer must be known); the guest preview uses the fixtures.
  const known = !!(vehicleId || customerId);
  useEffect(() => {
    if (!open || tab !== "past" || past !== null || demo || !known) return;
    void pastServicesAction({ vehicleId, customerId }).then((r) => {
      if (r.ok) setPast(r.data);
      else {
        setPast([]);
        toast.error(r.error);
      }
    });
  }, [open, tab, past, demo, known, vehicleId, customerId]);
  const pastList = useMemo(() => (demo ? demoPast : known ? past : []), [demo, demoPast, known, past]);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      canned
        .filter((c) => c.active && cannedMatchesCar(c, car, { make: byMake, year: byYear }) && (!needle || `${c.name} ${c.category ?? ""}`.toLowerCase().includes(needle)))
        .slice(0, 60),
    [canned, car, byMake, byYear, needle],
  );
  const shownPast = useMemo(() => (pastList ?? []).filter((p) => !needle || p.title.toLowerCase().includes(needle)), [pastList, needle]);
  const shownMenu = useMemo(() => menu.filter((s) => !needle || s.name.toLowerCase().includes(needle)), [menu, needle]);

  function pick(p: AddServicePick) {
    onPick(p);
    setOpen(false);
    setQ("");
    toast.success(`Added ${p.title}`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <DialogTrigger asChild>
        <Button type="button" data-testid="add-service">
          <PlusIcon /> Add a Service
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-hidden sm:max-w-2xl" data-testid="add-service-dialog">
        <DialogHeader>
          <DialogTitle>Add a Service</DialogTitle>
          <DialogDescription>Tap Add Service and the whole job lands on the estimate: its labor, parts and fees. Change anything after.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or category" aria-label="Search services" className="h-10 w-full rounded-md border border-border bg-input pr-3 pl-8 text-base outline-none focus-visible:border-primary" data-testid="add-service-search" />
          </div>
          {(car.year || car.make) && (
            <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="add-service-car">
              {car.year && <FilterChip on={byYear} onToggle={() => setByYear((v) => !v)} label={car.year} />}
              {car.make && <FilterChip on={byMake} onToggle={() => setByMake((v) => !v)} label={car.make} />}
              {car.model && <span className="rounded-full bg-muted px-2.5 py-1 text-caption text-muted-foreground">{car.model}</span>}
              <span className="text-caption text-subtle">Untick to see jobs for other cars too.</span>
            </div>
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="canned" data-testid="tab-canned">Canned Jobs</TabsTrigger>
              <TabsTrigger value="past" data-testid="tab-past">Past Services</TabsTrigger>
              <TabsTrigger value="menu" data-testid="tab-menu">Menu</TabsTrigger>
            </TabsList>
            <div className="max-h-[48dvh] overflow-y-auto pr-1">
              <TabsContent value="canned" className="m-0">
                <ul className="divide-y divide-border" data-testid="canned-list">
                  {shown.map((c) => {
                    const s = cannedSummary(c.lines, ctx);
                    return (
                      <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3" data-testid="canned-row">
                        <div className="min-w-0">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-caption text-subtle">{cannedScope(c)}{c.category ? ` · ${c.category}` : ""}{c.inspection ? ` · ${c.inspection}` : ""}</div>
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-3">
                          <div className="text-left text-caption text-subtle sm:text-right">
                            <div>{s.hours.toFixed(2)} Hours{s.rate !== null ? ` @ ${formatMoney(s.rate)}` : ""}</div>
                            <div>{s.partCount > 0 ? `${s.partCount} ${s.partCount === 1 ? "part" : "parts"}` : "No parts"}</div>
                          </div>
                          <span className="ml-auto w-20 rounded-md bg-muted px-2 py-1 text-right text-sm font-semibold tabular-nums sm:ml-0 sm:w-16">{formatMoney(s.total)}</span>
                          <Button type="button" size="sm" onClick={() => pick({ title: c.name, priority: c.priority, lines: c.lines, inspectionTemplateId: c.inspection_template_id })} data-testid="canned-add">
                            Add Service
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                  {shown.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{canned.length === 0 ? "No canned jobs yet. Build a job on an estimate and tap Save as canned job, or add them in Settings → Shop menu." : "No canned job matches this car and search."}</li>}
                </ul>
              </TabsContent>
              <TabsContent value="past" className="m-0">
                <ul className="divide-y divide-border" data-testid="past-list">
                  {pastList === null && <li className="py-6 text-center text-sm text-muted-foreground">Loading…</li>}
                  {shownPast.map((p) => {
                    const s = cannedSummary(p.lines, ctx);
                    return (
                      <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3" data-testid="past-row">
                        <div className="min-w-0">
                          <div className="font-medium">{p.title}</div>
                          <div className="text-caption text-subtle">{p.estimate_number} · {formatDate(p.date)}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="rounded-md bg-muted px-2 py-1 text-sm font-semibold tabular-nums">{formatMoney(s.total)}</span>
                          <Button type="button" size="sm" onClick={() => pick({ title: p.title, priority: p.priority, lines: p.lines })} data-testid="past-add">
                            Add Service
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                  {pastList !== null && shownPast.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{vehicleId || customerId ? "No earlier approved services for this car." : "Pick the customer and the car to see what was done before."}</li>}
                </ul>
              </TabsContent>
              <TabsContent value="menu" className="m-0">
                <ul className="divide-y divide-border" data-testid="menu-list">
                  {shownMenu.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 font-medium">{s.name}{s.placeholder && <Badge variant="warning" className="ml-2">placeholder</Badge>}</div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="tabular-nums text-muted-foreground">{formatMoney(s.prices?.[ctx.size as VehicleSize] ?? s.default_price ?? 0)}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => { onMenuPick(s); setOpen(false); toast.success(`Added ${s.name}`); }}>
                          Add
                        </Button>
                      </div>
                    </li>
                  ))}
                  {shownMenu.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nothing matches.</li>}
                </ul>
              </TabsContent>
            </div>
          </Tabs>
          <button type="button" onClick={() => { setOpen(false); onBlankJob(); }} className="w-fit text-sm text-primary underline-offset-2 hover:underline" data-testid="add-service-scratch">
            or build one from scratch…
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onToggle} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption transition-colors", on ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
      <span className={cn("inline-block size-3 rounded-sm border", on ? "border-primary bg-primary" : "border-border")} /> {label}
    </button>
  );
}
