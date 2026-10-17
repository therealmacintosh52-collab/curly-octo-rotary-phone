"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyIcon, DropletIcon, HistoryIcon, KeyRoundIcon, PackageIcon, ScanSearchIcon } from "lucide-react";
import { toast } from "sonner";
import type { EstimateView } from "@/lib/db/types";
import type { VinDecodeResult } from "@/lib/vin";
import { vinStatus } from "@/lib/vin";
import { decodeVin } from "@/lib/vin-client";
import { orderPartsForEstimateAction } from "@/app/(app)/retail/parts/actions";
import { useSession } from "@/components/app/session-provider";
import { PrintButton } from "@/components/retail/print-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KEY = "cali-tints:oil-sticker";
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as { miles?: string; months?: string; oil?: string };
  } catch {
    return {};
  }
};
const remember = (v: { miles: string; months: string; oil: string }) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* private mode */
  }
};

/** The shop's habits on a work order: key tag, oil change sticker, the car's service history, and its VIN. */
export function ShortcutRow({ e, canOrder = false }: { e: EstimateView; /** Owner, admin and advisor: make a draft order from the part lines that are not in stock. */ canOrder?: boolean }) {
  const { demo } = useSession();
  const router = useRouter();
  const [ordering, setOrdering] = useState(false);
  const parts = e.options.some((o) => o.lines.some((l) => l.line_type === "part" && l.customer_approved !== false));
  async function orderParts() {
    if (demo) return void toast.success("Order started", { description: "Guest preview: it would open the draft order" });
    setOrdering(true);
    const r = await orderPartsForEstimateAction(e.id);
    setOrdering(false);
    if (!r.ok) return void toast.error(r.error);
    router.push(`/retail/parts?tab=orders&open=${r.data.id}`);
  }
  const [oilOpen, setOilOpen] = useState(false);
  const [vinOpen, setVinOpen] = useState(false);
  const vin = e.vehicle?.vin ?? null;
  const preview = () => toast.message("Guest preview", { description: "Labels print from the live app." });
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="shortcut-row">
      {demo ? (
        <Button type="button" variant="outline" size="sm" onClick={preview} data-testid="shortcut-key-tag">
          <KeyRoundIcon /> Key tag
        </Button>
      ) : (
        <PrintButton href={`/api/estimates/${e.id}/key-tag`} label="Key tag" size="sm" testId="shortcut-key-tag" />
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setOilOpen(true)} data-testid="shortcut-oil-sticker">
        <DropletIcon /> Oil sticker
      </Button>
      {e.vehicle && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/retail/vehicles/${e.vehicle.id}`} data-testid="shortcut-history">
            <HistoryIcon /> Service history
          </Link>
        </Button>
      )}
      {vin && (
        <Button type="button" variant="outline" size="sm" onClick={() => setVinOpen(true)} data-testid="shortcut-vin">
          <ScanSearchIcon /> VIN
        </Button>
      )}
      {canOrder && parts && (
        <Button type="button" variant="outline" size="sm" onClick={orderParts} loading={ordering} data-testid="shortcut-order-parts">
          <PackageIcon /> Order parts
        </Button>
      )}
      {oilOpen && <OilStickerDialog id={e.id} demo={!!demo} onClose={() => setOilOpen(false)} onPreview={preview} />}
      {vinOpen && vin && <VinDialog vin={vin} onClose={() => setVinOpen(false)} />}
    </div>
  );
}

function OilStickerDialog({ id, demo, onClose, onPreview }: { id: string; demo: boolean; onClose: () => void; onPreview: () => void }) {
  const saved = read();
  const [miles, setMiles] = useState(saved.miles ?? "5000");
  const [months, setMonths] = useState(saved.months ?? "6");
  const [oil, setOil] = useState(saved.oil ?? "");
  const q = new URLSearchParams({ miles: miles || "5000", months: months || "6", ...(oil.trim() ? { oil: oil.trim() } : {}) }).toString();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Oil change sticker</DialogTitle>
          <DialogDescription>A 3 × 2 inch sticker with today&apos;s date and mileage and when the next change is due.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="oil-miles">Next change in (miles)</Label>
            <Input id="oil-miles" inputMode="numeric" value={miles} onChange={(e) => setMiles(e.target.value.replace(/\D/g, "").slice(0, 5))} data-testid="oil-miles" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="oil-months">or months</Label>
            <Input id="oil-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, "").slice(0, 2))} data-testid="oil-months" />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label htmlFor="oil-type">Oil used (optional)</Label>
            <Input id="oil-type" value={oil} onChange={(e) => setOil(e.target.value)} maxLength={24} placeholder="5W-30 synthetic" data-testid="oil-type" />
          </div>
        </div>
        <div className="flex justify-end" onClickCapture={() => remember({ miles, months, oil })}>
          {demo ? (
            <Button type="button" onClick={onPreview} data-testid="oil-print">Print</Button>
          ) : (
            <PrintButton href={`/api/estimates/${id}/oil-sticker?${q}`} label="Print the sticker" variant="default" testId="oil-print" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VinDialog({ vin, onClose }: { vin: string; onClose: () => void }) {
  const [result, setResult] = useState<VinDecodeResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const status = vinStatus(vin);
  async function lookup() {
    setState("loading");
    try {
      setResult(await decodeVin(vin));
      setState("idle");
    } catch {
      setState("error");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(vin);
      toast.success("VIN copied");
    } catch {
      toast.error("Could not copy; long-press the VIN instead");
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>VIN</DialogTitle>
          <DialogDescription>The check digit and what the VIN says about the car (NHTSA).</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
          <code className="text-base tracking-wider" data-testid="vin-value">{vin}</code>
          <Button type="button" size="sm" variant="outline" onClick={copy}>
            <CopyIcon /> Copy
          </Button>
        </div>
        {status === "warn" && <p className="text-sm text-warning" data-testid="vin-warn">The check digit does not match: re-read the VIN from the door jamb or windshield.</p>}
        {status === "invalid" && <p className="text-sm text-warning">This does not look like a full VIN.</p>}
        <Button type="button" variant="outline" onClick={lookup} loading={state === "loading"} data-testid="vin-decode">
          Decode it
        </Button>
        {state === "error" && <p className="text-sm text-muted-foreground">Could not read this VIN right now. Try again with a signal.</p>}
        {result && (
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm" data-testid="vin-result">
            {([["Year", result.year], ["Make", result.make], ["Model", result.model], ["Trim", result.trim], ["Engine", result.engineSize ? `${result.engineSize}${result.engineCode ? ` (${result.engineCode})` : ""}` : null], ["Body", result.bodyClass]] as const).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
