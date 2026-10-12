"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, PlusIcon, SparklesIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { EstimatePayload, EstimateTier, EstimateView, RetailCatalog, RetailCatalogService, VehicleSize } from "@/lib/db/types";
import { createEstimateAction, updateEstimateAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { addDaysYmd, toDateInput } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { depositFor, quoteTotal, type QuoteModifier, type QuoteService } from "@/lib/retail/quote";
import { SIZE_CLASSES, SIZE_LABEL } from "@/lib/retail/size-class";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CustomerPicker, type CustomerPick, type PickedCustomer } from "./customer-picker";

type LineDraft = { service_id: string; qty: number; label: string | null; price: number | null; modifiers: string[] };
type AddonDraft = LineDraft & { default_on: boolean };
type OptionDraft = { key: string; tier: EstimateTier; name: string; description: string; recommended: boolean; lines: LineDraft[] };

const TIER_NAMES: Record<EstimateTier, string> = { single: "Quote", good: "Good", better: "Better", best: "Best" };
const tierFor = (i: number, n: number): EstimateTier => (n === 1 ? "single" : (["good", "better", "best"] as const)[i]);
let keySeq = 0;
const nextKey = () => `o${++keySeq}-${Date.now()}`;

function toQuoteCatalog(catalog: RetailCatalog): { services: QuoteService[]; modifiers: QuoteModifier[]; taxRate: number; taxAllLines: boolean } {
  return {
    services: catalog.services.map((s) => ({ id: s.id, name: s.name, benefit_text: s.benefit_text, duration_minutes: s.duration_minutes, taxable: s.taxable, placeholder: s.placeholder, open_amount: s.open_amount, prices: s.prices ?? {}, default_price: s.default_price })),
    modifiers: catalog.modifiers.map((m) => ({ code: m.code, label: m.label, kind: m.kind, amount: Number(m.amount), active: m.active })),
    taxRate: Number(catalog.tax_rate ?? 0),
    taxAllLines: !!catalog.settings?.tax_all_lines,
  };
}

function fromView(e: EstimateView, services: RetailCatalogService[]): { options: OptionDraft[]; addons: AddonDraft[] } {
  const isOpen = (id: string | null) => !!services.find((s) => s.id === id)?.open_amount;
  const line = (l: EstimateView["options"][number]["lines"][number]): LineDraft => ({ service_id: l.service_id ?? "", qty: l.qty, label: isOpen(l.service_id) ? l.name : null, price: isOpen(l.service_id) ? l.unit_price : null, modifiers: l.modifiers.map((m) => m.code) });
  return {
    options: e.options.map((o) => ({ key: o.id, tier: o.tier, name: o.name, description: o.description ?? "", recommended: o.recommended, lines: o.lines.map(line) })),
    addons: e.addons.map((a) => ({ ...line(a), default_on: a.default_on })),
  };
}

/**
 * Write a retail estimate: who and which car, one to three options built
 * from the shop menu (prices by the car's size, condition add-ons), add-ons
 * offered on every option, an "Other" line with a typed amount, the date it
 * is good until. Totals update as you tap; the server prices everything
 * again from the matrix when it saves.
 */
export function EstimateBuilder({ catalog, recent, initialPick, estimate }: { catalog: RetailCatalog; recent: PickedCustomer[]; initialPick?: CustomerPick | null; estimate?: EstimateView | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const menu = useMemo(() => catalog.services.filter((s) => s.active && s.retail && !s.open_amount).sort((a, b) => a.sort_order - b.sort_order), [catalog.services]);
  const other = useMemo(() => catalog.services.find((s) => s.active && s.open_amount) ?? null, [catalog.services]);
  const quoteCatalog = useMemo(() => toQuoteCatalog(catalog), [catalog]);
  const validDays = catalog.settings?.estimate_valid_days ?? 14;

  const initialCustomer: CustomerPick = estimate
    ? { customer: recent.find((c) => c.id === estimate.customer.id) ?? { id: estimate.customer.id, name: estimate.customer.display_name ?? estimate.customer.first_name, phone: estimate.customer.phone, vehicles: estimate.vehicle ? [{ id: estimate.vehicle.id, year: null, make: null, model: estimate.vehicle.name, color: estimate.vehicle.color, vin: null, plate: estimate.vehicle.plate, size_class: estimate.vehicle.size_class }] : [] }, vehicleId: estimate.vehicle?.id ?? null }
    : (initialPick ?? { customer: null, vehicleId: null });
  const [pick, setPick] = useState<CustomerPick>(initialCustomer);
  const pickedVehicle = pick.customer?.vehicles.find((v) => v.id === pick.vehicleId) ?? null;
  const [size, setSize] = useState<VehicleSize>(estimate?.size_class ?? pickedVehicle?.size_class ?? "sedan");
  const initial = useMemo(() => (estimate ? fromView(estimate, catalog.services) : { options: [{ key: nextKey(), tier: "single" as EstimateTier, name: "Quote", description: "", recommended: true, lines: [] }], addons: [] }), [estimate, catalog.services]);
  const [options, setOptions] = useState<OptionDraft[]>(initial.options);
  const [addons, setAddons] = useState<AddonDraft[]>(initial.addons);
  const [expires, setExpires] = useState(estimate?.expires_at ? toDateInput(new Date(estimate.expires_at)) : addDaysYmd(toDateInput(new Date()), validDays));
  const [po, setPo] = useState(estimate?.po_number ?? "");
  const [customerNotes, setCustomerNotes] = useState(estimate?.customer_notes ?? "");
  const [internalNotes, setInternalNotes] = useState(estimate?.internal_notes ?? "");
  const [otherFor, setOtherFor] = useState<{ scope: "option" | "addon"; key?: string } | null>(null);

  // Live totals: never thrown away on a bad line, just shown as 0 for that option.
  const totals = useMemo(() => {
    const safe = (lines: LineDraft[]) => {
      try {
        return quoteTotal({ size, lines }, quoteCatalog);
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
  const usesPlaceholder = [...options.flatMap((o) => o.lines), ...addons].some((l) => catalog.services.find((s) => s.id === l.service_id)?.placeholder);

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
      const has = o.lines.some((l) => l.service_id === svc.id);
      return { ...o, lines: has ? o.lines.filter((l) => l.service_id !== svc.id) : [...o.lines, { service_id: svc.id, qty: 1, label: null, price: null, modifiers: [] }] };
    });
  }
  function toggleModifier(key: string, serviceId: string, code: string) {
    setOption(key, (o) => ({ ...o, lines: o.lines.map((l) => (l.service_id === serviceId ? { ...l, modifiers: l.modifiers.includes(code) ? l.modifiers.filter((c) => c !== code) : [...l.modifiers, code] } : l)) }));
  }
  function setQty(key: string, serviceId: string, qty: number) {
    setOption(key, (o) => ({ ...o, lines: o.lines.map((l) => (l.service_id === serviceId ? { ...l, qty: Math.min(Math.max(qty, 1), 10) } : l)) }));
  }
  function addOther(label: string, price: number) {
    if (!other || !otherFor) return;
    const line: LineDraft = { service_id: other.id, qty: 1, label, price, modifiers: [] };
    if (otherFor.scope === "addon") setAddons((prev) => [...prev, { ...line, default_on: false }]);
    else if (otherFor.key) setOption(otherFor.key, (o) => ({ ...o, lines: [...o.lines.filter((l) => !(l.service_id === other.id && l.label === label)), line] }));
    setOtherFor(null);
  }
  function toggleAddon(svc: RetailCatalogService) {
    setAddons((prev) => (prev.some((a) => a.service_id === svc.id) ? prev.filter((a) => a.service_id !== svc.id) : [...prev, { service_id: svc.id, qty: 1, label: null, price: null, modifiers: [], default_on: false }]));
  }

  function payload(): EstimatePayload {
    return {
      customer_id: pick.customer?.id,
      vehicle_id: pick.vehicleId,
      size_class: size,
      expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      po_number: po.trim() || null,
      customer_notes: customerNotes.trim() || null,
      internal_notes: internalNotes.trim() || null,
      options: options.map((o, i) => ({ tier: tierFor(i, options.length), name: o.name.trim() || TIER_NAMES[tierFor(i, options.length)], description: o.description.trim() || null, recommended: o.recommended, lines: o.lines.map(({ service_id, qty, label, price, modifiers }) => ({ service_id, qty, label, price, modifiers })) })),
      addons: addons.map(({ service_id, qty, label, price, modifiers, default_on }) => ({ service_id, qty, label, price, modifiers, default_on })),
    };
  }

  function save() {
    if (!pick.customer) return void toast.error("Pick the customer first");
    if (options.some((o) => o.lines.length === 0)) return void toast.error("Every option needs at least one service");
    start(async () => {
      if (demo) {
        toast.success(estimate ? "Estimate updated" : "Estimate saved as a draft", { description: "Guest preview — nothing changed" });
        router.push(`/retail/estimates/${estimate?.id ?? "90000000-0000-4000-8000-000000000001"}`);
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

  const carDraft = { vin: "", year: "", make: "", model: "", color: "" };

  return (
    <Page>
      <Link href={estimate ? `/retail/estimates/${estimate.id}` : "/retail/estimates"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {estimate ? estimate.display_number : "Estimates"}
      </Link>
      <PageHeader title={estimate ? `Edit ${estimate.display_number}` : "New estimate"} description="Pick the customer and the car, build the options from the menu, send the link. Prices come from the size grid." />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardContent className="grid gap-4 pt-5">
              <CustomerPicker value={pick} onChange={setPick} carDraft={carDraft} recent={recent} onVehiclePicked={(v) => { if (v.size_class) setSize(v.size_class); }} />
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
                      const on = o.lines.some((l) => l.service_id === s.id);
                      const price = catalog.services.length ? (s.prices?.[size] ?? s.default_price) : null;
                      return (
                        <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleLine(o.key, s)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors", on ? "border-primary bg-accent-soft text-primary" : "border-border bg-card hover:border-border-strong")}>
                          {on && <CheckIcon className="size-3.5" />}
                          {s.name}
                          {price !== null && price !== undefined && <span className={cn("tabular-nums", on ? "text-primary/80" : "text-muted-foreground")}>{formatMoney(price)}</span>}
                        </button>
                      );
                    })}
                    {other && (
                      <button type="button" onClick={() => setOtherFor({ scope: "option", key: o.key })} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm hover:border-border-strong">
                        <PlusIcon className="size-3.5" /> Other
                      </button>
                    )}
                  </div>
                  {o.lines.length > 0 && (
                    <ul className="divide-y divide-border rounded-xl border border-border text-sm" data-testid="estimate-lines">
                      {o.lines.map((l) => {
                        const svc = catalog.services.find((s) => s.id === l.service_id);
                        const ql = t?.lines.find((x) => x.service_id === l.service_id && (svc?.open_amount ? x.name === l.label : true));
                        return (
                          <li key={`${l.service_id}-${l.label ?? ""}`} className="grid gap-2 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium">{l.label ?? svc?.name}{svc?.placeholder && <Badge variant="warning" className="ml-2">placeholder price</Badge>}</div>
                                {svc?.benefit_text && !l.label && <div className="truncate text-caption text-subtle">{svc.benefit_text}</div>}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {!svc?.open_amount && (
                                  <Input type="number" min={1} max={10} value={l.qty} onChange={(e) => setQty(o.key, l.service_id, Number(e.target.value) || 1)} aria-label={`${svc?.name} quantity`} className="h-8 w-14 px-2 text-center" />
                                )}
                                <span className="w-20 text-right font-semibold tabular-nums">{formatMoney(ql?.line_total ?? 0)}</span>
                                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${l.label ?? svc?.name}`} onClick={() => setOption(o.key, (x) => ({ ...x, lines: x.lines.filter((y) => !(y.service_id === l.service_id && y.label === l.label)) }))}>
                                  <XIcon />
                                </Button>
                              </div>
                            </div>
                            {!svc?.open_amount && catalog.modifiers.filter((m) => m.active).length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {catalog.modifiers.filter((m) => m.active).map((m) => {
                                  const on = l.modifiers.includes(m.code);
                                  return (
                                    <button key={m.code} type="button" aria-pressed={on} onClick={() => toggleModifier(o.key, l.service_id, m.code)} className={cn("rounded-full border px-2.5 py-1 text-caption transition-colors", on ? "border-warning/50 bg-warning/12 text-warning" : "border-border text-muted-foreground hover:border-border-strong")}>
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
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t ? `${Math.round(t.duration_minutes / 60 * 10) / 10} h · subtotal ${formatMoney(t.subtotal)} · tax ${formatMoney(t.tax)}` : "Pick services"}</span>
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
                  <button type="button" onClick={() => setOtherFor({ scope: "addon" })} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm hover:border-border-strong">
                    <PlusIcon className="size-3.5" /> Other
                  </button>
                )}
              </div>
              {addons.length > 0 && (
                <ul className="divide-y divide-border rounded-xl border border-border text-sm" data-testid="addon-lines">
                  {addons.map((a, i) => {
                    const svc = catalog.services.find((s) => s.id === a.service_id);
                    return (
                      <li key={`${a.service_id}-${a.label ?? ""}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
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
              <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{pick.customer?.name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Car</span><span className="font-medium">{pickedVehicle ? [pickedVehicle.year, pickedVehicle.make, pickedVehicle.model].filter(Boolean).join(" ") : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Priced as</span><span className="font-medium">{SIZE_LABEL[size]}</span></div>
              {options.map((o, i) => (
                <div key={o.key} className="flex justify-between"><span className="text-muted-foreground">{o.name}{o.recommended ? " ★" : ""}</span><span className="tabular-nums">{formatMoney(totals.options[i]?.total ?? 0)}</span></div>
              ))}
              {addons.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Add-ons on by default</span><span className="tabular-nums">{formatMoney(headlineAddons)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold"><span>{options.length > 1 ? "Recommended total" : "Total"}</span><span className="tabular-nums" data-testid="estimate-total">{formatMoney(headlineTotal)}</span></div>
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

      {other && <OtherDialog open={!!otherFor} onOpenChange={(o) => !o && setOtherFor(null)} onAdd={addOther} />}
    </Page>
  );
}

/** "Other": what it is and what it costs. The only typed amount on an estimate. */
function OtherDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (label: string, price: number) => void }) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  function submit() {
    const n = Number(price);
    if (label.trim().length < 2) return void toast.error("Say what it is");
    if (!(n >= 0)) return void toast.error("Type the amount");
    onAdd(label.trim(), Math.round(n * 100) / 100);
    setLabel("");
    setPrice("");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Something not on the menu</DialogTitle>
          <DialogDescription>It shows on the estimate with this name and amount.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="other-label">What is it?</Label>
            <Input id="other-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} autoFocus placeholder="Seat extraction, rear row" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="other-price">Amount</Label>
            <Input id="other-price" type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} data-testid="other-add">Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
