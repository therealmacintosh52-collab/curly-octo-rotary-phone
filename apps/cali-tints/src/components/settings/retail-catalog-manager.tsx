"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import type { PriceModifier, ResourceKind, RetailCatalog, RetailCatalogService, VehicleSize } from "@/lib/db/types";
import { saveModifierAction, saveRetailServiceAction, setServiceMenusAction, setSizePriceAction } from "@/app/(app)/settings/retail-actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { SIZE_CLASSES } from "@/lib/retail/size-class";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
const RESOURCE_LABEL: Record<ResourceKind, string> = { bay: "Bay", lift: "Lift", tech: "Tech" };

/**
 * Settings → Shop menu (owner): what the shop sells to walk-in customers, how
 * long each takes and what it needs, the price per size class, and the
 * condition add-ons. Seeded prices stay flagged "placeholder" until edited.
 */
export function RetailCatalogManager({ catalog }: { catalog: RetailCatalog }) {
  const [editing, setEditing] = useState<RetailCatalogService | "new" | null>(null);
  const [editingMod, setEditingMod] = useState<PriceModifier | "new" | null>(null);
  const retail = catalog.services.filter((s) => s.retail && !s.open_amount);
  const dealerOnly = catalog.services.filter((s) => !s.retail && s.active);
  const placeholders = retail.filter((s) => s.placeholder).length;

  return (
    <div className="flex flex-col gap-6" data-testid="retail-catalog">
      {placeholders > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm" data-testid="placeholder-banner">
          <span className="font-medium">{placeholders} {placeholders === 1 ? "price is" : "prices are"} placeholders.</span> They were filled in to get you started; set your real prices below (editing the sedan price clears the flag). Nothing is quoted to a customer until you do.
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Shop menu</CardTitle>
            <CardDescription>What walk-in customers can book. Each service carries its time, what it needs in the shop, and whether tax applies (parts).</CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing("new")} data-testid="retail-service-add">
            <PlusIcon /> Add service
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border" data-testid="retail-services">
            {retail.map((s) => (
              <li key={s.id} className={cn("flex items-start justify-between gap-3 py-3", !s.active && "opacity-60")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    {s.placeholder && <Badge variant="warning">Placeholder price</Badge>}
                    {s.taxable && <Badge variant="outline">Taxable</Badge>}
                    {s.dealer && <Badge variant="muted">Also dealer</Badge>}
                    {!s.active && <Badge variant="muted">Inactive</Badge>}
                  </div>
                  <div className="mt-0.5 text-caption text-subtle">
                    {[mins(s.duration_minutes), s.required_resource_kinds.map((k) => RESOURCE_LABEL[k]).join(" + "), s.required_skill ? `skill: ${s.required_skill}` : null, s.start_window_from ? `starts ${s.start_window_from.slice(0, 5)}–${s.start_window_to?.slice(0, 5)}` : null].filter(Boolean).join(" · ")}
                  </div>
                  {s.benefit_text && <div className="mt-0.5 text-sm text-muted-foreground">{s.benefit_text}</div>}
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}>
                  <PencilIcon />
                </Button>
              </li>
            ))}
            {retail.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nothing on the shop menu yet.</li>}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prices by size</CardTitle>
          <CardDescription>A car is priced by how big it is. The size comes from the VIN and stays editable on the vehicle. Blank cells use the sedan price.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table data-testid="size-price-grid">
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                {SIZE_CLASSES.map((sz) => (
                  <TableHead key={sz.value} className="text-right">
                    {sz.label}
                    <span className="block text-caption font-normal text-subtle">{sz.hint}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {retail.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.name}
                    {s.placeholder && <span className="ml-2 text-caption text-warning">placeholder</span>}
                  </TableCell>
                  {SIZE_CLASSES.map((sz) => (
                    <TableCell key={sz.value} className="text-right">
                      <SizePriceCell serviceId={s.id} size={sz.value} value={s.prices?.[sz.value] ?? null} fallback={s.prices?.sedan ?? s.default_price ?? 0} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Condition add-ons</CardTitle>
            <CardDescription>Extras added to a line when the car needs more: a percent of the line or a flat amount.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditingMod("new")} data-testid="modifier-add">
            <PlusIcon /> Add
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border" data-testid="modifiers">
            {catalog.modifiers.map((m) => (
              <li key={m.id} className={cn("flex items-center justify-between gap-3 py-2.5", !m.active && "opacity-60")}>
                <div className="min-w-0">
                  <span className="font-medium">{m.label}</span>
                  <span className="ml-2 text-caption text-subtle">{m.kind === "percent" ? `+${Number(m.amount)}%` : `+${formatMoney(m.amount)}`}</span>
                  {!m.active && <Badge variant="muted" className="ml-2">Off</Badge>}
                  {m.description && <div className="text-caption text-subtle">{m.description}</div>}
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${m.label}`} onClick={() => setEditingMod(m)}>
                  <PencilIcon />
                </Button>
              </li>
            ))}
            {catalog.modifiers.length === 0 && <li className="py-4 text-sm text-muted-foreground">No add-ons yet.</li>}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dealership services</CardTitle>
          <CardDescription>Separate menus, but any dealership service can be sold at the shop too: switch it on and give it size prices above.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border" data-testid="dealer-services">
            {dealerOnly.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-medium">{s.name}</span>
                <MenuSwitch service={s} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <ServiceDialog service={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      </Dialog>
      <Dialog open={!!editingMod} onOpenChange={(o) => !o && setEditingMod(null)}>
        {editingMod && <ModifierDialog modifier={editingMod === "new" ? null : editingMod} onClose={() => setEditingMod(null)} />}
      </Dialog>
    </div>
  );
}

function SizePriceCell({ serviceId, size, value, fallback }: { serviceId: string; size: VehicleSize; value: number | null; fallback: number }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [text, setText] = useState(value === null ? "" : String(Number(value)));
  function commit() {
    const trimmed = text.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && !Number.isFinite(next)) return void toast.error("Enter a number");
    if (next === value) return;
    start(async () => {
      if (demo) return void toast.success("Price saved", { description: "Guest preview — nothing changed" });
      const r = await setSizePriceAction(serviceId, size, next);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }
  return (
    <Input type="number" step="1" min="0" inputMode="decimal" value={text} placeholder={Number(fallback).toFixed(0)} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} disabled={pending} className="ml-auto h-9 w-24 text-right text-sm" aria-label={`${size} price`} />
  );
}

function MenuSwitch({ service }: { service: RetailCatalogService }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Sell at the shop
      <Switch
        checked={service.retail}
        disabled={pending}
        aria-label={`Sell ${service.name} at the shop`}
        onCheckedChange={(v) =>
          start(async () => {
            if (demo) return void toast.success(v ? `${service.name} added to the shop menu` : `${service.name} removed`, { description: "Guest preview — nothing changed" });
            const r = await setServiceMenusAction(service.id, { retail: v, dealer: service.dealer });
            if (!r.ok) toast.error(r.error);
            else router.refresh();
          })
        }
      />
    </label>
  );
}

type Draft = { name: string; description: string; benefit_text: string; duration_minutes: string; retail: boolean; dealer: boolean; taxable: boolean; placeholder: boolean; kinds: ResourceKind[]; required_skill: string; start_window_from: string; start_window_to: string; active: boolean; sort_order: string; prices: Record<VehicleSize, string> };

function ServiceDialog({ service, onClose }: { service: RetailCatalogService | null; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [f, setF] = useState<Draft>(() => ({
    name: service?.name ?? "",
    description: service?.description ?? "",
    benefit_text: service?.benefit_text ?? "",
    duration_minutes: String(service?.duration_minutes ?? 60),
    retail: service?.retail ?? true,
    dealer: service?.dealer ?? false,
    taxable: service?.taxable ?? false,
    placeholder: service?.placeholder ?? false,
    kinds: service?.required_resource_kinds ?? ["bay"],
    required_skill: service?.required_skill ?? "",
    start_window_from: service?.start_window_from?.slice(0, 5) ?? "",
    start_window_to: service?.start_window_to?.slice(0, 5) ?? "",
    active: service?.active ?? true,
    sort_order: String(service?.sort_order ?? 400),
    prices: { compact: str(service?.prices?.compact), sedan: str(service?.prices?.sedan), suv_truck: str(service?.prices?.suv_truck), xl: str(service?.prices?.xl) },
  }));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleKind = (k: ResourceKind, on: boolean) => set("kinds", on ? [...new Set([...f.kinds, k])] : f.kinds.filter((x) => x !== k));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  return (
    <DialogContent className="max-h-[92dvh] overflow-y-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (demo) {
              toast.success("Service saved", { description: "Guest preview — nothing changed" });
              onClose();
              return;
            }
            const r = await saveRetailServiceAction({
              id: service?.id,
              name: f.name,
              description: f.description,
              benefit_text: f.benefit_text,
              duration_minutes: Number(f.duration_minutes),
              retail: f.retail,
              dealer: f.dealer,
              taxable: f.taxable,
              placeholder: f.placeholder,
              required_resource_kinds: f.kinds,
              required_skill: f.required_skill,
              start_window_from: f.start_window_from || null,
              start_window_to: f.start_window_to || null,
              active: f.active,
              sort_order: Number(f.sort_order),
              prices: { compact: num(f.prices.compact), sedan: num(f.prices.sedan), suv_truck: num(f.prices.suv_truck), xl: num(f.prices.xl) },
            });
            if (r.ok) {
              toast.success("Service saved");
              onClose();
              router.refresh();
            } else toast.error(r.error);
          });
        }}
        className="grid gap-4"
      >
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "New shop service"}</DialogTitle>
          <DialogDescription>Deactivate instead of deleting: past jobs keep referencing it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="rs-name">Name</Label>
          <Input id="rs-name" value={f.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rs-benefit">What the customer gets</Label>
          <Textarea id="rs-benefit" value={f.benefit_text} onChange={(e) => set("benefit_text", e.target.value)} placeholder="One line, in plain words. This is what quotes and the booking page say." className="min-h-16" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rs-min">Takes (minutes)</Label>
            <Input id="rs-min" type="number" min="5" step="5" value={f.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rs-skill">Needs a tech with skill</Label>
            <Input id="rs-skill" value={f.required_skill} onChange={(e) => set("required_skill", e.target.value)} placeholder="e.g. correction, mechanic" />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Needs in the shop</Label>
          <div className="flex flex-wrap gap-4 text-sm">
            {(["bay", "lift"] as ResourceKind[]).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <Checkbox checked={f.kinds.includes(k)} onCheckedChange={(v) => toggleKind(k, v === true)} /> {RESOURCE_LABEL[k]}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Only starts between (long jobs)</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input type="time" value={f.start_window_from} onChange={(e) => set("start_window_from", e.target.value)} aria-label="Start window from" />
            <Input type="time" value={f.start_window_to} onChange={(e) => set("start_window_to", e.target.value)} aria-label="Start window to" />
          </div>
          <p className="text-xs text-muted-foreground">Leave blank for any time the shop is open.</p>
        </div>
        <div className="grid gap-1.5">
          <Label>Price by size</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SIZE_CLASSES.map((sz) => (
              <div key={sz.value} className="grid gap-1">
                <span className="text-caption text-subtle">{sz.label}</span>
                <Input type="number" min="0" step="1" inputMode="decimal" value={f.prices[sz.value]} onChange={(e) => set("prices", { ...f.prices, [sz.value]: e.target.value })} aria-label={`${sz.label} price`} />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-2 rounded-lg border border-border p-3 text-sm">
          <Row label="Sell at the shop (retail)" checked={f.retail} onChange={(v) => set("retail", v)} />
          <Row label="Also on the dealership menu" checked={f.dealer} onChange={(v) => set("dealer", v)} />
          <Row label="Taxable (parts)" checked={f.taxable} onChange={(v) => set("taxable", v)} />
          <Row label="Price still a placeholder" checked={f.placeholder} onChange={(v) => set("placeholder", v)} />
          <Row label="Active" checked={f.active} onChange={(v) => set("active", v)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ModifierDialog({ modifier, onClose }: { modifier: PriceModifier | null; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ code: modifier?.code ?? "", label: modifier?.label ?? "", description: modifier?.description ?? "", kind: modifier?.kind ?? "flat", amount: modifier ? String(Number(modifier.amount)) : "", active: modifier?.active ?? true, sort_order: String(modifier?.sort_order ?? 100) });
  return (
    <DialogContent>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (demo) {
              toast.success("Saved", { description: "Guest preview — nothing changed" });
              onClose();
              return;
            }
            const r = await saveModifierAction({ id: modifier?.id, code: f.code || f.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), label: f.label, description: f.description, kind: f.kind as "percent" | "flat", amount: Number(f.amount), active: f.active, sort_order: Number(f.sort_order) });
            if (r.ok) {
              toast.success("Saved");
              onClose();
              router.refresh();
            } else toast.error(r.error);
          });
        }}
        className="grid gap-4"
      >
        <DialogHeader>
          <DialogTitle>{modifier ? "Edit add-on" : "New add-on"}</DialogTitle>
          <DialogDescription>Added to a service line when the car needs it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="m-label">Name</Label>
          <Input id="m-label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Heavy soil" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="m-desc">When it applies</Label>
          <Input id="m-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Mud, sand, heavy grime" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Kind</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as "percent" | "flat" })}>
              <SelectTrigger aria-label="Kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percent of the line</SelectItem>
                <SelectItem value="flat">Flat amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-amount">{f.kind === "percent" ? "Percent" : "Amount"}</Label>
            <Input id="m-amount" type="number" min="0" step="1" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
          <span className="font-medium">Active</span>
          <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

const str = (n: number | undefined) => (n === undefined || n === null ? "" : String(Number(n)));
