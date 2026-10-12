"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CheckIcon, ClockIcon, FileDownIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import type { EstimateView } from "@/lib/db/types";
import { markEstimateViewedAction, respondEstimateAction } from "@/app/e/[token]/actions";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { depositFor } from "@/lib/retail/quote";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SignaturePad, signatureBlob } from "./signature-pad";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What the customer opens from the text or email: the shop, their car, the
 * options side by side with the benefit text, the add-ons they can switch on,
 * a live total, the deposit, the terms, their name and signature, Approve.
 * No login: the token in the link is the key. In the guest demo nothing is
 * sent; the page behaves the same.
 */
export function EstimatePublic({ e, token, demo = false }: { e: EstimateView; token: string; demo?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = e.status === "sent" || e.status === "viewed" || e.status === "draft";
  const expired = e.status === "expired" || (!!e.expires_at && new Date(e.expires_at) < new Date() && open);
  const answered = e.status === "accepted" || e.status === "declined";
  const [optionId, setOptionId] = useState(e.selected_option_id ?? e.options.find((o) => o.recommended)?.id ?? e.options[0]?.id ?? "");
  const [addons, setAddons] = useState<string[]>(e.addons.filter((a) => (answered ? a.customer_approved === true : a.default_on)).map((a) => a.id));
  const [name, setName] = useState(e.authorizations[0]?.name ?? "");
  const [pay, setPay] = useState<"deposit" | "at_shop">("at_shop");
  const [hasInk, setHasInk] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const padRef = useRef<HTMLDivElement>(null);

  // Count the view once per open (never in the demo).
  useEffect(() => {
    if (demo || answered) return;
    const t = setTimeout(() => void markEstimateViewedAction(token), 0);
    return () => clearTimeout(t);
  }, [token, demo, answered]);

  const chosen = e.options.find((o) => o.id === optionId) ?? null;
  const totals = useMemo(() => {
    const picked = e.addons.filter((a) => addons.includes(a.id));
    const subtotal = round2((chosen?.subtotal ?? 0) + picked.reduce((s, a) => s + (a.line_total ?? 0), 0));
    const tax = round2((chosen?.tax ?? 0) + picked.reduce((s, a) => s + (a.taxable ? round2((a.line_total ?? 0) * Number(e.tax_rate ?? 0)) : 0), 0));
    const total = round2(subtotal + tax);
    const deposit = e.policy ? depositFor(total, e.policy) : 0;
    return { subtotal, tax, total, deposit };
  }, [chosen, addons, e.addons, e.tax_rate, e.policy]);
  const sigRequired = e.policy?.signature_required ?? true;
  const depositOffered = (e.policy?.deposit_kind ?? "none") !== "none" && totals.deposit > 0;

  function approve() {
    if (!chosen) return void toast.error("Pick an option");
    if (name.trim().length < 2) return void toast.error("Please type your name");
    if (sigRequired && !hasInk) return void toast.error("Please sign in the box");
    start(async () => {
      if (demo) {
        toast.success("Approved · guest preview");
        router.push(`/e/${token}/done?demo=1&pay=${pay}`);
        return;
      }
      let signature_path: string | null = null;
      if (hasInk) {
        const blob = await signatureBlob(padRef.current);
        if (!blob) return void toast.error("Could not read the signature; try again");
        const fd = new FormData();
        fd.append("signature", blob, "signature.png");
        const res = await fetch(`/api/e/${token}/signature`, { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
        if (!res.ok || !body.path) return void toast.error(body.error ?? "Could not save the signature");
        signature_path = body.path;
      }
      const r = await respondEstimateAction(token, { decision: "accept", option_id: chosen.id, approved_line_ids: addons, name: name.trim(), signature_path, pay_choice: pay });
      if (!r.ok) return void toast.error(r.error);
      router.push(`/e/${token}/done?pay=${pay}`);
    });
  }
  function decline() {
    start(async () => {
      if (demo) {
        router.push(`/e/${token}/done?demo=1&declined=1`);
        return;
      }
      const r = await respondEstimateAction(token, { decision: "decline", reason });
      if (!r.ok) return void toast.error(r.error);
      router.push(`/e/${token}/done?declined=1`);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6" data-testid="estimate-public">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="font-semibold">{e.company.name}</div>
            <div className="text-caption text-subtle">{[e.company.phone, [e.company.city, e.company.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-caption text-subtle">Estimate</div>
          <div className="font-semibold tracking-wide">{e.display_number}</div>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 surface-raised">
        <h1 className="text-heading">Hi {e.customer.first_name || "there"},</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here is your estimate{e.vehicle?.name ? ` for the ${e.vehicle.name}` : ""}.{e.options.length > 1 ? " Pick the option you want, add anything extra, then sign to approve." : " Add anything extra, then sign to approve."}
        </p>
        {e.customer_notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm">{e.customer_notes}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-caption text-subtle">
          {e.expires_at && <span className="inline-flex items-center gap-1"><ClockIcon className="size-3.5" /> Good until {formatDate(e.expires_at)}</span>}
          <a href={`/api/e/${token}/pdf`} className="inline-flex items-center gap-1 underline-offset-2 hover:underline" data-testid="public-pdf"><FileDownIcon className="size-3.5" /> PDF copy</a>
        </div>
      </section>

      {answered && (
        <section className={cn("rounded-2xl border p-4 text-sm", e.status === "accepted" ? "border-success/30 bg-success/8" : "border-border bg-muted/40")} data-testid="public-answered">
          {e.status === "accepted" ? (
            <div className="flex items-start gap-2">
              <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <div className="font-semibold">Approved {formatDateTime(e.accepted_at)}</div>
                <div className="text-muted-foreground">Signed by {e.authorizations[0]?.name}. The shop will reach out to set the time{e.authorizations[0]?.pay_choice === "deposit" ? " and take the deposit" : ""}.</div>
              </div>
            </div>
          ) : (
            <div className="font-semibold">You declined this estimate on {formatDate(e.declined_at)}. Changed your mind? Call the shop{e.company.phone ? ` at ${e.company.phone}` : ""}.</div>
          )}
        </section>
      )}
      {expired && !answered && (
        <section className="rounded-2xl border border-warning/30 bg-warning/8 p-4 text-sm" data-testid="public-expired">
          <div className="font-semibold">This estimate has expired.</div>
          <div className="text-muted-foreground">Prices may have changed; ask the shop for a fresh one{e.company.phone ? ` at ${e.company.phone}` : ""}.</div>
        </section>
      )}

      <section className="grid gap-3" data-testid="public-options">
        {e.options.map((o) => {
          const sel = o.id === optionId;
          const locked = answered || expired;
          return (
            <button key={o.id} type="button" disabled={locked} aria-pressed={sel} onClick={() => setOptionId(o.id)} className={cn("w-full rounded-2xl border p-4 text-left transition-colors", sel ? "border-primary bg-accent-soft/40 ring-2 ring-primary/30" : "border-border bg-card hover:border-border-strong", locked && "cursor-default")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{o.name}</span>
                    {o.recommended && e.options.length > 1 && !answered && <Badge variant="outline"><StarIcon /> Recommended</Badge>}
                    {answered && e.selected_option_id === o.id && <Badge variant="success"><CheckIcon /> Chosen</Badge>}
                  </div>
                  {o.description && <p className="mt-0.5 text-sm text-muted-foreground">{o.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular-nums">{formatMoney(o.total ?? 0)}</div>
                  <div className="text-caption text-subtle">about {Math.round((o.duration_minutes / 60) * 10) / 10} h</div>
                </div>
              </div>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {o.lines.map((l) => (
                  <li key={l.id} className="flex items-start gap-2">
                    <CheckIcon className={cn("mt-0.5 size-4 shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0">
                      <span className="font-medium">{l.name}{l.qty !== 1 ? ` × ${l.qty}` : ""}</span>
                      {l.benefit_text && <span className="text-muted-foreground"> · {l.benefit_text}</span>}
                      {l.modifiers.length > 0 && <span className="text-muted-foreground"> ({l.modifiers.map((m) => m.label).join(", ")})</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </section>

      {e.addons.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4" data-testid="public-addons">
          <h2 className="font-semibold">Add to it</h2>
          <ul className="mt-2 grid gap-2">
            {e.addons.map((a) => {
              const on = addons.includes(a.id);
              return (
                <li key={a.id}>
                  <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm", on ? "border-primary/50 bg-accent-soft/30" : "border-border", (answered || expired) && "cursor-default")}>
                    <Checkbox checked={on} disabled={answered || expired} onCheckedChange={(v) => setAddons((prev) => (v ? [...prev, a.id] : prev.filter((x) => x !== a.id)))} aria-label={a.name} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{a.name}</span>
                      {a.benefit_text && <span className="block text-caption text-subtle">{a.benefit_text}</span>}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">+{formatMoney(a.line_total ?? 0)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 text-sm" data-testid="public-totals">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatMoney(totals.subtotal)}</span></div>
        <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Tax ({formatTaxRate(Number(e.tax_rate ?? 0))})</span><span className="tabular-nums">{formatMoney(totals.tax)}</span></div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-lg font-semibold"><span>Total</span><span className="tabular-nums" data-testid="public-total">{formatMoney(totals.total)}</span></div>
        {depositOffered && <div className="mt-1 flex justify-between text-caption text-subtle"><span>Deposit to book{e.policy?.deposit_refundable ? "" : " (non-refundable)"}</span><span className="tabular-nums">{formatMoney(totals.deposit)}</span></div>}
      </section>

      {!answered && !expired && (
        <section className="grid gap-4 rounded-2xl border border-border bg-card p-4" data-testid="public-approve">
          <h2 className="font-semibold">Approve this estimate</h2>
          {depositOffered && (
            <div className="grid gap-2">
              <Label>How would you like to pay?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { v: "at_shop", title: "Pay at the shop", hint: "Card, cash or check when you drop off." },
                  { v: "deposit", title: `Pay the ${formatMoney(totals.deposit)} deposit now`, hint: "Online deposit is coming soon; the shop will take it at drop-off for now." },
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
            <Label htmlFor="pub-name">Your name</Label>
            <Input id="pub-name" value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="name" maxLength={120} placeholder="First and last name" />
          </div>
          <div className="grid gap-1.5" ref={padRef}>
            <Label>Signature{sigRequired ? "" : " (optional)"}</Label>
            <SignaturePad onChange={setHasInk} />
          </div>
          {e.policy?.policy_text && <p className="whitespace-pre-wrap text-caption text-subtle">{e.policy.policy_text}</p>}
          <p className="text-caption text-subtle">By approving you agree to the work in the option you picked{addons.length ? " and the add-ons you ticked" : ""} at the total shown. Your name, signature, the time and this device are recorded with the approval.</p>
          <Button size="lg" onClick={approve} loading={pending} disabled={!chosen} data-testid="public-approve-button">
            <CheckIcon /> Approve {formatMoney(totals.total)}
          </Button>
          {!declining ? (
            <button type="button" onClick={() => setDeclining(true)} className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline" data-testid="public-decline">
              No thanks
            </button>
          ) : (
            <div className="grid gap-2 rounded-xl border border-border p-3">
              <Label htmlFor="pub-reason">Anything we should know? (optional)</Label>
              <Textarea id="pub-reason" value={reason} onChange={(ev) => setReason(ev.target.value)} className="min-h-16" maxLength={300} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDeclining(false)}>Back</Button>
                <Button variant="outline" size="sm" onClick={decline} loading={pending} data-testid="public-decline-confirm">Decline the estimate</Button>
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="mt-auto pt-4 text-center text-caption text-subtle">
        {e.company.name}{e.company.phone ? ` · ${e.company.phone}` : ""}{e.company.email ? ` · ${e.company.email}` : ""}
      </footer>
    </main>
  );
}
