"use client";

import { useState } from "react";
import { CheckIcon, PencilLineIcon, SparklesIcon } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import type { PriceListRow } from "@/lib/db/types";
import { SERVICE_CATEGORIES } from "@/lib/services";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";

export interface SelectedService {
  service_id: string;
  name: string;
  list_price: number;
  /** Quoted range from the service; inside it no reason is needed. */
  price_min: number | null;
  price_max: number | null;
  price: number;
  override_reason: string | null;
}

/** True when a price needs no written reason (matches price_within_policy() in SQL). */
export function priceWithinPolicy(s: { list_price: number; price_min: number | null; price_max: number | null }, price: number): boolean {
  if (price === s.list_price) return true;
  return s.price_min !== null && s.price_max !== null && price >= s.price_min && price <= s.price_max;
}

export function priceLabel(price: number, min: number | null, max: number | null): string {
  if (min !== null && max !== null && min !== max) return `${formatMoney(min)}–${formatMoney(max)}`;
  return formatMoney(price);
}

/**
 * Multi-select service chips grouped by category (New / Used / Service lane /
 * Add-ons) with per-line price override. Tapping a chip toggles it; the
 * pencil opens the override dialog.
 */
export function ServicePicker({
  priceList,
  value,
  onChange,
  disabled,
}: {
  priceList: PriceListRow[];
  value: SelectedService[];
  onChange: (next: SelectedService[]) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState<SelectedService | null>(null);

  function toggle(row: PriceListRow) {
    const existing = value.find((s) => s.service_id === row.service_id);
    if (existing) {
      onChange(value.filter((s) => s.service_id !== row.service_id));
    } else {
      onChange([
        ...value,
        {
          service_id: row.service_id,
          name: row.name,
          list_price: Number(row.price),
          price_min: row.price_min === null ? null : Number(row.price_min),
          price_max: row.price_max === null ? null : Number(row.price_max),
          price: Number(row.price),
          override_reason: null,
        },
      ]);
    }
  }

  function applyOverride(next: SelectedService) {
    onChange(value.map((s) => (s.service_id === next.service_id ? next : s)));
    setEditing(null);
  }

  if (priceList.length === 0) {
    return <EmptyState icon={SparklesIcon} title="No services yet" description="Add your menu in Settings → Services and it shows up here as tappable chips." className="py-8" />;
  }

  const groups = SERVICE_CATEGORIES.map((c) => ({ ...c, rows: priceList.filter((r) => (r.category ?? "addon") === c.value) })).filter((g) => g.rows.length > 0);
  const showHeaders = groups.length > 1;

  return (
    <>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.value} className="flex flex-col gap-2">
            {showHeaders && <div className="text-caption font-medium text-subtle">{g.label}</div>}
            <div className="grid grid-cols-2 gap-2.5">
              {g.rows.map((row) => {
                const selected = value.find((s) => s.service_id === row.service_id);
                const overridden = selected && selected.price !== selected.list_price;
                const ranged = row.price_min !== null && row.price_max !== null;
                return (
                  <m.div
                    key={row.service_id}
                    whileTap={disabled ? undefined : { scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className={cn(
                      "relative flex min-h-[4.25rem] items-stretch overflow-hidden rounded-xl border text-left transition-[border-color,background-color,box-shadow] duration-150",
                      selected ? "border-primary/70 bg-accent-soft shadow-[inset_0_0_0_1px_rgba(130,217,85,0.25)]" : "border-border bg-card surface-raised hover:border-border-strong hover:bg-accent/50",
                      disabled && "pointer-events-none opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      aria-pressed={!!selected}
                      className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3.5 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                        <AnimatePresence initial={false}>
                          {selected && (
                            <m.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} className="flex">
                              <CheckIcon className="size-4 shrink-0 text-primary" strokeWidth={3} />
                            </m.span>
                          )}
                        </AnimatePresence>
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className={cn("text-caption tabular-nums", overridden ? "text-warning" : "text-muted-foreground")}>
                        {selected ? formatMoney(selected.price) : priceLabel(Number(row.price), row.price_min === null ? null : Number(row.price_min), row.price_max === null ? null : Number(row.price_max))}
                        {overridden && !ranged && <span className="ml-1 line-through opacity-60">{formatMoney(selected.list_price)}</span>}
                      </span>
                    </button>
                    {selected && (
                      <button
                        type="button"
                        onClick={() => setEditing(selected)}
                        aria-label={`Change price for ${row.name}`}
                        className="flex w-11 items-center justify-center border-l border-primary/30 text-primary/80 transition-colors hover:bg-primary/15"
                      >
                        <PencilLineIcon className="size-4" />
                      </button>
                    )}
                  </m.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <OverrideDialog service={editing} onClose={() => setEditing(null)} onApply={applyOverride} />
    </>
  );
}

function OverrideDialog({
  service,
  onClose,
  onApply,
}: {
  service: SelectedService | null;
  onClose: () => void;
  onApply: (s: SelectedService) => void;
}) {
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [key, setKey] = useState<string | null>(null);

  // Reset local fields when a different service opens.
  if (service && key !== service.service_id) {
    setKey(service.service_id);
    setPrice(String(service.price));
    setReason(service.override_reason ?? "");
  }
  if (!service && key !== null) setKey(null);

  const parsed = Number(price);
  const changed = Number.isFinite(parsed) && parsed !== service?.list_price;
  const needsReason = !!service && Number.isFinite(parsed) && !priceWithinPolicy(service, parsed);
  const valid = Number.isFinite(parsed) && parsed >= 0 && (!needsReason || reason.trim().length > 0);
  const ranged = !!service && service.price_min !== null && service.price_max !== null;

  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ranged ? "Set price" : "Override price"}</DialogTitle>
          <DialogDescription>
            {service?.name} ·{" "}
            {ranged
              ? `quoted ${formatMoney(service?.price_min)}–${formatMoney(service?.price_max)}. Pick any price in that range; outside it a reason is required.`
              : `list price ${formatMoney(service?.list_price)}. A reason is required when the price differs.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="override-price">Price</Label>
            <Input id="override-price" inputMode="decimal" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="override-reason">Reason {needsReason && <span className="text-destructive">*</span>}</Label>
            <Textarea
              id="override-reason"
              placeholder="e.g. Manager approved discount, heavy soil surcharge"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => service && onApply({ ...service, price: service.list_price, override_reason: null })}>
            Reset to list
          </Button>
          <Button
            disabled={!valid}
            onClick={() => service && onApply({ ...service, price: Math.round(parsed * 100) / 100, override_reason: changed && reason.trim() ? reason.trim() : null })}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
