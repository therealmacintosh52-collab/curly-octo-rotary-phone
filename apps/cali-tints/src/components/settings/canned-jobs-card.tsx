"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { CannedJob, CannedLine, EstimateJobPriority, InspectionTemplate, RetailCatalogService } from "@/lib/db/types";
import { deleteCannedJobAction, saveCannedJobAction } from "@/app/(app)/retail/canned-actions";
import { useSession } from "@/components/app/session-provider";
import { cannedScope, cannedSummary } from "@/lib/retail/canned";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const TYPES = [["labor", "Labor"], ["part", "Part"], ["fee", "Fee"], ["sublet", "Sublet"]] as const;

/** Settings → Shop menu: saved jobs an advisor drops on an estimate with one tap (Add a Service → Canned Jobs). */
export function CannedJobsCard({ jobs, templates, defaultRate, markupPct }: { jobs: CannedJob[]; templates: InspectionTemplate[]; defaultRate: number | null; markupPct: number | null | undefined }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<CannedJob | "new" | null>(null);

  function remove(j: CannedJob) {
    start(async () => {
      if (demo) return void toast.success("Removed", { description: "Guest preview — nothing changed" });
      const r = await deleteCannedJobAction(j.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Removed");
      router.refresh();
    });
  }

  return (
    <Card data-testid="canned-jobs">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Canned jobs</CardTitle>
          <CardDescription>Saved jobs (brakes, A/C, oil change) with their labor hours, parts and fees. In an estimate, Add a Service → Canned Jobs drops the whole job in. You can also save any job you built on an estimate with the bookmark button.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")} data-testid="canned-add-new">
          <PlusIcon /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {jobs.map((j) => {
            const s = cannedSummary(j.lines, { defaultRate, markupPct, services: [], size: "sedan" });
            return (
              <li key={j.id} className={cn("flex items-center justify-between gap-3 py-2.5", !j.active && "opacity-60")} data-testid="canned-job-row">
                <div className="min-w-0">
                  <span className="font-medium">{j.name}</span>
                  {!j.active && <Badge variant="muted" className="ml-2">Off</Badge>}
                  <div className="text-caption text-subtle">{cannedScope(j)} · {s.hours.toFixed(2)} h · {j.line_count} {j.line_count === 1 ? "line" : "lines"} · {formatMoney(s.total)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${j.name}`} onClick={() => setEditing(j)}>
                    <PencilIcon />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${j.name}`} disabled={pending} onClick={() => remove(j)}>
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            );
          })}
          {jobs.length === 0 && <li className="py-3 text-sm text-muted-foreground">No canned jobs yet.</li>}
        </ul>
      </CardContent>
      {editing && <CannedDialog job={editing === "new" ? null : editing} templates={templates} onClose={() => setEditing(null)} />}
    </Card>
  );
}

type Row = CannedLine & { key: string };
const newRow = (type: CannedLine["line_type"]): Row => ({ key: crypto.randomUUID(), line_type: type, name: "", qty: 1 });

function CannedDialog({ job, templates, onClose }: { job: CannedJob | null; templates: InspectionTemplate[]; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [name, setName] = useState(job?.name ?? "");
  const [category, setCategory] = useState(job?.category ?? "");
  const [makes, setMakes] = useState((job?.makes ?? []).join(", "));
  const [yearFrom, setYearFrom] = useState(job?.year_from ? String(job.year_from) : "");
  const [yearTo, setYearTo] = useState(job?.year_to ? String(job.year_to) : "");
  const [priority, setPriority] = useState<EstimateJobPriority>(job?.priority ?? "soon");
  const [template, setTemplate] = useState(job?.inspection_template_id ?? "");
  const [active, setActive] = useState(job?.active ?? true);
  const [rows, setRows] = useState<Row[]>((job?.lines ?? []).map((l) => ({ ...l, key: crypto.randomUUID() })));
  const set = (key: string, patch: Partial<CannedLine>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  function save() {
    const lines = rows.map(({ key: _key, ...l }) => {
      void _key;
      return l;
    });
    start(async () => {
      if (demo) {
        toast.success("Saved", { description: "Guest preview — nothing changed" });
        return onClose();
      }
      const r = await saveCannedJobAction({
        id: job?.id,
        name,
        category: category.trim() || null,
        makes: makes.split(",").map((m) => m.trim()).filter(Boolean),
        year_from: yearFrom ? Number(yearFrom) : null,
        year_to: yearTo ? Number(yearTo) : null,
        priority,
        inspection_template_id: template || null,
        active,
        lines,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{job ? "Edit the canned job" : "New canned job"}</DialogTitle>
          <DialogDescription>The prices here are what the shop saved; the estimate prices every line again when it is saved. Leave the labor rate empty to use the shop rate.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cj-name">Name</Label>
              <Input id="cj-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-testid="cj-name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cj-category">Category (optional)</Label>
              <Input id="cj-category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} placeholder="Brakes" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cj-makes">Only these makes (optional)</Label>
              <Input id="cj-makes" value={makes} onChange={(e) => setMakes(e.target.value)} placeholder="Toyota, Honda" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cj-from">Year from</Label>
                <Input id="cj-from" inputMode="numeric" value={yearFrom} onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cj-to">to</Label>
                <Input id="cj-to" inputMode="numeric" value={yearTo} onChange={(e) => setYearTo(e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cj-priority">Priority</Label>
              <select id="cj-priority" value={priority} onChange={(e) => setPriority(e.target.value as EstimateJobPriority)} className="h-10 rounded-md border border-border bg-input px-2 text-sm">
                <option value="safety">Safety</option>
                <option value="soon">Due soon</option>
                <option value="optional">Optional</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cj-template">Adds this checklist (optional)</Label>
              <select id="cj-template" value={template} onChange={(e) => setTemplate(e.target.value)} className="h-10 rounded-md border border-border bg-input px-2 text-sm">
                <option value="">None</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Lines</Label>
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[5.5rem_1fr_4.5rem_5.5rem_5.5rem_2rem] items-center gap-1.5" data-testid="cj-line">
                <span className="text-caption text-muted-foreground">{r.line_type === "service" ? "Menu" : TYPES.find((t) => t[0] === r.line_type)?.[1]}</span>
                {r.line_type === "service" ? <span className="truncate text-sm">{r.name ?? "Menu service"}</span> : <Input aria-label="Name" value={r.name ?? ""} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="What it is" className="h-9" />}
                {r.line_type === "labor" ? (
                  <Input aria-label="Hours" inputMode="decimal" value={r.hours ?? ""} onChange={(e) => set(r.key, { hours: num(e.target.value) })} placeholder="Hours" className="h-9" />
                ) : (
                  <Input aria-label="Quantity" inputMode="decimal" value={r.qty ?? ""} onChange={(e) => set(r.key, { qty: num(e.target.value) })} placeholder="Qty" className="h-9" />
                )}
                <Input aria-label={r.line_type === "labor" ? "Rate" : "Price"} inputMode="decimal" value={(r.line_type === "labor" ? r.rate : r.price) ?? ""} onChange={(e) => set(r.key, r.line_type === "labor" ? { rate: num(e.target.value) } : { price: num(e.target.value) })} placeholder={r.line_type === "labor" ? "Rate" : "Price"} className="h-9" />
                <Input aria-label="Your cost" inputMode="decimal" value={r.cost ?? ""} onChange={(e) => set(r.key, { cost: num(e.target.value) })} placeholder="Cost" className="h-9" />
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove the line" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>
                  <XIcon />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(([t, label]) => (
                <Button key={t} type="button" size="sm" variant="outline" onClick={() => setRows((x) => [...x, newRow(t)])} data-testid={`cj-add-${t}`}>
                  <PlusIcon /> {label}
                </Button>
              ))}
            </div>
            <p className="text-caption text-subtle">Cost is hidden from the customer and never shown to techs or managers.</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="cj-active">On (offered in Add a Service)</Label>
            <Switch id="cj-active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} loading={pending} disabled={!name.trim()} data-testid="cj-save">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { RetailCatalogService };
