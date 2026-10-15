"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { LaborRate, RetailSettings } from "@/lib/db/types";
import { deleteLaborRateAction, saveLaborRateAction, saveSuppliesAction } from "@/app/(app)/settings/retail-actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Settings → Shop menu: the named labor rates an estimate's labor lines use (0044). One is the default. */
export function LaborRatesCard({ rates }: { rates: LaborRate[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<LaborRate | "new" | null>(null);

  function remove(r: LaborRate) {
    start(async () => {
      if (demo) return void toast.success("Removed", { description: "Guest preview — nothing changed" });
      const res = await deleteLaborRateAction(r.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Removed");
      router.refresh();
    });
  }

  return (
    <Card data-testid="labor-rates">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Labor rates</CardTitle>
          <CardDescription>What an hour of work costs on an estimate. The default is picked for every labor line; name others for diagnostics or heavy work.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")} data-testid="labor-rate-add">
          <PlusIcon /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {rates.map((r) => (
            <li key={r.id} className={cn("flex items-center justify-between gap-3 py-2.5", !r.active && "opacity-60")}>
              <div className="min-w-0">
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 tabular-nums text-muted-foreground">{formatMoney(r.rate)}/h</span>
                {r.is_default && <Badge variant="outline" className="ml-2"><StarIcon /> Default</Badge>}
                {!r.active && <Badge variant="muted" className="ml-2">Off</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
                  <PencilIcon />
                </Button>
                {!r.is_default && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${r.name}`} disabled={pending} onClick={() => remove(r)}>
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            </li>
          ))}
          {rates.length === 0 && <li className="py-4 text-sm text-muted-foreground">No rates yet. Add the shop rate.</li>}
        </ul>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <RateDialog rate={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </Card>
  );
}

function RateDialog({ rate, onClose }: { rate: LaborRate | null; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [name, setName] = useState(rate?.name ?? "");
  const [amount, setAmount] = useState(rate ? String(rate.rate) : "");
  const [isDefault, setIsDefault] = useState(rate?.is_default ?? false);
  const [active, setActive] = useState(rate?.active ?? true);
  function save() {
    const n = Number(amount);
    if (!name.trim()) return void toast.error("Name the rate");
    if (!(n >= 0)) return void toast.error("Type the hourly rate");
    start(async () => {
      if (demo) {
        toast.success("Rate saved", { description: "Guest preview — nothing changed" });
        onClose();
        return;
      }
      const r = await saveLaborRateAction({ id: rate?.id, name: name.trim(), rate: Math.round(n * 100) / 100, is_default: isDefault, active });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Rate saved");
      onClose();
      router.refresh();
    });
  }
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{rate ? `Edit ${rate.name}` : "Add a labor rate"}</DialogTitle>
        <DialogDescription>Per hour, before tax.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5"><Label htmlFor="lr-name">Name</Label><Input id="lr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Shop rate" autoFocus /></div>
        <div className="grid gap-1.5"><Label htmlFor="lr-rate">Rate per hour</Label><Input id="lr-rate" type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="120.00" /></div>
        <label className="flex items-center justify-between gap-3 text-sm"><span>The default rate</span><Switch checked={isDefault} onCheckedChange={setIsDefault} /></label>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Offered</span><Switch checked={active} onCheckedChange={setActive} /></label>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} loading={pending} data-testid="labor-rate-save">Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Shop supplies as a share of labor (capped), and what is taxed by default (0044). Owner only: money. */
export function SuppliesCard({ settings }: { settings: RetailSettings | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [pct, setPct] = useState(String(settings?.shop_supplies_pct ?? 0));
  const [cap, setCap] = useState(settings?.shop_supplies_cap === null || settings?.shop_supplies_cap === undefined ? "" : String(settings.shop_supplies_cap));
  const [supTax, setSupTax] = useState(!!settings?.shop_supplies_taxable);
  const [partsTax, setPartsTax] = useState(settings?.parts_taxable_default ?? true);
  const [laborTax, setLaborTax] = useState(!!settings?.labor_taxable_default);
  const [markup, setMarkup] = useState(settings?.parts_markup_pct === null || settings?.parts_markup_pct === undefined ? "" : String(settings.parts_markup_pct));
  function save() {
    const p = Number(pct);
    if (!(p >= 0 && p <= 100)) return void toast.error("Supplies: 0 to 100 percent");
    const mk = markup.trim() === "" ? null : Number(markup);
    if (mk !== null && !(mk >= 0 && mk <= 1000)) return void toast.error("Parts markup: 0 to 1000 percent");
    start(async () => {
      if (demo) return void toast.success("Saved", { description: "Guest preview — nothing changed" });
      const r = await saveSuppliesAction({ shop_supplies_pct: p, shop_supplies_cap: cap.trim() === "" ? null : Number(cap), shop_supplies_taxable: supTax, parts_taxable_default: partsTax, labor_taxable_default: laborTax, parts_markup_pct: mk });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      router.refresh();
    });
  }
  return (
    <Card data-testid="shop-supplies">
      <CardHeader>
        <CardTitle>Shop supplies and tax</CardTitle>
        <CardDescription>Shop supplies are a share of the labor on an estimate, capped. The customer sees them as their own line under the work; nothing they can untick. Tax follows your seller&apos;s permit: parts yes, labor no, unless you say otherwise.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="sup-pct">Shop supplies, % of labor</Label><Input id="sup-pct" type="number" inputMode="decimal" min={0} max={100} step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="sup-cap">Cap per estimate (blank = none)</Label><Input id="sup-cap" type="number" inputMode="decimal" min={0} step="0.01" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="25.00" /></div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="parts-markup">Parts markup, % over your cost (blank = none)</Label>
          <Input id="parts-markup" type="number" inputMode="decimal" min={0} max={1000} step="1" value={markup} onChange={(e) => setMarkup(e.target.value)} placeholder="40" data-testid="parts-markup" />
          <p className="text-caption text-subtle">When you type what a part cost you on an estimate, the list price is filled in as cost + this percent. You can overwrite it on any part. The customer only ever sees the list price.</p>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Tax the shop supplies</span><Switch checked={supTax} onCheckedChange={setSupTax} /></label>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Parts are taxable by default</span><Switch checked={partsTax} onCheckedChange={setPartsTax} /></label>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Labor is taxable by default</span><Switch checked={laborTax} onCheckedChange={setLaborTax} /></label>
        <div><Button size="sm" onClick={save} loading={pending} data-testid="supplies-save">Save</Button></div>
      </CardContent>
    </Card>
  );
}
