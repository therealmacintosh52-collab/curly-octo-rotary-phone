"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CheckIcon, ClockIcon, FileDownIcon, PlayIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import type { EstimateJobPriority, EstimateOptionView, EstimateView, JobFinding } from "@/lib/db/types";
import { markEstimateViewedAction, respondEstimateAction } from "@/app/e/[token]/actions";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { depositFor, optionTotals } from "@/lib/retail/quote";
import { formatClipLength, isVideoMime } from "@/lib/media/kind";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { sectionHeading } from "@/lib/retail/sections";
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
  // A single option: every line can be kept or declined on its own (0044).
  const single = e.options.length === 1 && e.options[0].tier === "single" ? e.options[0] : null;
  const [kept, setKept] = useState<string[]>(single ? single.lines.filter((l) => (answered ? l.customer_approved !== false : true)).map((l) => l.id) : []);
  const [media, setMedia] = useState<{ url: string | null; video: boolean; length: string } | null>(null);
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
    const rate = Number(e.tax_rate ?? e.policy?.tax_rate ?? 0);
    // the option: stored numbers for a tiered estimate, recomputed from the kept lines for a single one
    const opt = single ? optionTotals(single.lines.filter((l) => kept.includes(l.id)).map((l) => ({ line_type: l.line_type, line_total: l.line_total, taxable: l.taxable, duration_minutes: l.duration_minutes, qty: l.qty })), rate, e.policy) : { subtotal: chosen?.subtotal ?? 0, shop_supplies: chosen?.shop_supplies ?? 0, tax: chosen?.tax ?? 0 };
    const subtotal = round2(opt.subtotal + picked.reduce((s, a) => s + (a.line_total ?? 0), 0));
    const supplies = round2(opt.shop_supplies ?? 0);
    const tax = round2(opt.tax + picked.reduce((s, a) => s + (a.taxable ? round2((a.line_total ?? 0) * rate) : 0), 0));
    const total = round2(subtotal + supplies + tax);
    const deposit = e.policy ? depositFor(total, e.policy) : 0;
    return { subtotal, supplies, tax, total, deposit };
  }, [chosen, single, kept, addons, e.addons, e.tax_rate, e.policy]);
  const draft = e.status === "draft";
  const sigRequired = e.policy?.signature_required ?? true;
  const depositOffered = (e.policy?.deposit_kind ?? "none") !== "none" && totals.deposit > 0;

  function approve() {
    if (!chosen) return void toast.error("Pick an option");
    if (single && kept.length === 0) return void toast.error("Keep at least one item, or decline the estimate");
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
      const r = await respondEstimateAction(token, { decision: "accept", option_id: chosen.id, approved_line_ids: [...kept, ...addons], name: name.trim(), signature_path, pay_choice: pay });
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
    <main className="mx-auto grid min-h-dvh w-full max-w-2xl content-start gap-5 px-4 py-6 sm:px-6 xl:max-w-6xl xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-x-8 xl:[&>*]:col-start-1" data-testid="estimate-public">
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
          {(e.ro_number || e.job) && <div className="text-caption text-subtle" data-testid="public-ro">Repair order {e.ro_number ?? e.job?.ro_number ?? e.job?.tag_number}</div>}
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 surface-raised">
        <h1 className="text-heading">Hi {e.customer.first_name || "there"},</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {draft ? `Our tech went over the ${e.vehicle?.name ?? "car"} and wrote up what they found.` : e.job ? `While the ${e.vehicle?.name ?? "car"} is in the shop we found a few things. ` : `Here is your estimate${e.vehicle?.name ? ` for the ${e.vehicle.name}` : ""}.`}{draft ? "" : e.options.length > 1 ? " Pick the option you want, add anything extra, then sign to approve." : single ? " Keep what you want done, untick the rest, then sign to approve." : " Add anything extra, then sign to approve."}
        </p>
        {e.customer_concern && (
          <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border px-3 py-2 text-sm" data-testid="public-concern"><span className="block text-label text-subtle">What you told us</span>{e.customer_concern}</p>
        )}
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

      {(e.findings ?? []).length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 xl:sticky xl:top-6 xl:col-start-2! xl:row-span-6 xl:row-start-2 xl:self-start" data-testid="public-findings">
          <h2 className="font-semibold">What we found</h2>
          <ul className="mt-2 grid gap-3">
            {e.findings!.map((f) => (
              <li key={f.id} className="text-sm">
                <div className="flex items-center gap-2"><span className={cn("inline-block size-2.5 shrink-0 rounded-full", f.severity === "urgent" ? "bg-destructive" : f.severity === "soon" ? "bg-warning" : "bg-success")} /><span className="font-medium">{f.title}</span><span className="text-caption text-subtle">{f.severity === "urgent" ? "needs attention now" : f.severity === "soon" ? "soon" : "for your information"}</span></div>
                {f.body && <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{f.body}</p>}
                {f.recommended_service && <p className="mt-0.5 text-caption font-medium">We recommend: {f.recommended_service}</p>}
                {f.media.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {f.media.map((m) => {
                      const video = isVideoMime(m.mime) || m.kind === "video";
                      return (
                        <button key={m.id} type="button" onClick={() => setMedia({ url: m.url ?? null, video, length: formatClipLength(m.duration_s) })} aria-label={video ? "Play the clip" : "Open the photo"} className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                          {video ? <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground"><PlayIcon className="size-5" /><span className="text-caption">{formatClipLength(m.duration_s) || "Clip"}</span></span> : (
                            // eslint-disable-next-line @next/next/no-img-element
                            m.url && <img src={m.url} alt="" className="size-full object-cover" loading="lazy" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {draft ? (
        <section className="rounded-2xl border border-border bg-card p-4 text-sm" data-testid="public-draft">
          <div className="font-semibold">Your quote is being prepared.</div>
          <div className="text-muted-foreground">This is what our tech found so far. We will send the quote with prices as soon as it is ready{e.company.phone ? `, or call us at ${e.company.phone}` : ""}.</div>
        </section>
      ) : (
        <>
        <section className="grid gap-3" data-testid="public-options">
          {e.options.map((o) => {
            const sel = o.id === optionId;
            const locked = answered || expired;
            const Wrap: "div" | "button" = single ? "div" : "button";
            return (
              <Wrap key={o.id} {...(single ? {} : { type: "button" as const, disabled: locked, "aria-pressed": sel, onClick: () => setOptionId(o.id) })} className={cn("w-full rounded-2xl border p-4 text-left transition-colors", sel ? "border-primary bg-accent-soft/40 ring-2 ring-primary/30" : "border-border bg-card hover:border-border-strong", locked && "cursor-default")}>
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
                    <div className="text-lg font-semibold tabular-nums">{formatMoney(single && o.id === single.id ? totals.total - e.addons.filter((a) => addons.includes(a.id)).reduce((s, a) => s + (a.line_total ?? 0) + (a.taxable ? round2((a.line_total ?? 0) * Number(e.tax_rate ?? e.policy?.tax_rate ?? 0)) : 0), 0) : (o.total ?? 0))}</div>
                    <div className="text-caption text-subtle">about {Math.round((o.duration_minutes / 60) * 10) / 10} h</div>
                  </div>
                </div>
                {single && o.id === single.id && (o.jobs?.length ?? 0) > 0 ? (
                  <PublicJobs o={o} kept={kept} setKept={setKept} locked={locked} findings={e.findings ?? []} />
                ) : (
                <ul className="mt-3 grid gap-1.5 text-sm">
                  {o.lines.map((l, li) => {
                    const type = l.line_type ?? "service";
                    const meta = type === "labor" ? `${l.hours} h${l.rate !== null && l.rate !== undefined ? ` × ${formatMoney(l.rate)}` : ""}` : type === "part" ? [l.qty !== 1 ? `${l.qty} × ${formatMoney(l.unit_price ?? 0)}` : null, l.part_number].filter(Boolean).join(" · ") : type === "service" && l.qty !== 1 ? `× ${l.qty}` : "";
                    const on = single ? kept.includes(l.id) : true;
                    return (
                      <Fragment key={l.id}>
                      {sectionHeading(o.lines, li) && <li className="pt-2 text-label text-subtle" data-testid="public-line-section">{sectionHeading(o.lines, li)}</li>}
                      <li className="flex items-start gap-2">
                        {single ? (
                          <Checkbox checked={on} disabled={locked} onCheckedChange={(v) => setKept((prev) => (v ? [...prev, l.id] : prev.filter((x) => x !== l.id)))} onClick={(ev) => ev.stopPropagation()} aria-label={l.name} className="mt-0.5" />
                        ) : (
                          <CheckIcon className={cn("mt-0.5 size-4 shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                        )}
                        <div className={cn("min-w-0 flex-1", !on && "text-muted-foreground line-through")}>
                          <span className="font-medium">{l.name}</span>
                          {meta && <span className="text-muted-foreground"> · {meta}</span>}
                          {l.benefit_text && <span className="text-muted-foreground"> · {l.benefit_text}</span>}
                          {l.modifiers.length > 0 && <span className="text-muted-foreground"> ({l.modifiers.map((m) => m.label).join(", ")})</span>}
                        </div>
                        {single && <span className={cn("shrink-0 tabular-nums", !on && "text-muted-foreground line-through")}>{formatMoney(l.line_total ?? 0)}</span>}
                      </li>
                      </Fragment>
                    );
                  })}
                </ul>
                )}
              </Wrap>
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
          {totals.supplies > 0 && <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Shop supplies</span><span className="tabular-nums" data-testid="public-supplies">{formatMoney(totals.supplies)}</span></div>}
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
            <p className="text-caption text-subtle">By approving you agree to the work {single ? "you kept ticked" : "in the option you picked"}{addons.length ? " and the add-ons you ticked" : ""} at the total shown. Your name, signature, the time and this device are recorded with the approval.</p>
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

        <Dialog open={!!media} onOpenChange={(o) => !o && setMedia(null)}>
          <DialogContent className="max-w-3xl p-2">
            <DialogTitle className="sr-only">Media</DialogTitle>
            {media?.video ? (
              media.url ? <video src={media.url} controls playsInline className="max-h-[80vh] w-full rounded-lg bg-black" /> : <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">The clip is not available in the preview.</div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              media?.url && <img src={media.url} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />
            )}
          </DialogContent>
        </Dialog>
        </>
      )}

      <footer className="mt-auto pt-4 text-center text-caption text-subtle">
        {e.company.name}{e.company.phone ? ` · ${e.company.phone}` : ""}{e.company.email ? ` · ${e.company.email}` : ""}
      </footer>
    </main>
  );
}


const PRIORITY: Record<EstimateJobPriority, { label: string; cls: string }> = {
  safety: { label: "Safety", cls: "bg-destructive/15 text-destructive" },
  soon: { label: "Due soon", cls: "bg-warning/15 text-warning" },
  optional: { label: "Optional", cls: "bg-muted text-muted-foreground" },
};

/**
 * The estimate as named jobs, safety first, then due soon, then optional:
 * each with what the tech found (photos, the note, what we recommend), its
 * lines, and its own approve / decline. Diagnosis is the first job.
 */
function PublicJobs({ o, kept, setKept, locked, findings }: { o: EstimateOptionView; kept: string[]; setKept: (f: (prev: string[]) => string[]) => void; locked: boolean; findings: JobFinding[] }) {
  const [open, setOpen] = useState<JobFinding["media"][number] | null>(null);
  const jobs = o.jobs ?? [];
  const loose = o.lines.filter((l) => !jobs.some((j) => j.id === l.estimate_job_id));
  return (
    <div className="mt-3 grid gap-3" data-testid="public-jobs">
      {jobs.map((j) => {
        const lines = o.lines.filter((l) => l.estimate_job_id === j.id);
        if (lines.length === 0) return null;
        const ids = lines.map((l) => l.id);
        const on = ids.every((id) => kept.includes(id));
        const total = lines.reduce((s, l) => s + (l.line_total ?? 0), 0);
        const mine = findings.filter((f) => lines.some((l) => l.finding_id === f.id));
        const pr = PRIORITY[j.priority];
        return (
          <section key={j.id} className={cn("rounded-xl border p-3", on ? "border-primary/40 bg-card" : "border-border bg-muted/30")} data-testid="public-job" data-priority={j.priority} data-job={j.title}>
            <div className="flex items-start gap-2">
              <Checkbox checked={on} disabled={locked} onCheckedChange={(v) => setKept((prev) => (v ? [...new Set([...prev, ...ids])] : prev.filter((x) => !ids.includes(x))))} onClick={(ev) => ev.stopPropagation()} aria-label={`Approve ${j.title}`} className="mt-1" data-testid="public-job-check" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("font-semibold", !on && "text-muted-foreground line-through")}>{j.title}</span>
                  {j.kind !== "diagnosis" && <span className={cn("rounded-full px-2 py-0.5 text-caption font-medium", pr.cls)} data-testid="public-job-priority">{pr.label}</span>}
                  {j.status === "declined" && <Badge variant="muted">Declined</Badge>}
                  {j.status === "approved" && <Badge variant="success">Approved</Badge>}
                </div>
              </div>
              <span className={cn("shrink-0 font-semibold tabular-nums", !on && "text-muted-foreground line-through")}>{formatMoney(total)}</span>
            </div>
            {mine.map((f) => (
              <div key={f.id} className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm" data-testid="public-job-finding">
                <div className="font-medium">{f.title}</div>
                {f.body && <p className="text-muted-foreground">{f.body}</p>}
                {f.recommendation && <p className="text-caption font-semibold tracking-wide">{{ replace: "RECOMMEND REPLACE", diagnose: "RECOMMEND DIAG", monitor: "RECOMMEND MONITOR" }[f.recommendation]}</p>}
                {f.media.length > 0 && (
                  <div className="mt-1.5 flex gap-2 overflow-x-auto">
                    {f.media.map((m) => (
                      <button key={m.id} type="button" onClick={() => setOpen(m)} aria-label={isVideoMime(m.mime) || m.kind === "video" ? "Play the clip" : "Open the photo"} className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
                        {isVideoMime(m.mime) || m.kind === "video" ? (
                          <span className="flex size-full flex-col items-center justify-center gap-0.5 text-muted-foreground"><PlayIcon className="size-4" /><span className="text-caption">{formatClipLength(m.duration_s) || "Clip"}</span></span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          m.url && <img src={m.url} alt="" className="size-full object-cover" loading="lazy" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <ul className="mt-2 grid gap-1 text-sm">
              {lines.map((l) => {
                const type = l.line_type ?? "service";
                const meta = type === "labor" ? `${l.hours} h${l.rate !== null && l.rate !== undefined ? ` × ${formatMoney(l.rate)}` : ""}` : type === "part" ? [l.qty !== 1 ? `${l.qty} × ${formatMoney(l.unit_price ?? 0)}` : null, l.part_number].filter(Boolean).join(" · ") : "";
                return (
                  <li key={l.id} className={cn("flex items-baseline justify-between gap-3", !on && "text-muted-foreground line-through")}>
                    <span className="min-w-0"><span className="font-medium">{l.name}</span>{meta && <span className="text-muted-foreground"> · {meta}</span>}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(l.line_total ?? 0)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {loose.length > 0 && (
        <ul className="grid gap-1 text-sm">
          {loose.map((l) => {
            const keep = kept.includes(l.id);
            return (
              <li key={l.id} className="flex items-start gap-2">
                <Checkbox checked={keep} disabled={locked} onCheckedChange={(v) => setKept((prev) => (v ? [...prev, l.id] : prev.filter((x) => x !== l.id)))} onClick={(ev) => ev.stopPropagation()} aria-label={l.name} className="mt-0.5" />
                <span className={cn("min-w-0 flex-1 font-medium", !keep && "text-muted-foreground line-through")}>{l.name}</span>
                <span className="shrink-0 tabular-nums">{formatMoney(l.line_total ?? 0)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogTitle className="sr-only">Photo or clip</DialogTitle>
          {open && (isVideoMime(open.mime) || open.kind === "video" ? (
            open.url ? <video src={open.url} controls playsInline className="max-h-[80vh] w-full rounded-lg bg-black" /> : <p className="text-sm text-muted-foreground">The clip is not available in the preview.</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            open.url && <img src={open.url} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
