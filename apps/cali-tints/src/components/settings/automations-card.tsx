"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AutomationLogRow, AutomationRule } from "@/lib/db/types";
import { saveAutomationRuleAction } from "@/app/(app)/settings/retail-actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { TEMPLATE_META } from "@/lib/retail/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const EVENT_LABEL: Record<string, string> = {
  "hold.created": "a customer starts booking",
  "hold.expiring": "a hold is 10 minutes from running out",
  "hold.expired": "a hold ran out",
  "booking.lead": "a booking comes in online",
  "booking.booked": "a booking is confirmed",
  "booking.reminder": "the reminder time before a visit",
  "booking.rescheduled": "a booking is moved",
  "booking.cancelled": "a booking is cancelled",
  "booking.checked_in": "a car is checked in",
  "booking.done": "a visit is finished",
  "booking.no_show": "a no-show",
  "estimate.sent": "an estimate is sent",
  "estimate.viewed": "an estimate is opened",
  "estimate.accepted": "an estimate is approved",
  "estimate.declined": "an estimate is declined",
  "estimate.unanswered": "an estimate sits unanswered",
  "payment.paid": "a payment lands",
  "job.paid": "a job is paid",
};
const ACTION_LABEL: Record<string, string> = { email: "email", text: "text (queued for your phone)", both: "email + text", notify_owner: "email you", none: "nothing" };
const STATUS_VARIANT: Record<AutomationLogRow["status"], "muted" | "info" | "success" | "warning" | "destructive"> = { queued: "muted", claimed: "info", sent: "success", skipped: "warning", failed: "destructive" };

/**
 * Settings → Booking → Automations: the rules (when → wait → do), each one
 * on or off with its delay and template, and the log of what went out,
 * what was skipped and why. Texts are queued for the owner's phone: no SMS
 * provider is paid for.
 */
export function AutomationsCard({ rules, log }: { rules: AutomationRule[]; log: AutomationLogRow[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [showLog, setShowLog] = useState(false);

  function toggle(rule: AutomationRule, on: boolean) {
    start(async () => {
      if (demo) return void toast.success(on ? "Rule on" : "Rule off", { description: "Guest preview — nothing changed" });
      const r = await saveAutomationRuleAction({ id: rule.id, enabled: on });
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  }
  const delay = (m: number) => (m === 0 ? "right away" : m < 60 ? `after ${m} min` : m % 1440 === 0 ? `after ${m / 1440} ${m / 1440 === 1 ? "day" : "days"}` : m % 60 === 0 ? `after ${m / 60} h` : `after ${m} min`);

  return (
    <Card data-testid="automations">
      <CardHeader>
        <CardTitle>Automations</CardTitle>
        <CardDescription>What happens on its own, every five minutes: confirmations, reminders, the review request, nudges. Emails go out by themselves; texts land in “Texts to send” on Today for one tap from your phone. Quiet hours hold everything until morning.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="divide-y divide-border text-sm" data-testid="automation-rules">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${r.name}`}>
                <span className="block font-medium">{r.name}</span>
                <span className="block truncate text-caption text-subtle">
                  When {EVENT_LABEL[r.event_kind] ?? r.event_kind} · {delay(r.delay_minutes)} · {ACTION_LABEL[r.action.kind] ?? r.action.kind}
                  {r.action.template ? ` “${TEMPLATE_META.find((m) => m.key === r.action.template)?.label ?? r.action.template}”` : ""}
                </span>
              </button>
              <Switch checked={r.enabled} onCheckedChange={(v) => toggle(r, v)} aria-label={`${r.name} on`} disabled={pending} />
            </li>
          ))}
        </ul>
        <div>
          <Button variant="outline" size="sm" onClick={() => setShowLog((v) => !v)} data-testid="automation-log-toggle">
            {showLog ? "Hide the log" : `What went out (${log.length})`}
          </Button>
          {showLog && (
            <ul className="mt-3 divide-y divide-border text-sm" data-testid="automation-log">
              {log.length === 0 && <li className="py-3 text-muted-foreground">Nothing yet. The first runs show up here.</li>}
              {log.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.rule}{l.customer ? ` · ${l.customer}` : ""}</div>
                    <div className="truncate text-caption text-subtle">{l.result ?? (l.status === "queued" ? `due ${formatDateTime(l.due_at)}` : "")}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={STATUS_VARIANT[l.status]}>{l.status}</Badge>
                    <div className="text-caption text-subtle">{formatDateTime(l.finished_at ?? l.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      {editing && <RuleDialog rule={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RuleDialog({ rule, onClose }: { rule: AutomationRule; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [name, setName] = useState(rule.name);
  const [delayMin, setDelayMin] = useState(String(rule.delay_minutes));
  const [template, setTemplate] = useState(rule.action.template ?? "");
  const [kind, setKind] = useState(rule.action.kind);
  const usesTemplate = kind !== "notify_owner" && kind !== "none";
  function save() {
    start(async () => {
      if (demo) {
        toast.success("Rule saved", { description: "Guest preview — nothing changed" });
        onClose();
        return;
      }
      const r = await saveAutomationRuleAction({ id: rule.id, name, delay_minutes: Number(delayMin) || 0, action: { ...rule.action, kind, template: usesTemplate ? template : undefined } });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Rule saved");
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule.name}</DialogTitle>
          <DialogDescription>When {EVENT_LABEL[rule.event_kind] ?? rule.event_kind}.{rule.system ? " A built-in rule: change when and what, or switch it off." : ""}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="ar-name">Name</Label><Input id="ar-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
          <div className="grid gap-1.5"><Label htmlFor="ar-delay">Wait (minutes)</Label><Input id="ar-delay" type="number" inputMode="numeric" min={0} max={43200} value={delayMin} onChange={(e) => setDelayMin(e.target.value)} /></div>
          <div className="grid gap-1.5">
            <Label htmlFor="ar-kind">Do</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger id="ar-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email the customer</SelectItem>
                <SelectItem value="text">Queue a text for my phone</SelectItem>
                <SelectItem value="both">Email + queue a text</SelectItem>
                <SelectItem value="notify_owner">Email me</SelectItem>
                <SelectItem value="none">Nothing (log only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {usesTemplate && (
            <div className="grid gap-1.5">
              <Label htmlFor="ar-template">Message</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger id="ar-template"><SelectValue placeholder="Pick a template" /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_META.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={pending} disabled={usesTemplate && !template} data-testid="automation-rule-save">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
