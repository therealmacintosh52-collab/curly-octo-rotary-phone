"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, CheckCircle2Icon, CreditCardIcon, MapPinIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentView, Slot } from "@/lib/db/types";
import { cancelByTokenAction, rescheduleByTokenAction, slotsByTokenAction, startDepositAction } from "@/app/a/[token]/actions";
import { formatMoney } from "@/lib/money";
import { formatAddress } from "@/lib/address";
import { dayLabelIn, durationLabel, timeIn } from "@/lib/retail/slots";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SlotPicker } from "./slot-picker";
import { demoSlots } from "./appointment-sheet";

const PUBLIC_STATUS: Record<AppointmentView["status"], string> = {
  hold: "Holding your spot",
  lead: "Received · the shop will confirm",
  booked: "Booked",
  confirmed: "Confirmed",
  in_progress: "In the shop",
  done: "Done · thank you",
  cancelled: "Cancelled",
  no_show: "Missed",
};

/** The customer's appointment page: when, what, where, and Move / Cancel inside the policy. */
export function ManageAppointment({ a, token, isNew = false, demo = false, depositsOnline = false, justPaid = false, failed = false }: { a: AppointmentView; token: string; isNew?: boolean; demo?: boolean; /** DEPOSITS_ONLINE=clover and the keys present. */ depositsOnline?: boolean; /** Back from Clover with ?paid=1: the webhook may still be on its way. */ justPaid?: boolean; failed?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [paying, startPay] = useTransition();
  const depositDue = (a.deposit_required ?? 0) > 0 && !a.deposit_paid_at && (a.status === "lead" || a.status === "booked" || a.status === "confirmed");
  // Back from Clover: the signed webhook is what confirms the payment; re-read the page for a minute until it lands.
  useEffect(() => {
    if (!justPaid || a.deposit_paid_at || demo) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= 12) clearInterval(t);
    }, 5000);
    return () => clearInterval(t);
  }, [justPaid, a.deposit_paid_at, demo, router]);
  function payDeposit() {
    startPay(async () => {
      if (demo) {
        toast.success("Opening Clover · guest preview", { description: "On the real shop this opens Clover's payment page" });
        return;
      }
      const r = await startDepositAction(token);
      if (!r.ok) return void toast.error(r.error);
      window.location.assign(r.data.url);
    });
  }
  const [mode, setMode] = useState<"view" | "move" | "cancel">("view");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [reason, setReason] = useState("");
  const tz = a.company.timezone;
  const live = a.status === "lead" || a.status === "booked" || a.status === "confirmed";
  const address = formatAddress(a.company).join(", ");
  const fetchSlots = useCallback(async (from: string, to: string) => (demo ? { ok: true as const, data: demoSlots(from, tz) } : slotsByTokenAction(token, from, to)), [demo, token, tz]);

  function move() {
    if (!slot) return;
    start(async () => {
      if (demo) {
        toast.success("Moved · guest preview");
        setMode("view");
        return;
      }
      const r = await rescheduleByTokenAction(token, slot.starts_at);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Moved");
      setMode("view");
      router.refresh();
    });
  }
  function cancel() {
    start(async () => {
      if (demo) {
        toast.success("Cancelled · guest preview");
        setMode("view");
        return;
      }
      const r = await cancelByTokenAction(token, reason);
      if (!r.ok) return void toast.error(r.error);
      setMode("view");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-6 sm:px-6" data-testid="manage-page">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <div className="font-semibold">{a.company.name}</div>
          <div className="text-caption text-subtle">{address}</div>
        </div>
      </header>

      {isNew && (
        <section className="flex items-start gap-2 rounded-2xl border border-success/30 bg-success/8 p-4 text-sm" data-testid="manage-new">
          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <div className="font-semibold">You are on the list{a.customer?.first_name ? `, ${a.customer.first_name}` : ""}.</div>
            <div className="text-muted-foreground">{a.pay_choice === "deposit" ? "The shop will send the deposit link and confirm your time." : "The shop confirms your time shortly. Keep this page: it is your link to move or cancel."}</div>
          </div>
        </section>
      )}

      {(depositDue || a.deposit_paid_at || justPaid || failed) && (
        <section className={cn("rounded-2xl border p-4 text-sm", a.deposit_paid_at ? "border-success/30 bg-success/8" : justPaid ? "border-info/30 bg-info/8" : "border-border bg-card")} data-testid="manage-deposit">
          {a.deposit_paid_at ? (
            <div className="flex items-start gap-2">
              <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <div className="font-semibold">Deposit paid{a.deposit_paid !== null ? ` · ${formatMoney(a.deposit_paid)}` : ""}</div>
                <div className="text-muted-foreground">You are booked. The rest is due at pickup.</div>
              </div>
            </div>
          ) : justPaid ? (
            <div>
              <div className="font-semibold">Payment received · confirming…</div>
              <div className="text-muted-foreground">Clover is telling us about your payment; this page updates on its own. If it has not after a minute, call the shop{a.company.phone ? ` at ${a.company.phone}` : ""}.</div>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="font-semibold">Deposit to book: {formatMoney(a.deposit_required ?? 0)}{a.policy?.deposit_refundable ? "" : " (non-refundable)"}</div>
              {failed && <div className="text-destructive">That payment did not go through. Try again, or pay at drop-off.</div>}
              {depositsOnline ? (
                <>
                  <Button onClick={payDeposit} loading={paying} data-testid="manage-pay-deposit"><CreditCardIcon /> Pay the deposit</Button>
                  <div className="text-caption text-subtle">Card payment on Clover&apos;s secure page. The booking confirms itself once it goes through.</div>
                </>
              ) : (
                <div className="text-muted-foreground">The shop takes the deposit at drop-off and confirms your time.</div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4" data-testid="manage-summary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-caption text-subtle">{a.display_number}</div>
            <h1 className="text-heading">{dayLabelIn(a.starts_at, tz, true)}</h1>
            <div className="text-lg font-semibold tabular-nums">{timeIn(a.starts_at, tz)} <span className="text-sm font-normal text-muted-foreground">· about {durationLabel(a.duration_minutes)}</span></div>
          </div>
          <Badge variant={a.status === "cancelled" || a.status === "no_show" ? "destructive" : a.status === "done" ? "success" : a.status === "lead" ? "warning" : "info"}>{PUBLIC_STATUS[a.status]}</Badge>
        </div>
        {a.vehicle?.name && <div className="mt-2 text-sm">{a.vehicle.name}{a.vehicle.color ? ` · ${a.vehicle.color}` : ""}</div>}
        <ul className="mt-3 divide-y divide-border text-sm">
          {a.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <span>{s.name}{s.qty !== 1 ? ` × ${s.qty}` : ""}{s.modifiers.length ? <span className="text-muted-foreground"> · {s.modifiers.map((m) => m.label).join(", ")}</span> : null}</span>
              <span className="tabular-nums">{formatMoney(s.line_total ?? 0)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="text-muted-foreground">Total{(a.deposit_required ?? 0) > 0 ? ` · deposit ${formatMoney(a.deposit_required ?? 0)}` : ""}</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(a.total ?? 0)}</span>
        </div>
        <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><MapPinIcon className="mt-0.5 size-4 shrink-0" /> {address || a.company.name}{a.company.phone ? ` · ${a.company.phone}` : ""}</div>
      </section>

      {live && (
        <section className="grid gap-3 rounded-2xl border border-border bg-card p-4" data-testid="manage-actions">
          {mode === "view" && (
            <>
              {a.can_change ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setMode("move")} data-testid="manage-move"><CalendarClockIcon /> Move it</Button>
                  <Button variant="ghost" onClick={() => setMode("cancel")} data-testid="manage-cancel"><XIcon /> Cancel</Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="manage-locked">Inside the {a.policy?.cancel_hours ?? 24}-hour notice window: call {a.company.phone ?? "the shop"} to move or cancel.</p>
              )}
              {a.policy?.policy_text && <p className="whitespace-pre-wrap text-caption text-subtle">{a.policy.policy_text}</p>}
            </>
          )}
          {mode === "move" && (
            <>
              <div className="font-semibold">Pick a new time</div>
              <SlotPicker tz={tz} fetchSlots={fetchSlots} value={slot} onChange={setSlot} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setMode("view")}>Keep it</Button>
                <Button onClick={move} disabled={!slot} loading={pending} data-testid="manage-move-confirm">Move it</Button>
              </div>
            </>
          )}
          {mode === "cancel" && (
            <>
              <div className="font-semibold">Cancel this appointment?</div>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us why (optional)" className="min-h-16" maxLength={300} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setMode("view")}>Keep it</Button>
                <Button variant="destructive" onClick={cancel} loading={pending} data-testid="manage-cancel-confirm">Cancel it</Button>
              </div>
            </>
          )}
        </section>
      )}
      {a.status === "cancelled" && (
        <section className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          This appointment is cancelled. <Link href="/book" className={cn("underline underline-offset-2")}>Book again</Link> any time.
        </section>
      )}
      <footer className="mt-auto pt-4 text-center text-caption text-subtle">{a.company.name}{a.company.phone ? ` · ${a.company.phone}` : ""}</footer>
    </main>
  );
}
