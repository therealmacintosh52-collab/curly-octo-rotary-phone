"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import type { Service, ServiceCategory } from "@/lib/db/types";
import { categoryLabel, SERVICE_CATEGORIES } from "@/lib/services";
import { saveServiceAction, setDealershipPriceAction } from "@/app/(app)/settings/actions";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Draft = { id?: string; name: string; description: string; category: ServiceCategory; default_price: string; price_min: string; price_max: string; sort_order: string; active: boolean };
const empty: Draft = { name: "", description: "", category: "addon", default_price: "", price_min: "", price_max: "", sort_order: "100", active: true };

export function ServicesManager({
  services,
  dealerships,
  prices,
}: {
  services: Service[];
  dealerships: { id: string; name: string }[];
  prices: { dealership_id: string; service_id: string; price: number }[];
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const priceMap = new Map(prices.map((p) => [`${p.dealership_id}:${p.service_id}`, Number(p.price)]));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Price list</CardTitle>
          <CardDescription>Default price applies everywhere; per-dealership cells override it. Blank cell = default. Detailers cannot change prices.</CardDescription>
          <div className="pt-2">
            <Button size="sm" onClick={() => setEditing({ ...empty })}>
              <PlusIcon /> Add service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Default</TableHead>
                {dealerships.map((d) => (
                  <TableHead key={d.id} className="text-right">
                    {d.name.replace(/^Mercedes-Benz of /, "MB ")}
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id} className={cn(!s.active && "opacity-50")}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                      {s.name} <Badge variant="outline">{categoryLabel(s.category)}</Badge> {!s.active && <Badge variant="muted">Inactive</Badge>}
                    </div>
                    {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(s.default_price)}
                    {s.price_min !== null && s.price_max !== null && (
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(s.price_min)}–{formatMoney(s.price_max)} no reason needed
                      </div>
                    )}
                  </TableCell>
                  {dealerships.map((d) => (
                    <TableCell key={d.id} className="text-right">
                      <PriceCell dealershipId={d.id} serviceId={s.id} value={priceMap.get(`${d.id}:${s.id}`) ?? null} fallback={Number(s.default_price)} />
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() =>
                        setEditing({ id: s.id, name: s.name, description: s.description ?? "", category: s.category ?? "addon", default_price: String(s.default_price), price_min: s.price_min === null ? "" : String(s.price_min), price_max: s.price_max === null ? "" : String(s.price_max), sort_order: String(s.sort_order), active: s.active })
                      }
                    >
                      <PencilIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {services.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3 + dealerships.length} className="text-center text-muted-foreground">
                    No services yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <ServiceDialog draft={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

/** Inline editable override cell; saves on blur/Enter, clears on empty. */
function PriceCell({ dealershipId, serviceId, value, fallback }: { dealershipId: string; serviceId: string; value: number | null; fallback: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(value === null ? "" : String(value));

  function commit() {
    const trimmed = text.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && !Number.isFinite(next)) return toast.error("Enter a number");
    if (next === value) return;
    start(async () => {
      const r = await setDealershipPriceAction(dealershipId, serviceId, next);
      if (!r.ok) toast.error(r.error);
      else router.refresh();
    });
  }

  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      value={text}
      placeholder={fallback.toFixed(2)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      disabled={pending}
      className={cn("ml-auto h-9 w-28 text-right text-sm", value !== null && "border-primary/50 bg-primary/5")}
      aria-label="Dealership price"
    />
  );
}

function ServiceDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(draft);
  return (
    <DialogContent>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveServiceAction({
              id: f.id,
              name: f.name,
              description: f.description,
              category: f.category,
              default_price: Number(f.default_price),
              price_min: f.price_min.trim() === "" ? null : Number(f.price_min),
              price_max: f.price_max.trim() === "" ? null : Number(f.price_max),
              sort_order: Number(f.sort_order),
              active: f.active,
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
          <DialogTitle>{f.id ? "Edit service" : "New service"}</DialogTitle>
          <DialogDescription>Deactivate instead of deleting: past jobs and invoices keep referencing it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="s-name">Name</Label>
          <Input id="s-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="s-desc">Description</Label>
          <Input id="s-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>Category</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as ServiceCategory })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label} — {c.hint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="s-price">Default price</Label>
            <Input id="s-price" type="number" step="0.01" min="0" inputMode="decimal" value={f.default_price} onChange={(e) => setF({ ...f, default_price: e.target.value })} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-sort">Sort order</Label>
            <Input id="s-sort" type="number" min="0" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Quoted range (optional)</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="Min, e.g. 20" value={f.price_min} onChange={(e) => setF({ ...f, price_min: e.target.value })} aria-label="Range minimum" />
            <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="Max, e.g. 40" value={f.price_max} onChange={(e) => setF({ ...f, price_max: e.target.value })} aria-label="Range maximum" />
          </div>
          <p className="text-xs text-muted-foreground">For work quoted as a range (touch-up $20–40): any price inside it is accepted without a reason.</p>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="text-sm font-medium">Active</div>
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
