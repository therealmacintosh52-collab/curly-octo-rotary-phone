"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { PublicCatalog, Slot, VehicleSize } from "@/lib/db/types";
import { createHoldAction, publicSlotsAction } from "@/app/book/actions";
import { formatMoney } from "@/lib/money";
import { depositFor, quoteTotal, type QuoteModifier, type QuoteService } from "@/lib/retail/quote";
import { SIZE_CLASSES, SIZE_LABEL } from "@/lib/retail/size-class";
import { durationLabel } from "@/lib/retail/slots";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SlotPicker } from "./slot-picker";
import { demoSlots } from "./appointment-sheet";

export interface EstimateToBook {
  token: string;
  display_number: string;
  first_name: string;
  vehicle: string | null;
  size_class: VehicleSize;
  services: string[];
  total: number;
  deposit: number;
  duration_minutes: number;
}

type Step = "car" | "services" | "time";

/**
 * The public booking page: how big is the car → what do you want → when.
 * Prices come from the shop's size grid, the questions from the add-ons
 * the owner marked "ask the customer", the times from the slot engine. The
 * spot is held while they fill in who they are on the next page. From an
 * approved estimate the first two steps are already answered.
 */
export function BookingWizard({ catalog, estimate, demo = false }: { catalog: PublicCatalog; estimate?: EstimateToBook | null; demo?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<Step>(estimate ? "time" : "car");
  const [size, setSize] = useState<VehicleSize | null>(estimate?.size_class ?? null);
  const [services, setServices] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [slot, setSlot] = useState<Slot | null>(null);
  const tz = catalog.company.timezone;
  const settings = catalog.settings;

  const quoteCatalog = useMemo(
    () => ({
      services: catalog.services.map<QuoteService>((s) => ({ id: s.id, name: s.name, benefit_text: s.benefit_text, duration_minutes: s.duration_minutes, taxable: s.taxable, prices: s.prices, default_price: s.default_price })),
      modifiers: catalog.questions.map<QuoteModifier>((q) => ({ code: q.code, label: q.label, kind: q.kind, amount: Number(q.amount), active: true })),
      taxRate: Number(catalog.tax_rate ?? 0),
      taxAllLines: false,
    }),
    [catalog],
  );
  // Condition answers apply to the longest service picked (the one they describe), not to every line.
  const lines = useMemo(() => {
    const picked = catalog.services.filter((s) => services.includes(s.id)).sort((a, b) => b.duration_minutes - a.duration_minutes);
    const mods = Object.entries(answers).filter(([, v]) => v).map(([k]) => k);
    return picked.map((s, i) => ({ service_id: s.id, qty: 1, modifiers: i === 0 ? mods : [] }));
  }, [catalog.services, services, answers]);
  const quote = useMemo(() => {
    if (!size || !lines.length) return null;
    try {
      return quoteTotal({ size, lines }, quoteCatalog);
    } catch {
      return null;
    }
  }, [size, lines, quoteCatalog]);
  const total = estimate ? estimate.total : (quote?.total ?? 0);
  const deposit = estimate ? estimate.deposit : settings && quote ? depositFor(quote.total, settings) : 0;
  const minutes = estimate ? estimate.duration_minutes : (quote?.duration_minutes ?? 0);

  const fetchSlots = useCallback(
    async (from: string, to: string) => {
      if (demo) return { ok: true as const, data: demoSlots(from, tz) };
      return publicSlotsAction(estimate ? [] : lines, from, to, estimate?.token);
    },
    [demo, estimate, lines, tz],
  );

  function hold() {
    if (!slot) return void toast.error("Pick a time");
    start(async () => {
      if (demo) {
        router.push(`/book/demo-booking-token-ana-camry-00001?demo=1`);
        return;
      }
      const r = await createHoldAction(estimate ? { starts_at: slot.starts_at, estimate_token: estimate.token } : { size_class: size ?? "sedan", lines, starts_at: slot.starts_at, intake: answers });
      if (!r.ok) return void toast.error(r.error);
      router.push(`/book/${r.data.token}`);
    });
  }

  const stepIndex = step === "car" ? 1 : step === "services" ? 2 : 3;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-6 sm:px-6" data-testid="booking-wizard">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <div className="font-semibold">{catalog.company.name}</div>
          <div className="text-caption text-subtle">Book online · {[catalog.company.address_line1, catalog.company.city].filter(Boolean).join(", ")}</div>
        </div>
      </header>

      {!settings?.online_booking_enabled && !demo ? (
        <section className="rounded-2xl border border-border bg-card p-4 text-sm">Online booking is off right now. Call us{catalog.company.phone ? ` at ${catalog.company.phone}` : ""} and we will set it up.</section>
      ) : (
        <>
          {!estimate && (
            <ol className="flex items-center gap-2 text-caption text-subtle" aria-label="Steps">
              {(["Your car", "Services", "Time"] as const).map((l, i) => (
                <li key={l} className={cn("flex items-center gap-1.5", stepIndex === i + 1 && "font-semibold text-foreground")}>
                  <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px]", stepIndex > i + 1 ? "border-primary bg-primary text-primary-foreground" : stepIndex === i + 1 ? "border-primary text-primary" : "border-border")}>{stepIndex > i + 1 ? <CheckIcon className="size-3" /> : i + 1}</span>
                  {l}
                  {i < 2 && <span className="mx-1 text-border">—</span>}
                </li>
              ))}
            </ol>
          )}

          {estimate && (
            <section className="rounded-2xl border border-primary/40 bg-accent-soft/30 p-4 text-sm" data-testid="booking-estimate">
              <div className="font-semibold">Hi {estimate.first_name}, pick a time for {estimate.display_number}</div>
              <div className="mt-1 text-muted-foreground">{[estimate.vehicle, estimate.services.join(", ")].filter(Boolean).join(" · ")}</div>
              <div className="mt-1">{formatMoney(estimate.total)} · about {durationLabel(estimate.duration_minutes)}</div>
            </section>
          )}

          {step === "car" && (
            <section className="grid gap-3" data-testid="booking-car">
              <h1 className="text-heading">How big is your car?</h1>
              <p className="text-sm text-muted-foreground">Prices depend on the size. Not sure? Pick the closest; we check it at drop-off.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SIZE_CLASSES.map((s) => (
                  <button key={s.value} type="button" aria-pressed={size === s.value} onClick={() => setSize(s.value)} className={cn("rounded-xl border p-3 text-left transition-colors", size === s.value ? "border-primary bg-accent-soft/40 ring-2 ring-primary/30" : "border-border bg-card hover:border-border-strong")}>
                    <div className="font-semibold">{s.label}</div>
                    <div className="text-caption text-subtle">{s.hint}</div>
                  </button>
                ))}
              </div>
              <Button size="lg" disabled={!size} onClick={() => setStep("services")} data-testid="booking-next-services">Next: services</Button>
            </section>
          )}

          {step === "services" && size && (
            <section className="grid gap-3" data-testid="booking-services">
              <button type="button" onClick={() => setStep("car")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> {SIZE_LABEL[size]}</button>
              <h1 className="text-heading">What would you like done?</h1>
              <ul className="grid gap-2">
                {catalog.services.map((s) => {
                  const on = services.includes(s.id);
                  const price = s.prices[size] ?? s.default_price;
                  return (
                    <li key={s.id}>
                      <button type="button" aria-pressed={on} onClick={() => { setServices((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id])); setSlot(null); }} className={cn("flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors", on ? "border-primary bg-accent-soft/40" : "border-border bg-card hover:border-border-strong")}>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 font-semibold">{on && <CheckIcon className="size-4 text-primary" />}{s.name}</span>
                          {s.benefit_text && <span className="block text-caption text-subtle">{s.benefit_text}</span>}
                          <span className="block text-caption text-subtle">about {durationLabel(s.duration_minutes)}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatMoney(price)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {services.length > 0 && catalog.questions.length > 0 && (
                <div className="grid gap-2 rounded-xl border border-border bg-card p-3" data-testid="booking-questions">
                  <div className="text-sm font-semibold">A couple of questions</div>
                  {catalog.questions.map((q) => (
                    <label key={q.code} className="flex items-center justify-between gap-3 text-sm">
                      <span>{q.question} <span className="text-caption text-subtle">(+{q.kind === "percent" ? `${q.amount}%` : formatMoney(q.amount)})</span></span>
                      <Switch checked={!!answers[q.code]} onCheckedChange={(v) => setAnswers((prev) => ({ ...prev, [q.code]: v }))} aria-label={q.question} />
                    </label>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <span className="text-muted-foreground">{services.length ? `${durationLabel(minutes)} · ${services.length} ${services.length === 1 ? "service" : "services"}` : "Pick at least one"}</span>
                <span className="text-lg font-semibold tabular-nums" data-testid="booking-total">{formatMoney(total)}</span>
              </div>
              <Button size="lg" disabled={!services.length} onClick={() => setStep("time")} data-testid="booking-next-time">Next: pick a time</Button>
            </section>
          )}

          {step === "time" && (
            <section className="grid gap-3" data-testid="booking-time">
              {!estimate && <button type="button" onClick={() => setStep("services")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Services</button>}
              <h1 className="text-heading">When works for you?</h1>
              <p className="text-sm text-muted-foreground">Drop off at the time you pick; the car needs about {durationLabel(minutes)}.</p>
              <SlotPicker tz={tz} fetchSlots={fetchSlots} value={slot} onChange={setSlot} maxDaysAhead={settings?.max_days_ahead ?? 60} />
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <span className="text-muted-foreground">Total{deposit > 0 ? ` · ${formatMoney(deposit)} deposit to book` : ""}</span>
                <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
              </div>
              <Button size="lg" disabled={!slot} onClick={hold} loading={pending} data-testid="booking-hold">Hold this time</Button>
              <p className="text-center text-caption text-subtle">We hold it for {settings?.hold_minutes ?? 30} minutes while you fill in your details.</p>
            </section>
          )}
        </>
      )}
      <footer className="mt-auto pt-4 text-center text-caption text-subtle">{catalog.company.name}{catalog.company.phone ? ` · ${catalog.company.phone}` : ""}</footer>
    </main>
  );
}
