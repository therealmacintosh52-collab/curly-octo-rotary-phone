"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClockIcon } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentView } from "@/lib/db/types";
import { confirmHoldAction } from "@/app/book/actions";
import { formatMoney } from "@/lib/money";
import { dayLabelIn, durationLabel, holdSecondsLeft, mmss, timeIn } from "@/lib/retail/slots";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * The held spot: a countdown, who you are, the car, how you'd like to pay,
 * then Finish booking. Consents are two separate switches, off by default.
 */
export function HoldConfirm({ a, token, demo = false }: { a: AppointmentView; token: string; demo?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [left, setLeft] = useState(() => holdSecondsLeft(a.hold_expires_at));
  const [f, setF] = useState({ first_name: "", last_name: "", phone: "", email: "", sms_opt_in: false, marketing_opt_in: false, year: "", make: "", model: "", color: "", notes: "" });
  const [pay, setPay] = useState<"deposit" | "at_shop">("at_shop");
  const tz = a.company.timezone;
  const known = !!a.customer;
  const deposit = a.deposit_required ?? 0;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (a.status !== "hold") return;
    const t = setInterval(() => setLeft(holdSecondsLeft(a.hold_expires_at)), 1000);
    return () => clearInterval(t);
  }, [a.hold_expires_at, a.status]);

  if (a.status !== "hold") {
    return (
      <Shell a={a}>
        <section className="rounded-2xl border border-border bg-card p-4 text-sm" data-testid="hold-not-hold">
          {a.status === "cancelled" ? (
            <>
              <div className="font-semibold">That hold ran out.</div>
              <p className="mt-1 text-muted-foreground">No problem: pick a time again.</p>
              <Button asChild className="mt-3"><Link href="/book">Pick a time</Link></Button>
            </>
          ) : (
            <>
              <div className="font-semibold">This booking is already in.</div>
              <Button asChild className="mt-3"><Link href={`/a/${token}`}>See your appointment</Link></Button>
            </>
          )}
        </section>
      </Shell>
    );
  }

  function submit() {
    if (!known && (f.first_name.trim().length < 1 || f.phone.replace(/\D/g, "").length < 7)) return void toast.error("Your first name and a phone number, please");
    start(async () => {
      if (demo) {
        router.push(`/a/${token}?new=1&demo=1`);
        return;
      }
      const r = await confirmHoldAction(token, {
        contact: known ? undefined : { first_name: f.first_name, last_name: f.last_name, phone: f.phone, email: f.email || null, sms_opt_in: f.sms_opt_in, marketing_opt_in: f.marketing_opt_in },
        vehicle: known ? undefined : { year: f.year ? Number(f.year) : null, make: f.make || null, model: f.model || null, color: f.color || null },
        pay_choice: pay,
        customer_notes: f.notes || undefined,
      });
      if (!r.ok) return void toast.error(r.error);
      router.push(`/a/${token}?new=1`);
    });
  }

  return (
    <Shell a={a}>
      <section className={cn("flex items-center justify-between rounded-2xl border p-4", left > 0 ? "border-primary/40 bg-accent-soft/30" : "border-destructive/40 bg-destructive/8")} data-testid="hold-timer">
        <div>
          <div className="text-caption text-subtle">Holding your spot</div>
          <div className="font-semibold">{dayLabelIn(a.starts_at, tz, true)} · {timeIn(a.starts_at, tz)}</div>
          <div className="text-caption text-subtle">{a.services.map((s) => s.name).join(", ")} · about {durationLabel(a.duration_minutes)}</div>
        </div>
        <div className="flex items-center gap-1.5 text-lg font-semibold tabular-nums" aria-live="polite"><ClockIcon className="size-4" /> {left > 0 ? mmss(left) : "0:00"}</div>
      </section>
      {left === 0 && <p className="text-sm text-destructive">The hold ran out. <Link href="/book" className="underline">Pick a time again.</Link></p>}

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-4" data-testid="hold-form">
        {!known ? (
          <>
            <h1 className="text-heading">Who is the car for?</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="h-first">First name</Label><Input id="h-first" value={f.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" maxLength={60} /></div>
              <div className="grid gap-1.5"><Label htmlFor="h-last">Last name</Label><Input id="h-last" value={f.last_name} onChange={(e) => set("last_name", e.target.value)} autoComplete="family-name" maxLength={60} /></div>
              <div className="grid gap-1.5"><Label htmlFor="h-phone">Phone</Label><Input id="h-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" maxLength={30} /></div>
              <div className="grid gap-1.5"><Label htmlFor="h-email">Email (for the confirmation)</Label><Input id="h-email" type="email" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" maxLength={120} /></div>
            </div>
            <div className="grid gap-2">
              <label className="flex items-center justify-between gap-3 text-sm"><span>Text me about this appointment</span><Switch checked={f.sms_opt_in} onCheckedChange={(v) => set("sms_opt_in", v)} aria-label="Text me about this appointment" /></label>
              <label className="flex items-center justify-between gap-3 text-sm"><span>Occasional offers and reminders</span><Switch checked={f.marketing_opt_in} onCheckedChange={(v) => set("marketing_opt_in", v)} aria-label="Occasional offers and reminders" /></label>
            </div>
            <div>
              <div className="text-sm font-semibold">The car</div>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="grid gap-1.5"><Label htmlFor="h-year">Year</Label><Input id="h-year" inputMode="numeric" value={f.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, "").slice(0, 4))} /></div>
                <div className="grid gap-1.5"><Label htmlFor="h-make">Make</Label><Input id="h-make" value={f.make} onChange={(e) => set("make", e.target.value)} maxLength={60} /></div>
                <div className="grid gap-1.5"><Label htmlFor="h-model">Model</Label><Input id="h-model" value={f.model} onChange={(e) => set("model", e.target.value)} maxLength={60} /></div>
                <div className="grid gap-1.5"><Label htmlFor="h-color">Color</Label><Input id="h-color" value={f.color} onChange={(e) => set("color", e.target.value)} maxLength={40} /></div>
              </div>
            </div>
          </>
        ) : (
          <h1 className="text-heading">Almost done, {a.customer?.first_name}</h1>
        )}

        {deposit > 0 && (
          <div className="grid gap-2">
            <Label>How would you like to pay?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { v: "at_shop", title: "Pay at the shop", hint: "Card, cash or check at drop-off. The shop confirms the booking." },
                { v: "deposit", title: `Pay the ${formatMoney(deposit)} deposit now`, hint: "Online deposit is coming soon; the shop will take it at drop-off for now." },
              ] as const).map((c) => (
                <button key={c.v} type="button" aria-pressed={pay === c.v} onClick={() => setPay(c.v)} className={cn("rounded-xl border px-3 py-2.5 text-left text-sm", pay === c.v ? "border-primary bg-accent-soft/40" : "border-border hover:border-border-strong")}>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-caption text-subtle">{c.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="h-notes">Anything we should know? (optional)</Label>
          <Textarea id="h-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-16" maxLength={1000} placeholder="Gate code, where the keys will be, what to look at…" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total{deposit > 0 ? ` · deposit ${formatMoney(deposit)}${a.policy?.deposit_refundable ? "" : " (non-refundable)"}` : ""}</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(a.total ?? 0)}</span>
        </div>
        {a.policy?.policy_text && <p className="whitespace-pre-wrap text-caption text-subtle">{a.policy.policy_text}</p>}
        <Button size="lg" onClick={submit} loading={pending} disabled={left === 0} data-testid="hold-finish">Finish booking</Button>
      </section>
    </Shell>
  );
}

function Shell({ a, children }: { a: AppointmentView; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-6 sm:px-6" data-testid="hold-page">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <div className="font-semibold">{a.company.name}</div>
          <div className="text-caption text-subtle">{[a.company.address_line1, a.company.city].filter(Boolean).join(", ")}</div>
        </div>
      </header>
      {children}
      <footer className="mt-auto pt-4 text-center text-caption text-subtle">{a.company.name}{a.company.phone ? ` · ${a.company.phone}` : ""}</footer>
    </main>
  );
}
