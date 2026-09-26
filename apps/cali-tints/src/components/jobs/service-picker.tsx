"use client";

import { useState } from "react";
import { CheckIcon, PencilLineIcon } from "lucide-react";
import type { PriceListRow } from "@/lib/db/types";
import { SERVICE_CATEGORIES } from "@/lib/services";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface SelectedService {
  service_id: string;
  name: string;
  list_price: number;
  price: number;
  override_reason: string | null;
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
      onChange([...value, { service_id: row.service_id, name: row.name, list_price: Number(row.price), price: Number(row.price), override_reason: null }]);
    }
  }

  function applyOverride(next: SelectedService) {
    onChange(value.map((s) => (s.service_id === next.service_id ? next : s)));
    setEditing(null);
  }

  if (priceList.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No active services. Add some in Settings → Services.</p>;
  }

  const groups = SERVICE_CATEGORIES.map((c) => ({ ...c, rows: priceList.filter((r) => (r.category ?? "addon") === c.value) })).filter((g) => g.rows.length > 0);
  const showHeaders = groups.length > 1;

  return (
    <>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.value} className="flex flex-col gap-2">
            {showHeaders && <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{g.label}</div>}
            <div className="grid grid-cols-2 gap-2.5">
              {g.rows.map((row) => {
                const selected = value.find((s) => s.service_id === row.service_id);
                const overridden = selected && selected.price !== selected.list_price;
                return (
                  <div
                    key={row.service_id}
                    className={cn(
                      "relative flex min-h-[4.25rem] items-stretch overflow-hidden rounded-xl border text-left transition-colors",
                      selected ? "border-primary/70 bg-primary/10" : "border-border bg-card hover:bg-accent/60",
                      disabled && "pointer-events-none opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      aria-pressed={!!selected}
                      className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3.5 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                        {selected && <CheckIcon className="size-4 shrink-0 text-primary" strokeWidth={3} />}
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className={cn("text-xs tabular-nums", overridden ? "text-warning" : "text-muted-foreground")}>
                        {formatMoney(selected ? selected.price : row.price)}
                        {overridden && <span className="ml-1 line-through opacity-60">{formatMoney(selected.list_price)}</span>}
                      </span>
                    </button>
                    {selected && (
                      <button
                        type="button"
                        onClick={() => setEditing(selected)}
                        aria-label={`Change price for ${row.name}`}
                        className="flex w-11 items-center justify-center border-l border-primary/30 text-primary/80 hover:bg-primary/15"
                      >
                        <PencilLineIcon className="size-4" />
                      </button>
                    )}
                  </div>
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
  const valid = Number.isFinite(parsed) && parsed >= 0 && (!changed || reason.trim().length > 0);

  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override price</DialogTitle>
          <DialogDescription>
            {service?.name} · list price {formatMoney(service?.list_price)}. A reason is required when the price differs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="override-price">Price</Label>
            <Input id="override-price" inputMode="decimal" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="override-reason">Reason {changed && <span className="text-destructive">*</span>}</Label>
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
            onClick={() => service && onApply({ ...service, price: Math.round(parsed * 100) / 100, override_reason: changed ? reason.trim() : null })}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
