"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, ClockIcon, PackageIcon, PlusIcon, ReceiptIcon, SparklesIcon, StarIcon, Trash2Icon, TruckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { EstimateLineInput, EstimatePayload, EstimateTier, EstimateView, RetailCatalog, RetailCatalogService, VehicleSize } from "@/lib/db/types";
import { createEstimateAction, updateEstimateAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { addDaysYmd, toDateInput } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { depositFor, emptyLine, optionTotals, priceLine, type EstimateLineDraft, type LineType, type PricedLine, type QuoteModifier, type QuoteService } from "@/lib/retail/quote";
import { SIZE_CLASSES, SIZE_LABEL } from "@/lib/retail/size-class";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CustomerPicker, type CustomerPick, type PickedCustomer } from "./customer-picker";

type LineDraft = EstimateLineDraft;
type AddonDraft = LineDraft & { default_on: boolean };
type OptionDraft = { key: string; tier: EstimateTier; name: string; description: string; recommended: boolean; lines: LineDraft[] };

const TIER_NAMES: Record<EstimateTier, string> = { single: "Quote", good: "Good", better: "Better", best: "Best" };
const TYPE_LABEL: Record<LineType, string> = { service: "Service", labor: "Labor", part: "Part", fee: "Fee", sublet: "Sublet" };
const tierFor = (i: number, n: number): EstimateTier => (n === 1 ? "single" : (["good", "better", "best"] as const)[i]);
let keySeq = 0;
const nextKey = () => `o${++keySeq}-${Date.now()}`;
const lineKey = (l: LineDraft) => `${l.line_type}:${l.service_id ?? ""}:${l.label ?? ""}:${l.part_number ?? ""}:${l.finding_id ?? ""}`;

function toQuoteCatalog(catalog: RetailCatalog) {
  return {
    services: catalog.services.map((s): QuoteService => ({ id: s.id, name: s.name, benefit_text: s.benefit_text, duration_minutes: s.duration_minutes, taxable: s.taxable, placeholder: s.placeholder, open_amount: s.open_amount, prices: s.prices ?? {}, default_price: s.default_price })),
    modifiers: catalog.modifiers.map((m): QuoteModifier => ({ code: m.code, label: m.label, kind: m.kind, amount: Number(m.amount), active: m.active })),
    taxRate: Number(catalog.tax_rate ?? 0),
    taxAllLines: !!catalog.settings?.tax_all_lines,
    defaultRate: (catalog.labor_rates ?? []).find((r) => r.is_default && r.active)?.rate ?? (catalog.labor_rates ?? [])[0]?.rate ?? null,
    policy: catalog.settings ?? null,
  };
}

function fromView(e: EstimateView, services: RetailCatalogService[]): { options: OptionDraft[]; addons: AddonDraft[] } {
  const isOpen = (id: string | null) => !!services.find((s) => s.id === id)?.open_amount;
  const line = (l: EstimateView["options"][number]["lines"][number]): LineDraft => {
    const type = l.line_type ?? "service";
    if (type === "service") return emptyLine("service", { service_id: l.service_id ?? "", qty: l.qty, label: isOpen(l.service_id) ? l.name : null, price: isOpen(l.service_id) ? l.unit_price : null, modifiers: l.modifiers.map((m) => m.code), cost: l.cost ?? null, finding_id: l.finding_id ?? null });
    return emptyLine(type, { label: l.name, qty: type === "labor" ? 1 : l.qty, price: type === "labor" ? null : l.unit_price, hours: l.hours ?? null, rate: l.rate ?? null, part_number: l.part_number ?? null, vendor: l.vendor ?? null, taxable: l.taxable, cost: l.cost ?? null, finding_id: l.finding_id ?? null });
  };
  return {
    options: e.options.map((o) => ({ key: o.id, tier: o.tier, name: o.name, description: o.description ?? "", recommended: o.recommended, lines: o.lines.map(line) })),
    addons: e.addons.map((a) => ({ ...line(a), default_on: a.default_on })),
  };
}

function toInput(l: LineDraft): EstimateLineInput {
  const extra = { cost: l.cost, finding_id: l.finding_id };
  if (l.line_type === "service") return { line_type: "service", service_id: l.service_id ?? "", qty: l.qty, label: l.label, price: l.price, modifiers: l.modifiers, ...extra };
  if (l.line_type === "labor") return { line_type: "labor", label: l.label ?? "", hours: Number(l.hours ?? 0), rate: l.rate, taxable: l.taxable, ...extra };
  if (l.line_type === "part") return { line_type: "part", label: l.label ?? "", qty: l.qty, price: Number(l.price ?? 0), part_number: l.part_number, vendor: l.vendor, taxable: l.taxable, ...extra };
  return { line_type: l.line_type, label: l.label ?? "", qty: l.qty, price: Number(l.price ?? 0), vendor: l.vendor, taxable: l.taxable, ...extra };
}

/**
 * Write a retail estimate: who and which car, one to three options built
 * from the shop menu (prices by the car's size, condition add-ons) plus
 * labor (hours × shop rate), parts, fees and sublets, add-ons offered on
 * every option, an "Other" line with a typed amount, the date it is good
 * until. Totals (with shop supplies and tax) update as you type; the server
 * prices everything again when it saves. Written on an open repair order it
 * is a supplement: the findings it quotes arrive prefilled.
 */
/** Recommendations added from the findings panel go on the first option, once each. */
function withExtra<T extends { options: OptionDraft[] }>(base: T, extra?: LineDraft[]): T {
  if (!extra?.length || !base.options[0]) return base;
  const have = new Set(base.options[0].lines.map(lineKey));
  const add = extra.filter((l) => !have.has(lineKey(l)));
  return { ...base, options: [{ ...base.options[0], lines: [...base.options[0].lines, ...add] }, ...base.options.slice(1)] };
}

export function EstimateBuilder({ catalog, recent, initialPick, carHint, estimate, job, initialLines, extraLines }: { catalog: RetailCatalog; recent: PickedCustomer[]; initialPick?: CustomerPick | null; /** A car that is not on file yet, handed over by the bar at the top of Retail. */ carHint?: { vin: string; plate: string; year: string; make: string; model: string; odometer: string }; estimate?: EstimateView | null; job?: { id: string; ro_number: string | null; tag_number: string } | null; initialLines?: LineDraft[]; /** Lines to append to the first option of an estimate being edited (recommendations added from the findings panel). */ extraLines?: LineDraft[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const menu = useMemo(() => catalog.services.filter((s) => s.active && s.retail && !s.open_amount).sort((a, b) => a.sort_order - b.sort_order), [catalog.services]);
  const other = useMemo(() => catalog.services.find((s) => s.active && s.open_amount) ?? null, [catalog.services]);
  const quoteCatalog = useMemo(() => toQuoteCatalog(catalog), [catalog]);
  const rates = useMemo(() => (catalog.labor_rates ?? []).filter((r) => r.active), [catalog.labor_rates]);
  const validDays = catalog.settings?.estimate_valid_days ?? 14;
  const ro = job ?? (estimate?.job ? { id: estimate.job.id, ro_number: estimate.job.ro_number, tag_number: estimate.job.tag_number } : null);

  const initialCustomer: CustomerPick = estimate
    ? { customer: recent.find((c) => c.id === estimate.customer.id) ?? { id: estimate.customer.id, name: estimate.customer.display_name ?? estimate.customer.first_name, phone: estimate.customer.phone, vehicles: estimate.vehicle ? [{ id: estimate.vehicle.id, year: null, make: null, model: estimate.vehicle.name, color: estimate.vehicle.color, vin: null, plate: estimate.vehicle.plate, size_class: estimate.vehicle.size_class }] : [] }, vehicleId: estimate.vehicle?.id ?? null }
    : (initialPick ?? { customer: null, vehicleId: null });
  const [pick, setPick] = useState<CustomerPick>(initialCustomer);
  const pickedVehicle = pick.customer?.vehicles.find((v) => v.id === pick.vehicleId) ?? null;
  const [size, setSize] = useState<VehicleSize>(estimate?.size_class ?? pickedVehicle?.size_class ?? "sedan");
  const initial = useMemo(() => (estimate ? withExtra(fromView(estimate, catalog.services), extraLines) : { options: [{ key: nextKey(), tier: "single" as EstimateTier, name: "Quote", description: "", recommended: true, lines: initialLines ?? [] }], addons: [] }), [estimate, catalog.services, initialLines, extraLines]);
  const [options, setOptions] = useState<OptionDraft[]>(initial.options);
  const [addons, setAddons] = useState<AddonDraft[]>(initial.addons);
  const [expires, setExpires] = useState(estimate?.expires_at ? toDateInput(new Date(estimate.expires_at)) : addDaysYmd(toDateInput(new Date()), validDays));
  const [po, setPo] = useState(estimate?.po_number ?? "");
  const [miles, setMiles] = useState(estimate?.odometer ? String(estimate.odometer) : (carHint?.odometer ?? ""));
  const [customerNotes, setCustomerNotes] = useState(estimate?.customer_notes ?? "");
  const [internalNotes, setInternalNotes] = useState(estimate?.internal_notes ?? "");
  const [adding, setAdding] = useState<{ scope: "option" | "addon"; key?: string; type: LineType } | null>(null);

  // Live totals: never thrown away on a bad line, just shown as 0 for that option.
  const totals = useMemo(() => {
    const safe = (lines: LineDraft[]) => {
      try {
        const priced = lines.map((l) => priceLine(l, size, quoteCatalog));
        return { lines: priced, ...optionTotals(priced, quoteCatalog.taxRate, quoteCatalog.policy) };
      } catch {
        return null;
      }
    };
    return { options: options.map((o) => safe(o.lines)), addons: addons.map((a) => safe([a])) };
  }, [options, addons, size, quoteCatalog]);
  const recommended = options.findIndex((o) => o.recommended);
  const headline = totals.options[recommended >= 0 ? recommended : 0];
  const headlineAddons = addons.reduce((s, a, i) => s + (a.default_on ? (totals.addons[i]?.total ?? 0) : 0), 0);
  const headlineTotal = (headline?.total ?? 0) + headlineAddons;
  const deposit = catalog.settings ? depositFor(headlineTotal, catalog.settings) : 0;
  const usesPlaceholder = [...options.flatMap((o) => o.lines), ...addons].some((l) => l.line_type === "service" && catalog.services.find((s) => s.id === l.service_id)?.placeholder);
  const headlineCost = (options[recommended >= 0 ? recommended : 0]?.lines ?? []).reduce((s, l) => s + (l.cost ? Number(l.cost) * (l.line_type === "labor" ? 1 : l.qty) : 0), 0);

  function setOption(key: string, patch: Partial<OptionDraft> | ((o: OptionDraft) => OptionDraft)) {
    setOptions((prev) => prev.map((o) => (o.key === key ? (typeof patch === "function" ? patch(o) : { ...o, ...patch }) : o)));
  }
  function addOption() {
    if (options.length >= 3) return;
    const n = options.length + 1;
    setOptions((prev) => prev.map((o, i) => ({ ...o, tier: tierFor(i, n), name: o.name === TIER_NAMES[o.tier] ? TIER_NAMES[tierFor(i, n)] : o.name })).concat({ key: nextKey(), tier: tierFor(n - 1, n), name: TIER_NAMES[tierFor(n - 1, n)], description: "", recommended: false, lines: [...(prev.at(-1)?.lines ?? [])] }));
  }
  function removeOption(key: string) {
    setOptions((prev) => {
      const rest = prev.filter((o) => o.key !== key);
      const n = rest.length;
      const out = rest.map((o, i) => ({ ...o, tier: tierFor(i, n), name: o.name === TIER_NAMES[o.tier] ? TIER_NAMES[tierFor(i, n)] : o.name }));
      if (!out.some((o) => o.recommended) && out[0]) out[0] = { ...out[0], recommended: true };
      return out;
    });
  }
  function toggleLine(key: string, svc: RetailCatalogService) {
    setOption(key, (o) => {
      const has = o.lines.some((l) => l.line_type === "service" && l.service_id === svc.id);
      return { ...o, lines: has ? o.lines.filter((l) => !(l.line_type === "service" && l.service_id === svc.id)) : [...o.lines, emptyLine("service", { service_id: svc.id })] };
    });
  }
  function toggleModifier(key: string, serviceId: string, code: string) {
    setOption(key, (o) => ({ ...o, lines: o.lines.map((l) => (l.line_type === "service" && l.service_id === serviceId ? { ...l, modifiers: l.modifiers.includes(code) ? l.modifiers.filter((c) => c !== code) : [...l.modifiers, code] } : l)) }));
  }
  function setQty(key: string, serviceId: string, qty: number) {
    setOption(key, (o) => ({ ...o, lines: o.lines.map((l) => (l.line_type === "service" && l.service_id === serviceId ? { ...l, qty: Math.min(Math.max(qty, 1), 10) } : l)) }));
  }
  function addLine(line: LineDraft) {
    if (!adding) return;
    if (adding.scope === "addon") setAddons((prev) => [...prev, { ...line, default_on: false }]);
    else if (adding.key) setOption(adding.key, (o) => ({ ...o, lines: [...o.lines.filter((l) => lineKey(l) !== lineKey(line)), line] }));
    setAdding(null);
  }
  function removeLine(key: string, line: LineDraft) {
    setOption(key, (x) => ({ ...x, lines: x.lines.filter((y) => lineKey(y) !== lineKey(line)) }));
  }
  function toggleAddon(svc: RetailCatalogService) {
    setAddons((prev) => (prev.some((a) => a.service_id === svc.id) ? prev.filter((a) => a.service_id !== svc.id) : [...prev, { ...emptyLine("service", { service_id: svc.id }), default_on: false }]));
  }

  function payload(): EstimatePayload {
    return {
      job_id: ro?.id ?? null,
      customer_id: pick.customer?.id,
      vehicle_id: pick.vehicleId,
      size_class: size,
      expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      po_number: po.trim() || null,
      odometer: miles ? Number(miles) : null,
      customer_notes: customerNotes.trim() || null,
      internal_notes: internalNotes.trim() || null,
      options: options.map((o, i) => ({ tier: tierFor(i, options.length), name: o.name.trim() || TIER_NAMES[tierFor(i, options.length)], description: o.description.trim() || null, recommended: o.recommended, lines: o.lines.map(toInput) })),
      addons: addons.map((a) => ({ ...(toInput(a) as Extract<EstimateLineInput, { service_id: string }>), default_on: a.default_on })),
    };
  }

  function save() {
    if (!pick.customer && !ro) return void toast.error("Pick the customer first");
    if (options.some((o) => o.lines.length === 0)) return void toast.error("Every option needs at least one line");
    if (totals.options.some((t) => t === null)) return void toast.error("A line is missing something (hours, a rate, a name)");
    start(async () => {
      if (demo) {
        toast.success(estimate ? "Estimate updated" : "Estimate saved as a draft", { description: "Guest preview — nothing changed" });
        router.push(`/retail/estimates/${estimate?.id ?? (ro ? "90000000-0000-4000-8000-000000000004" : "90000000-0000-4000-8000-000000000001")}`);
        return;
      }
      let id = estimate?.id ?? null;
      if (estimate) {
        const r = await updateEstimateAction(estimate.id, payload());
        if (!r.ok) return void toast.error(r.error);
      } else {
        const r = await createEstimateAction(payload());
        if (!r.ok) return void toast.error(r.error);
        id = r.data.id;
      }
      toast.success(estimate ? "Estimate updated" : "Estimate saved. Send it when it looks right.");
      router.push(`/retail/estimates/${id}`);
      router.refresh();
    });
  }

  const carDraft = { vin: carHint?.vin ?? "", year: carHint?.year ?? "", make: carHint?.make ?? "", model: carHint?.model ?? "", color: "", plate: carHint?.plate ?? "", odometer: miles };
  const lineTypeIcon = (t: LineType) => (t === "labor" ? <ClockIcon className="size-3.5" /> : t === "part" ? <PackageIcon className="size-3.5" /> : t === "sublet" ? <TruckIcon className="size-3.5" /> : <ReceiptIcon className="size-3.5" />);

  return (
    <Page>
      <Link href={estimate ? `/retail/estimates/${estimate.id}` : ro ? `/jobs/${ro.id}?tab=notes` : "/retail/estimates"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {estimate ? estimate.display_number : ro ? (ro.ro_number ?? ro.tag_number) : "Estimates"}
      </Link>
      <PageHeader
        title={estimate ? `Edit ${estimate.display_number}` : ro ? `Estimate on ${ro.ro_number ?? ro.tag_number}` : "New estimate"}
        description={ro ? "What the tech found, priced: labor by the hour, parts, fees, sublets, or a service from the menu. The customer approves each item and signs." : "Pick the customer and the car, build the options from the menu, send the link. Prices come from the size grid."}
      />
      {ro && <Badge variant="info" className="mt-2" data-testid="builder-ro">Repair order {ro.ro_number ?? ro.tag_number}</Badge>}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardContent className="grid gap-4 pt-5">
              <CustomerPicker value={pick} onChange={setPick} carDraft={carDraft} recent={recent} onVehiclePicked={(v) => { if (v.size_class) setSize(v.size_class); }} />
              <div className="grid gap-1.5 sm:max-w-xs">
                <Label htmlFor="e-miles">Mileage</Label>
                <Input id="e-miles" inputMode="numeric" value={miles} onChange={(ev) => setMiles(ev.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 84200" autoComplete="off" data-testid="estimate-miles" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="e-size">Priced as</Label>
                <Select value={size} onValueChange={(v) => setSize(v as VehicleSize)}>
                  <SelectTrigger id="e-size" aria-label="Size class" className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_CLASSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label} <span className="text-muted-foreground">· {s.hint}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pickedVehicle?.size_class && pickedVehicle.size_class !== size && <p className="text-caption text-subtle">The car is on file as {SIZE_LABEL[pickedVehicle.size_class]}; this estimate prices it as {SIZE_LABEL[size]}.</p>}
              </div>
            </CardContent>
          </Card>

          {options.map((o, idx) => {
            const t = totals.options[idx];
            return (
              <Card key={o.key} data-testid="estimate-option" className={cn(o.recommended && "border-primary/50")}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={o.recommended ? "default" : "outline"}>{options.length === 1 ? "Option" : TIER_NAMES[tierFor(idx, options.length)]}</Badge>
                    <Input value={o.name} onChange={(e) => setOption(o.key, { name: e.target.value })} aria-label={`Option ${idx + 1} name`} className="h-9 max-w-56 font-semibold" />
                    <label className="ml-auto inline-flex items-center gap-2 text-sm">
                      <Switch checked={o.recommended} onCheckedChange={(v) => setOptions((prev) => prev.map((x) => ({ ...x, recommended: x.key === o.key ? v : v ? false : x.recommended })))} aria-label={`Recommend ${o.name}`} />
                      <StarIcon className="size-3.5 text-warning" /> Recommended
                    </label>
                    {options.length > 1 && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${o.name}`} onClick={() => removeOption(o.key)}>
                        <Trash2Icon />
                      </Button>
                    )}
                  </div>
                  <Input value={o.description} onChange={(e) => setOption(o.key, { description: e.target.value })} placeholder="One line the customer reads under the name (optional)" aria-label={`Option ${idx + 1} description`} className="h-9" />
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap gap-2" data-testid="estimate-chips">
                    {menu.map((s) => {
                      const on = o.lines.some((l) => l.line_type === "service" && l.service_id === s.id);
                      const price = catalog.services.length ? (s.prices?.[size] ?? s.default_price) : null;
                      return (
                        <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleLine(o.key, s)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors", on ? "border-primary bg-accent-soft text-primary" : "border-border bg-card hover:border-border-strong")}>
                          {on && <CheckIcon className="size-3.5" />}
                          {s.name}
                          {price !== null && price !== undefined && <span className={cn("tabular-nums", on ? "text-primary/80" : "text-muted-foreground")}>{formatMoney(price)}</span>}
                        </button>
                      );
                    })}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm hover:border-border-strong" data-testid="add-line">
                          <PlusIcon className="size-3.5" /> Add a line
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={() => setAdding({ scope: "option", key: o.key, type: "labor" })}>Labor (hours × rate)</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setAdding({ scope: "option", key: o.key, type: "part" })}>Part</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setAdding({ scope: "option", key: o.key, type: "fee" })}>Fee</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setAdding({ scope: "option", key: o.key, type: "sublet" })}>Sublet (outside work)</DropdownMenuItem>
                        {other && <DropdownMenuItem onSelect={() => setAdding({ scope: "option", key: o.key, type: "service" })}>Other (not on the menu)</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {o.lines.length > 0 && (
                    <ul className="divide-y divide-border rounded-xl border border-border text-sm" data-testid="estimate-lines">
                      {o.lines.map((l, li) => {
                        const svc = l.line_type === "service" ? catalog.services.find((s) => s.id === l.service_id) : undefined;
                        const ql: PricedLine | undefined = t?.lines[li];
                        const name = l.line_type === "service" ? (l.label ?? svc?.name) : l.label;
                        return (
                          <li key={lineKey(l)} className="grid gap-2 px-3 py-2.5" data-testid={`line-${l.line_type}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 font-medium">
                                  {l.line_type !== "service" && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">{lineTypeIcon(l.line_type)} {TYPE_LABEL[l.line_type]}</span>}
                                  <span>{name}</span>
                                  {svc?.placeholder && <Badge variant="warning">placeholder price</Badge>}
                                  {l.finding_id && <Badge variant="outline">from a finding</Badge>}
                                </div>
                                {l.line_type === "service" && svc?.benefit_text && !l.label && <div className="truncate text-caption text-subtle">{svc.benefit_text}</div>}
                                {l.line_type === "labor" && <div className="text-caption text-subtle">{l.hours} h × {formatMoney(l.rate ?? quoteCatalog.defaultRate ?? 0)}{l.taxable ? " · taxed" : ""}</div>}
                                {l.line_type === "part" && <div className="text-caption text-subtle">{[l.qty !== 1 ? `${l.qty} × ${formatMoney(l.price ?? 0)}` : null, l.part_number, l.vendor, l.taxable === false ? "no tax" : "taxed"].filter(Boolean).join(" · ")}</div>}
                                {(l.line_type === "fee" || l.line_type === "sublet") && <div className="text-caption text-subtle">{[l.vendor, l.taxable ? "taxed" : null].filter(Boolean).join(" · ")}</div>}
                                {l.cost !== null && l.cost !== undefined && <div className="text-caption text-subtle">Cost {formatMoney(Number(l.cost) * (l.line_type === "labor" ? 1 : l.qty))}{ql ? ` · margin ${formatMoney(ql.line_total - Number(l.cost) * (l.line_type === "labor" ? 1 : l.qty))}` : ""}</div>}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {l.line_type === "service" && !svc?.open_amount && (
                                  <Input type="number" min={1} max={10} value={l.qty} onChange={(e) => setQty(o.key, l.service_id ?? "", Number(e.target.value) || 1)} aria-label={`${svc?.name} quantity`} className="h-8 w-14 px-2 text-center" />
                                )}
                                <span className="w-20 text-right font-semibold tabular-nums">{formatMoney(ql?.line_total ?? 0)}</span>
                                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} onClick={() => removeLine(o.key, l)}>
                                  <XIcon />
                                </Button>
                              </div>
                            </div>
                            {l.line_type === "service" && !svc?.open_amount && catalog.modifiers.filter((m) => m.active).length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {catalog.modifiers.filter((m) => m.active).map((m) => {
                                  const on = l.modifiers.includes(m.code);
                                  return (
                                    <button key={m.code} type="button" aria-pressed={on} onClick={() => toggleModifier(o.key, l.service_id ?? "", m.code)} className={cn("rounded-full border px-2.5 py-1 text-caption transition-colors", on ? "border-warning/50 bg-warning/12 text-warning" : "border-border text-muted-foreground hover:border-border-strong")}>
                                      {m.label} {m.kind === "percent" ? `+${m.amount}%` : `+${formatMoney(m.amount)}`}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{t ? `${Math.round((t.duration_minutes / 60) * 10) / 10} h · subtotal ${formatMoney(t.subtotal)}${t.shop_supplies > 0 ? ` · supplies ${formatMoney(t.shop_supplies)}` : ""} · tax ${formatMoney(t.tax)}` : o.lines.length ? "A line is incomplete" : "Pick services or add a line"}</span>
                    <span className="text-lg font-semibold tabular-nums" data-testid="option-total">{formatMoney(t?.total ?? 0)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {options.length < 3 && (
            <Button type="button" variant="outline" onClick={addOption} data-testid="add-option">
              <PlusIcon /> {options.length === 1 ? "Offer Good / Better / Best" : "Add another option"}
            </Button>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SparklesIcon className="size-4 text-primary" /> Add-ons on every option</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-caption text-subtle">The customer can switch these on or off when they approve. &ldquo;On by default&rdquo; starts them ticked.</p>
              <div className="flex flex-wrap gap-2" data-testid="addon-chips">
                {menu.map((s) => {
                  const on = addons.some((a) => a.service_id === s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleAddon(s)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors", on ? "border-primary bg-accent-soft text-primary" : "border-border bg-card hover:border-border-strong")}>
                      {on && <CheckIcon className="size-3.5" />}
                      {s.name}
                    </button>
                  );
                })}
                {other && (
                  <button type="button" onClick={() => setAdding({ scope: "addon", type: "service" })} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm hover:border-border-strong">
                    <PlusIcon className="size-3.5" /> Other
                  </button>
                )}
              </div>
              {addons.length > 0 && (
                <ul className="divide-y divide-border rounded-xl border border-border text-sm" data-testid="addon-lines">
                  {addons.map((a, i) => {
                    const svc = catalog.services.find((s) => s.id === a.service_id);
                    return (
                      <li key={lineKey(a)} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0 font-medium">{a.label ?? svc?.name}</div>
                        <div className="flex shrink-0 items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 text-caption text-subtle">
                            <Switch checked={a.default_on} onCheckedChange={(v) => setAddons((prev) => prev.map((x, j) => (j === i ? { ...x, default_on: v } : x)))} aria-label={`${a.label ?? svc?.name} on by default`} /> On by default
                          </label>
                          <span className="w-20 text-right font-semibold tabular-nums">{formatMoney(totals.addons[i]?.total ?? 0)}</span>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove add-on ${a.label ?? svc?.name}`} onClick={() => setAddons((prev) => prev.filter((_, j) => j !== i))}>
                            <XIcon />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="e-expires">Good until</Label>
                <Input id="e-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="e-po">PO number (optional)</Label>
                <Input id="e-po" value={po} onChange={(e) => setPo(e.target.value)} maxLength={40} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="e-customer-notes">Note to the customer</Label>
                <Textarea id="e-customer-notes" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} placeholder="What you looked at, what you recommend and why." className="min-h-20" />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="e-internal-notes">Internal notes (staff only)</Label>
                <Textarea id="e-internal-notes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="min-h-16" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {ro && <div className="flex justify-between"><span className="text-muted-foreground">Repair order</span><span className="font-medium">{ro.ro_number ?? ro.tag_number}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{pick.customer?.name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Car</span><span className="font-medium">{pickedVehicle ? [pickedVehicle.year, pickedVehicle.make, pickedVehicle.model].filter(Boolean).join(" ") : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Priced as</span><span className="font-medium">{SIZE_LABEL[size]}</span></div>
              {options.map((o, i) => (
                <div key={o.key} className="flex justify-between"><span className="text-muted-foreground">{o.name}{o.recommended ? " ★" : ""}</span><span className="tabular-nums">{formatMoney(totals.options[i]?.total ?? 0)}</span></div>
              ))}
              {(headline?.shop_supplies ?? 0) > 0 && <div className="flex justify-between text-caption text-subtle"><span>Shop supplies included</span><span className="tabular-nums" data-testid="summary-supplies">{formatMoney(headline!.shop_supplies)}</span></div>}
              {addons.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Add-ons on by default</span><span className="tabular-nums">{formatMoney(headlineAddons)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold"><span>{options.length > 1 ? "Recommended total" : "Total"}</span><span className="tabular-nums" data-testid="estimate-total">{formatMoney(headlineTotal)}</span></div>
              {headlineCost > 0 && headline && <div className="flex justify-between text-caption text-subtle"><span>Cost {formatMoney(headlineCost)} · margin</span><span className="tabular-nums" data-testid="estimate-margin">{formatMoney(headline.subtotal - headlineCost)} ({headline.subtotal > 0 ? Math.round(((headline.subtotal - headlineCost) / headline.subtotal) * 100) : 0}%)</span></div>}
              {deposit > 0 && <div className="flex justify-between text-caption text-subtle"><span>Deposit to book ({catalog.settings?.deposit_kind === "percent" ? `${catalog.settings.deposit_value}%` : "flat"})</span><span className="tabular-nums">{formatMoney(deposit)}</span></div>}
              {usesPlaceholder && <p className="rounded-lg bg-warning/12 px-3 py-2 text-caption text-warning">Some of these prices are still placeholders. Set the real ones in Settings → Shop menu before sending.</p>}
            </CardContent>
          </Card>
          <Button size="lg" onClick={save} loading={pending} data-testid="estimate-save">
            {estimate ? "Save changes" : "Save draft"}
          </Button>
          <p className="text-center text-caption text-subtle">Nothing goes to the customer until you tap Send on the next screen.</p>
        </div>
      </div>

      {adding && <LineDialog type={adding.type} rates={rates} defaultRate={quoteCatalog.defaultRate} policy={catalog.settings} other={other} onClose={() => setAdding(null)} onAdd={addLine} />}
    </Page>
  );
}

/** One line that is not a priced menu service: labor (hours × rate), a part, a fee, a sublet, or "Other" with a typed amount. */
function LineDialog({ type, rates, defaultRate, policy, other, onClose, onAdd }: { type: LineType; rates: { id: string; name: string; rate: number; is_default: boolean }[]; defaultRate: number | null; policy: RetailCatalog["settings"]; other: RetailCatalogService | null; onClose: () => void; onAdd: (l: LineDraft) => void }) {
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState("1");
  const [rateId, setRateId] = useState(rates.find((r) => r.is_default)?.id ?? rates[0]?.id ?? "custom");
  const [customRate, setCustomRate] = useState(defaultRate ? String(defaultRate) : "");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [taxable, setTaxable] = useState(type === "part" ? (policy?.parts_taxable_default ?? true) : type === "labor" ? !!policy?.labor_taxable_default : false);
  const [cost, setCost] = useState("");
  const title = type === "labor" ? "Labor" : type === "part" ? "A part" : type === "fee" ? "A fee" : type === "sublet" ? "Outside work (sublet)" : "Something not on the menu";

  function submit() {
    const name = label.trim();
    if (name.length < 2) return void toast.error("Say what it is");
    const c = cost.trim() === "" ? null : Number(cost);
    if (type === "labor") {
      const h = Number(hours);
      const r = rateId === "custom" ? Number(customRate) : (rates.find((x) => x.id === rateId)?.rate ?? NaN);
      if (!(h > 0)) return void toast.error("Type the hours");
      if (!(r >= 0)) return void toast.error("Pick a rate");
      return onAdd(emptyLine("labor", { label: name, hours: Math.round(h * 100) / 100, rate: Math.round(r * 100) / 100, taxable, cost: c }));
    }
    const n = Number(price);
    if (!(n >= 0)) return void toast.error("Type the amount");
    if (type === "service") {
      if (!other) return;
      return onAdd(emptyLine("service", { service_id: other.id, label: name, price: Math.round(n * 100) / 100, cost: c }));
    }
    const q = Math.max(Number(qty) || 1, 0.01);
    onAdd(emptyLine(type, { label: name, qty: type === "part" ? q : 1, price: Math.round(n * 100) / 100, part_number: partNumber.trim() || null, vendor: vendor.trim() || null, taxable, cost: c }));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{type === "labor" ? "Hours at the shop rate; shop supplies follow the labor." : type === "service" ? "It shows on the estimate with this name and amount." : "It shows on the estimate as its own line."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ln-label">What is it?</Label>
            <Input id="ln-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} autoFocus placeholder={type === "labor" ? "Replace front brake pads" : type === "part" ? "Brake pads, front" : type === "fee" ? "Disposal fee" : type === "sublet" ? "Rotor resurfacing" : "Seat extraction, rear row"} data-testid="line-label" />
          </div>
          {type === "labor" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="ln-hours">Hours</Label><Input id="ln-hours" type="number" inputMode="decimal" min={0.05} step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} data-testid="line-hours" /></div>
              <div className="grid gap-1.5">
                <Label htmlFor="ln-rate">Rate</Label>
                <Select value={rateId} onValueChange={setRateId}>
                  <SelectTrigger id="ln-rate"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rates.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name} · {formatMoney(r.rate)}/h</SelectItem>
                    ))}
                    <SelectItem value="custom">Another rate…</SelectItem>
                  </SelectContent>
                </Select>
                {rateId === "custom" && <Input type="number" inputMode="decimal" min={0} step="0.01" value={customRate} onChange={(e) => setCustomRate(e.target.value)} aria-label="Rate per hour" placeholder="per hour" />}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {type === "part" && <div className="grid gap-1.5"><Label htmlFor="ln-qty">Quantity</Label><Input id="ln-qty" type="number" inputMode="decimal" min={1} step="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>}
              <div className="grid gap-1.5"><Label htmlFor="ln-price">{type === "part" ? "Price each" : "Amount"}</Label><Input id="ln-price" type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" data-testid="line-price" /></div>
              {type === "part" && <div className="grid gap-1.5"><Label htmlFor="ln-part">Part number (optional)</Label><Input id="ln-part" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} maxLength={60} /></div>}
              {(type === "part" || type === "sublet") && <div className="grid gap-1.5"><Label htmlFor="ln-vendor">{type === "part" ? "Vendor (optional)" : "Who does it (optional)"}</Label><Input id="ln-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={80} /></div>}
            </div>
          )}
          {type !== "service" && (
            <label className="flex items-center justify-between gap-3 text-sm"><span>Taxable</span><Switch checked={taxable} onCheckedChange={setTaxable} /></label>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="ln-cost">Your cost{type === "part" ? " each" : ""} (staff only, optional)</Label>
            <Input id="ln-cost" type="number" inputMode="decimal" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="never shown to the customer" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} data-testid="line-add">Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
