"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClockIcon } from "lucide-react";
import { toast } from "sonner";
import type { EstimateLabel, EstimateView, PartsStatus } from "@/lib/db/types";
import { setEstimateMetaAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { ageShort } from "@/lib/retail/estimate-stage";
import { LABELS, PARTS, STATUS_WORDS } from "@/lib/retail/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none";
/** "2026-10-20T09:00:00Z" → the value a datetime-local input wants, in the browser's time. */
const toLocal = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-caption text-subtle">{label}</span>
      {children}
    </div>
  );
}

/**
 * The work order's own fields, like the shop's header card: advisor and tech,
 * the label (VIP, Drop-off…), the status word, parts, due in / due out, fleet
 * number, and how long it has been open. A tech sets the status word and the
 * parts; the advisor sets the rest.
 */
export function EstimateMeta({ e, tech }: { e: EstimateView; tech: string | null }) {
  const router = useRouter();
  const { canPrices, demo } = useSession();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState<string>(e.label ?? NONE);
  const [status, setStatus] = useState<string>(e.status_label ?? NONE);
  const [parts, setParts] = useState<PartsStatus>(e.parts_status ?? "none");
  const [dueIn, setDueIn] = useState(toLocal(e.due_in));
  const [dueOut, setDueOut] = useState(toLocal(e.due_out));
  const [fleet, setFleet] = useState(e.fleet_number ?? "");

  function save(patch: Parameters<typeof setEstimateMetaAction>[1]) {
    start(async () => {
      if (demo) return void toast.success("Saved", { description: "Guest preview — nothing changed" });
      const r = await setEstimateMetaAction(e.id, patch);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  }
  const iso = (local: string) => (local ? new Date(local).toISOString() : null);

  return (
    <Card data-testid="estimate-meta-card" className={pending ? "opacity-80" : undefined}>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span><span className="text-subtle">Advisor </span><span className="font-medium">{e.advisor ?? "—"}</span></span>
            <span><span className="text-subtle">Tech </span><span className="font-medium">{tech ?? "—"}</span></span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-caption text-muted-foreground" title="How long it has been open" data-testid="estimate-age"><ClockIcon className="size-3" /> {ageShort(e.created_at)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4">
          <Field label="Label">
            <Select value={label} onValueChange={(v) => { setLabel(v); save({ label: v === NONE ? null : (v as EstimateLabel) }); }} disabled={!canPrices}>
              <SelectTrigger className="h-8 w-full" data-testid="meta-label"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={(v) => { setStatus(v); save({ status_label: v === NONE ? null : v }); }}>
              <SelectTrigger className="h-8 w-full" data-testid="meta-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {STATUS_WORDS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Parts">
            <Select value={parts} onValueChange={(v) => { setParts(v as PartsStatus); save({ parts_status: v }); }}>
              <SelectTrigger className="h-8 w-full" data-testid="meta-parts"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARTS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fleet number">
            <Input className="h-8" value={fleet} onChange={(ev) => setFleet(ev.target.value)} onBlur={() => fleet !== (e.fleet_number ?? "") && save({ fleet_number: fleet || null })} disabled={!canPrices} maxLength={40} data-testid="meta-fleet" />
          </Field>
          <Field label="Due in">
            <Input type="datetime-local" className="h-8" value={dueIn} onChange={(ev) => setDueIn(ev.target.value)} onBlur={() => dueIn !== toLocal(e.due_in) && save({ due_in: iso(dueIn) })} disabled={!canPrices} data-testid="meta-due-in" />
          </Field>
          <Field label="Due out">
            <Input type="datetime-local" className="h-8" value={dueOut} onChange={(ev) => setDueOut(ev.target.value)} onBlur={() => dueOut !== toLocal(e.due_out) && save({ due_out: iso(dueOut) })} disabled={!canPrices} data-testid="meta-due-out" />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
