"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOffIcon, LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { AutomationLogRow, AutomationRule, BlackoutDay, BusinessHour, Resource, ResourceKind, RetailSettings, TimeOff } from "@/lib/db/types";
import { AutomationsCard } from "./automations-card";
import { addBlackoutAction, addTimeOffAction, removeBlackoutAction, removeTimeOffAction, saveHoursAction, saveResourceAction, saveRetailSettingsAction, saveTemplatesAction } from "@/app/(app)/settings/retail-actions";
import { useSession } from "@/components/app/session-provider";
import { formatDate, formatDateOnly, formatDateTime } from "@/lib/dates";
import { DEFAULT_TEMPLATES, TEMPLATE_META, templateFor, type TemplateKey } from "@/lib/retail/templates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const KIND_LABEL: Record<ResourceKind, string> = { bay: "Bay", lift: "Lift", tech: "Tech" };

export interface BookingSettingsData {
  settings: RetailSettings;
  hours: BusinessHour[];
  resources: Resource[];
  blackouts: BlackoutDay[];
  timeOff: TimeOff[];
  people: { id: string; full_name: string }[];
  rules: AutomationRule[];
  log: AutomationLogRow[];
}

/**
 * Settings → Booking (owner/admin): the policy walk-in bookings run on
 * (deposit, hold, cancellation, slots, reminders, signatures, tax rule),
 * when the shop is open, what it has (bays, lifts, techs), days off, and the
 * emails customers get.
 */
export function BookingSettings({ data }: { data: BookingSettingsData }) {
  return (
    <div className="flex flex-col gap-6" data-testid="booking-settings">
      <PolicyCard settings={data.settings} />
      <HoursCard hours={data.hours} />
      <ResourcesCard resources={data.resources} people={data.people} />
      <DaysOffCard blackouts={data.blackouts} timeOff={data.timeOff} resources={data.resources} />
      <TemplatesCard settings={data.settings} />
      <AutomationsCard rules={data.rules} log={data.log} />
    </div>
  );
}

function useDemoGuard() {
  const { demo } = useSession();
  return (what: string) => {
    if (demo) toast.success(what, { description: "Guest preview — nothing changed" });
    return demo;
  };
}

function PolicyCard({ settings: s }: { settings: RetailSettings }) {
  const router = useRouter();
  const guard = useDemoGuard();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    deposit_kind: s.deposit_kind,
    deposit_value: String(Number(s.deposit_value)),
    deposit_refundable: s.deposit_refundable,
    hold_minutes: String(s.hold_minutes),
    cancel_hours: String(s.cancel_hours),
    slot_step_minutes: String(s.slot_step_minutes),
    lead_time_hours: String(s.lead_time_hours),
    max_days_ahead: String(s.max_days_ahead),
    reminder_hours: s.reminder_hours.join(", "),
    online_booking_enabled: s.online_booking_enabled,
    estimate_valid_days: String(s.estimate_valid_days),
    tax_all_lines: s.tax_all_lines,
    signature_required_estimate: s.signature_required_estimate,
    signature_required_receipt: s.signature_required_receipt,
    policy_text: s.policy_text ?? "",
    warranty_text: s.warranty_text ?? "",
    review_url: s.review_url ?? "",
    quiet_from: (s.quiet_from ?? "20:00").slice(0, 5),
    quiet_to: (s.quiet_to ?? "08:00").slice(0, 5),
    abandoned_minutes: String(s.abandoned_minutes ?? 15),
    review_delay_minutes: String(s.review_delay_minutes ?? 30),
    review_skip_days: String(s.review_skip_days ?? 90),
    estimate_nudge_days: String(s.estimate_nudge_days ?? 3),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      if (guard("Policy saved")) return;
      const r = await saveRetailSettingsAction({
        deposit_kind: f.deposit_kind,
        deposit_value: Number(f.deposit_value) || 0,
        deposit_refundable: f.deposit_refundable,
        hold_minutes: Number(f.hold_minutes),
        cancel_hours: Number(f.cancel_hours),
        slot_step_minutes: Number(f.slot_step_minutes) as 15 | 30 | 60,
        lead_time_hours: Number(f.lead_time_hours),
        max_days_ahead: Number(f.max_days_ahead),
        reminder_hours: f.reminder_hours.split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0),
        online_booking_enabled: f.online_booking_enabled,
        estimate_valid_days: Number(f.estimate_valid_days),
        tax_all_lines: f.tax_all_lines,
        signature_required_estimate: f.signature_required_estimate,
        signature_required_receipt: f.signature_required_receipt,
        policy_text: f.policy_text,
        warranty_text: f.warranty_text,
        review_url: f.review_url,
        quiet_from: f.quiet_from,
        quiet_to: f.quiet_to,
        abandoned_minutes: Number(f.abandoned_minutes),
        review_delay_minutes: Number(f.review_delay_minutes),
        review_skip_days: Number(f.review_skip_days),
        estimate_nudge_days: Number(f.estimate_nudge_days),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Policy saved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking policy</CardTitle>
        <CardDescription>Deposit, how long a spot is held, cancellation, slot size, reminders, signatures, tax.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4" data-testid="policy-form">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Deposit</Label>
              <Select value={f.deposit_kind} onValueChange={(v) => set("deposit_kind", v as RetailSettings["deposit_kind"])}>
                <SelectTrigger aria-label="Deposit kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent of the total</SelectItem>
                  <SelectItem value="flat">Flat amount</SelectItem>
                  <SelectItem value="none">No deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-dep">{f.deposit_kind === "percent" ? "Percent" : "Amount"}</Label>
              <Input id="p-dep" type="number" min="0" step="1" inputMode="decimal" value={f.deposit_value} onChange={(e) => set("deposit_value", e.target.value)} disabled={f.deposit_kind === "none"} />
            </div>
            <label className="flex items-center justify-between gap-3 self-end rounded-lg border border-border px-3 py-2.5 text-sm">
              <span>Refundable</span>
              <Switch checked={f.deposit_refundable} onCheckedChange={(v) => set("deposit_refundable", v)} aria-label="Deposit refundable" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Num id="p-hold" label="Hold a spot (minutes)" value={f.hold_minutes} onChange={(v) => set("hold_minutes", v)} min={5} />
            <Num id="p-cancel" label="Cancel notice (hours)" value={f.cancel_hours} onChange={(v) => set("cancel_hours", v)} min={0} />
            <div className="grid gap-1.5">
              <Label>Slot size</Label>
              <Select value={f.slot_step_minutes} onValueChange={(v) => set("slot_step_minutes", v)}>
                <SelectTrigger aria-label="Slot size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Num id="p-lead" label="Earliest booking (hours ahead)" value={f.lead_time_hours} onChange={(v) => set("lead_time_hours", v)} min={0} />
            <Num id="p-ahead" label="Book up to (days ahead)" value={f.max_days_ahead} onChange={(v) => set("max_days_ahead", v)} min={1} />
            <div className="grid gap-1.5">
              <Label htmlFor="p-rem">Reminders (hours before)</Label>
              <Input id="p-rem" value={f.reminder_hours} onChange={(e) => set("reminder_hours", e.target.value)} placeholder="24, 2" />
            </div>
            <Num id="p-est" label="Estimates good for (days)" value={f.estimate_valid_days} onChange={(v) => set("estimate_valid_days", v)} min={1} />
          </div>
          <div className="grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-2">
            <Row label="Online booking on" checked={f.online_booking_enabled} onChange={(v) => set("online_booking_enabled", v)} />
            <Row label="Tax every line (not just parts)" checked={f.tax_all_lines} onChange={(v) => set("tax_all_lines", v)} />
            <Row label="Signature required on estimates" checked={f.signature_required_estimate} onChange={(v) => set("signature_required_estimate", v)} />
            <Row label="Signature required on receipts" checked={f.signature_required_receipt} onChange={(v) => set("signature_required_receipt", v)} />
          </div>
          <div className="grid gap-3 rounded-lg border border-border p-3" data-testid="automation-settings">
            <div className="text-sm font-semibold">Follow-ups</div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-review">Google review link</Label>
              <Input id="p-review" value={f.review_url} onChange={(e) => set("review_url", e.target.value)} placeholder="https://g.page/r/…/review" inputMode="url" />
              <p className="text-caption text-subtle">Google Business Profile → Ask for reviews → copy the link. Without it the review request stays off.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Num id="p-review-delay" label="Ask for a review (minutes after paid)" value={f.review_delay_minutes} onChange={(v) => set("review_delay_minutes", v)} min={0} />
              <Num id="p-review-skip" label="Don't ask again for (days)" value={f.review_skip_days} onChange={(v) => set("review_skip_days", v)} min={0} />
              <Num id="p-nudge" label="Nudge an unanswered estimate (days)" value={f.estimate_nudge_days} onChange={(v) => set("estimate_nudge_days", v)} min={0} />
              <Num id="p-abandoned" label="Abandoned booking follow-up (minutes)" value={f.abandoned_minutes} onChange={(v) => set("abandoned_minutes", v)} min={1} />
              <div className="grid gap-1.5">
                <Label htmlFor="p-quiet-from">Quiet hours from</Label>
                <Input id="p-quiet-from" type="time" value={f.quiet_from} onChange={(e) => set("quiet_from", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-quiet-to">Quiet hours until</Label>
                <Input id="p-quiet-to" type="time" value={f.quiet_to} onChange={(e) => set("quiet_to", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-policy">Policy text shown to customers</Label>
            <Textarea id="p-policy" value={f.policy_text} onChange={(e) => set("policy_text", e.target.value)} placeholder="Deposits are non-refundable. Cancel or reschedule up to 24 hours before…" className="min-h-20" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-warranty">Warranty text on the invoice</Label>
            <Textarea id="p-warranty" data-testid="warranty-text" value={f.warranty_text} onChange={(e) => set("warranty_text", e.target.value)} placeholder="Parts and labor are warranted for 12 months or 12,000 miles…" className="min-h-20" maxLength={1000} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={pending} data-testid="policy-save">
              Save policy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function HoursCard({ hours }: { hours: BusinessHour[] }) {
  const router = useRouter();
  const guard = useDemoGuard();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(() => [0, 1, 2, 3, 4, 5, 6].map((d) => hours.find((h) => h.dow === d) ?? { dow: d, opens: "08:00", closes: "17:00", closed: d === 0 }));
  const upd = (dow: number, patch: Partial<{ opens: string; closes: string; closed: boolean }>) => setRows((rs) => rs.map((r) => (r.dow === dow ? { ...r, ...patch } : r)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours</CardTitle>
        <CardDescription>When the shop takes cars. Slots are offered inside these hours.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2" data-testid="hours">
          {rows.map((r) => (
            <div key={r.dow} className={cn("grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-sm", r.closed && "text-muted-foreground")}>
              <span className="font-medium">{DOW[r.dow]}</span>
              <Input type="time" value={r.opens.slice(0, 5)} onChange={(e) => upd(r.dow, { opens: e.target.value })} disabled={r.closed} aria-label={`${DOW[r.dow]} opens`} className="w-28" />
              <Input type="time" value={r.closes.slice(0, 5)} onChange={(e) => upd(r.dow, { closes: e.target.value })} disabled={r.closed} aria-label={`${DOW[r.dow]} closes`} className="w-28" />
              <label className="flex items-center gap-2">
                <span className="text-caption">Closed</span>
                <Switch checked={r.closed} onCheckedChange={(v) => upd(r.dow, { closed: v })} aria-label={`${DOW[r.dow]} closed`} />
              </label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                if (guard("Hours saved")) return;
                const r = await saveHoursAction(rows.map((x) => ({ dow: x.dow, opens: x.opens.slice(0, 5), closes: x.closes.slice(0, 5), closed: x.closed })));
                if (!r.ok) return void toast.error(r.error);
                toast.success("Hours saved");
                router.refresh();
              })
            }
            data-testid="hours-save"
          >
            Save hours
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourcesCard({ resources, people }: { resources: Resource[]; people: { id: string; full_name: string }[] }) {
  const [editing, setEditing] = useState<Resource | "new" | null>(null);
  const groups: ResourceKind[] = ["bay", "lift", "tech"];
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Bays, lifts and techs</CardTitle>
          <CardDescription>What a booking needs. A service lists the kinds it takes; a slot is offered only when one of each is free and a tech with the skill is on.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")} data-testid="resource-add">
          <PlusIcon /> Add
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3" data-testid="resources">
        {groups.map((k) => (
          <div key={k}>
            <div className="text-label mb-2 text-subtle">{KIND_LABEL[k]}s</div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {resources
                .filter((r) => r.kind === k)
                .map((r) => (
                  <li key={r.id} className={cn("flex items-center justify-between gap-2 px-3 py-2 text-sm", !r.active && "opacity-60")}>
                    <span className="min-w-0">
                      <span className="font-medium">{r.name}</span>
                      {k === "tech" && r.skills.length > 0 && <span className="block truncate text-caption text-subtle">{r.skills.join(", ")}</span>}
                      {!r.active && <Badge variant="muted" className="ml-1">Off</Badge>}
                    </span>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
                      <PencilIcon />
                    </Button>
                  </li>
                ))}
              {resources.filter((r) => r.kind === k).length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">None</li>}
            </ul>
          </div>
        ))}
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <ResourceDialog resource={editing === "new" ? null : editing} people={people} onClose={() => setEditing(null)} />}
      </Dialog>
    </Card>
  );
}

function ResourceDialog({ resource, people, onClose }: { resource: Resource | null; people: { id: string; full_name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const guard = useDemoGuard();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ kind: resource?.kind ?? ("bay" as ResourceKind), name: resource?.name ?? "", profile_id: resource?.profile_id ?? "", skills: resource?.skills.join(", ") ?? "", active: resource?.active ?? true, sort_order: String(resource?.sort_order ?? 100) });
  return (
    <DialogContent>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (guard("Saved")) return void onClose();
            const r = await saveResourceAction({ id: resource?.id, kind: f.kind, name: f.name, profile_id: f.profile_id || null, skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean), active: f.active, sort_order: Number(f.sort_order) });
            if (!r.ok) return void toast.error(r.error);
            toast.success("Saved");
            onClose();
            router.refresh();
          });
        }}
        className="grid gap-4"
      >
        <DialogHeader>
          <DialogTitle>{resource ? `Edit ${resource.name}` : "Add a bay, lift or tech"}</DialogTitle>
          <DialogDescription>Turn one off instead of deleting it; the calendar keeps its history.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Kind</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as ResourceKind })}>
              <SelectTrigger aria-label="Kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["bay", "lift", "tech"] as ResourceKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-name">Name</Label>
            <Input id="r-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </div>
        </div>
        {f.kind === "tech" && (
          <>
            <div className="grid gap-1.5">
              <Label>Who</Label>
              <Select value={f.profile_id || "none"} onValueChange={(v) => setF({ ...f, profile_id: v === "none" ? "" : v })}>
                <SelectTrigger aria-label="Who">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not a user of the app</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-skills">Skills</Label>
              <Input id="r-skills" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} placeholder="detail, correction, mechanic" />
              <p className="text-xs text-muted-foreground">A service that needs a skill is only offered when a tech with it is free.</p>
            </div>
          </>
        )}
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

function DaysOffCard({ blackouts, timeOff, resources }: { blackouts: BlackoutDay[]; timeOff: TimeOff[]; resources: Resource[] }) {
  const router = useRouter();
  const guard = useDemoGuard();
  const [pending, start] = useTransition();
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [to, setTo] = useState({ resource_id: resources.find((r) => r.kind === "tech")?.id ?? "", from: "", until: "", reason: "" });
  const name = (id: string) => resources.find((r) => r.id === id)?.name ?? "Resource";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarOffIcon className="size-4 text-primary" /> Days off
        </CardTitle>
        <CardDescription>Days the shop is closed, and time off for one bay, lift or tech.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="text-label mb-2 text-subtle">Shop closed</div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                if (guard("Day added")) return;
                const r = await addBlackoutAction(day, reason);
                if (!r.ok) return void toast.error(r.error);
                setDay("");
                setReason("");
                router.refresh();
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="bo-day">Date</Label>
              <Input id="bo-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
            </div>
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="bo-reason">Reason</Label>
              <Input id="bo-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Thanksgiving" />
            </div>
            <Button type="submit" variant="outline" loading={pending} data-testid="blackout-add">
              <PlusIcon /> Add
            </Button>
          </form>
          <ul className="mt-3 divide-y divide-border text-sm" data-testid="blackouts">
            {blackouts.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>
                  {formatDateOnly(b.day, "EEE, MMM d, yyyy")}
                  {b.reason ? <span className="text-muted-foreground"> · {b.reason}</span> : null}
                </span>
                <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => start(async () => { if (guard("Removed")) return; const r = await removeBlackoutAction(b.id); if (!r.ok) toast.error(r.error); else router.refresh(); })}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
            {blackouts.length === 0 && <li className="py-2 text-muted-foreground">No closed days coming up.</li>}
          </ul>
        </div>
        <div>
          <div className="text-label mb-2 text-subtle">Time off</div>
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                if (guard("Time off added")) return;
                const r = await addTimeOffAction(to.resource_id, to.from, to.until, to.reason);
                if (!r.ok) return void toast.error(r.error);
                setTo({ ...to, from: "", until: "", reason: "" });
                router.refresh();
              });
            }}
          >
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Who or what</Label>
              <Select value={to.resource_id} onValueChange={(v) => setTo({ ...to, resource_id: v })}>
                <SelectTrigger aria-label="Resource">
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {resources.filter((r) => r.active).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {KIND_LABEL[r.kind]} · {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="to-from">From</Label>
              <Input id="to-from" type="datetime-local" value={to.from} onChange={(e) => setTo({ ...to, from: e.target.value })} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="to-until">Until</Label>
              <Input id="to-until" type="datetime-local" value={to.until} onChange={(e) => setTo({ ...to, until: e.target.value })} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="to-reason">Reason</Label>
              <Input id="to-reason" value={to.reason} onChange={(e) => setTo({ ...to, reason: e.target.value })} placeholder="Vacation" />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="outline" loading={pending} disabled={!to.resource_id} data-testid="timeoff-add">
                <PlusIcon /> Add
              </Button>
            </div>
          </form>
          <ul className="mt-3 divide-y divide-border text-sm" data-testid="time-off">
            {timeOff.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-medium">{name(t.resource_id)}</span> · {formatDateTime(t.starts_at)} → {formatDate(t.ends_at, "MMM d, h:mm a")}
                  {t.reason ? <span className="text-muted-foreground"> · {t.reason}</span> : null}
                </span>
                <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => start(async () => { if (guard("Removed")) return; const r = await removeTimeOffAction(t.id); if (!r.ok) toast.error(r.error); else router.refresh(); })}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
            {timeOff.length === 0 && <li className="py-2 text-muted-foreground">No time off coming up.</li>}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesCard({ settings }: { settings: RetailSettings }) {
  const router = useRouter();
  const guard = useDemoGuard();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<TemplateKey | null>(null);
  const [t, setT] = useState<Record<string, { subject: string; body: string }>>(() => Object.fromEntries(TEMPLATE_META.map((m) => [m.key, templateFor(m.key, settings.email_templates)])));
  const cur = open ? t[open] : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer emails</CardTitle>
        <CardDescription>What customers get at each step. Use the placeholders shown; everything else is your words.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border text-sm" data-testid="templates">
          {TEMPLATE_META.map((m) => (
            <li key={m.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">{m.label}</span>
                <span className="block truncate text-caption text-subtle">{m.when} · “{t[m.key].subject}”</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setOpen(m.key)}>
                <PencilIcon /> Edit
              </Button>
            </li>
          ))}
        </ul>
        <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
          {open && cur && (
            <DialogContent className="max-h-[92dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{TEMPLATE_META.find((m) => m.key === open)?.label}</DialogTitle>
                <DialogDescription>Placeholders: {TEMPLATE_META.find((m) => m.key === open)?.vars.map((v) => `{{${v}}}`).join(" ")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-1.5">
                <Label htmlFor="t-subject">Subject</Label>
                <Input id="t-subject" value={cur.subject} onChange={(e) => setT({ ...t, [open]: { ...cur, subject: e.target.value } })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="t-body">Message</Label>
                <Textarea id="t-body" value={cur.body} onChange={(e) => setT({ ...t, [open]: { ...cur, body: e.target.value } })} className="min-h-48 font-mono text-sm" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setT({ ...t, [open]: DEFAULT_TEMPLATES[open] })}>
                  Reset to default
                </Button>
                <Button
                  loading={pending}
                  onClick={() =>
                    start(async () => {
                      if (guard("Template saved")) return void setOpen(null);
                      const r = await saveTemplatesAction(t);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Template saved");
                      setOpen(null);
                      router.refresh();
                    })
                  }
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Num({ id, label, value, onChange, min }: { id: string; label: string; value: string; onChange: (v: string) => void; min: number }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={min} step="1" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
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
