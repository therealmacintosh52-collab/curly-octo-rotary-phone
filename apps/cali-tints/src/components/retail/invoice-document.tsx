import type { ReactNode } from "react";
import type { InvoiceJob, ReceiptView } from "@/lib/db/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatAddress } from "@/lib/address";
import { paymentMethodLower } from "@/lib/retail/payment-labels";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = { labor: "Labor", part: "Part", fee: "Fee", shop_supplies: "Fee", sublet: "Sublet", service: "Service" };
const METHOD = { get: paymentMethodLower };
const AUTH_KIND: Record<string, string> = { initial: "Diagnosis approved", estimate: "Work approved", change_order: "Change order approved" };
const AUTH_HOW: Record<string, string> = { online: "link", in_person: "in person", phone: "phone or text", email: "email" };
const PRIORITY: Record<string, string> = { safety: "safety", soon: "due soon", optional: "optional" };
const REC: Record<string, string> = { replace: "recommend replace", diagnose: "recommend diagnosis", monitor: "keep an eye on it" };

/** "Tax (parts only, 8.75%)": which kinds of line were taxed, from the lines themselves. */
export function taxLabel(r: Pick<ReceiptView, "taxable_types" | "tax_rate">): string {
  const rate = formatTaxRate(Number(r.tax_rate ?? 0));
  const t = r.taxable_types ?? [];
  if (t.length === 0) return `Tax (${rate})`;
  if (t.length === 1 && t[0] === "part") return `Tax (parts only, ${rate})`;
  return `Tax (${rate})`;
}

function lineDetail(l: InvoiceJob["lines"][number]): string {
  if (l.type === "labor" && l.hours) return `${l.hours} h`;
  if (l.type === "part" && l.qty && l.qty !== 1) return `× ${l.qty}`;
  return "";
}

/**
 * The invoice as the shop prints it: header with the licence number, RO and
 * the people (initials only), customer and car with mileage in and out, the
 * concern in the customer's words, each JOB with its cause and correction and
 * its lines, what was declined or only recommended, the totals by kind, the
 * payment, the authorization log, the warranty and the replaced-parts choice.
 * Used by the staff invoice page and the customer's link.
 */
export function InvoiceDocument({ r, children }: { r: ReceiptView; children?: ReactNode }) {
  const jobs = r.jobs ?? [];
  const cats = r.categories;
  const closed = !!r.paid_at;
  const wip = !closed && r.invoiced_at === null;
  const vehicle = r.vehicle ?? "";
  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid="invoice-document">
      <header className="border-b border-border pb-3 text-center">
        <div className="text-lg font-semibold">{r.company.name}</div>
        <div className="text-caption text-subtle">{formatAddress(r.company).join(", ")}</div>
        <div className="text-caption text-subtle">{[r.company.phone, r.bar_license ? `BAR Lic# ${r.bar_license}` : null].filter(Boolean).join(" · ")}</div>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-label text-subtle">{wip ? "REPAIR ORDER" : "INVOICE"}</div>
        <div className="text-right font-semibold" data-testid="doc-ro">RO # {r.ro_number ?? r.tag}</div>
        <div>Date: {formatDate(r.performed_at)}</div>
        <div className="text-right">{r.advisor ? `Advisor: ${r.advisor}` : ""}</div>
        <div data-testid="doc-status" className={cn("font-semibold", closed ? "text-success" : "text-warning")}>Status: {closed ? "PAID" : wip ? "IN PROGRESS" : "UNPAID"}</div>
        <div className="text-right">{r.tech ? `Tech: ${r.tech}` : ""}</div>
      </div>

      <div className="mt-3 grid gap-3 border-t border-border pt-3 text-sm sm:grid-cols-2">
        <div>
          <div className="text-label text-subtle">CUSTOMER</div>
          <div className="font-medium">{r.customer?.display_name ?? r.customer?.first_name ?? "—"}</div>
          {r.customer?.phone && <div className="text-muted-foreground">{r.customer.phone}</div>}
          {r.customer?.email && <div className="text-muted-foreground">{r.customer.email}</div>}
        </div>
        <div>
          <div className="text-label text-subtle">VEHICLE</div>
          <div className="font-medium">{[vehicle, r.color].filter(Boolean).join(" · ") || "—"}</div>
          {r.vin && <div className="font-mono text-caption text-muted-foreground">VIN: {r.vin}</div>}
          {r.plate && <div className="text-muted-foreground">Plate: {r.plate}</div>}
          {r.odometer != null && <div className="text-muted-foreground" data-testid="doc-mileage-in">Mileage In: {r.odometer.toLocaleString()}</div>}
          {r.odometer_out != null && <div className="text-muted-foreground" data-testid="doc-mileage-out">Mileage Out: {r.odometer_out.toLocaleString()}</div>}
        </div>
      </div>

      {r.concern && (
        <div className="mt-3 border-t border-border pt-3 text-sm" data-testid="doc-concern">
          <div className="text-label text-subtle">CUSTOMER CONCERN</div>
          <p className="mt-0.5 whitespace-pre-wrap italic">&ldquo;{r.concern}&rdquo;</p>
        </div>
      )}

      <div className="mt-3 grid gap-3 border-t border-border pt-3" data-testid="doc-jobs">
        {jobs.map((j, i) => {
          const n = jobs.slice(0, i + 1).filter((x) => x.kind !== "diagnosis").length;
          return (
            <section key={j.id} className="text-sm" data-testid="doc-job" data-title={j.title}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold uppercase tracking-wide">{j.kind === "diagnosis" ? j.title : `Job ${n}: ${j.title}`}</h3>
                <span className="text-caption font-medium text-muted-foreground">[{j.status === "declined" ? "DECLINED" : "APPROVED"}]</span>
              </div>
              {(j.cause || j.correction) && (
                <div className="mt-1 text-muted-foreground" data-testid="doc-cause">
                  {j.cause && <div><span className="font-medium text-foreground">Cause:</span> {j.cause}</div>}
                  {j.correction && <div><span className="font-medium text-foreground">Correction:</span> {j.correction}</div>}
                </div>
              )}
              <ul className="mt-1.5 grid gap-0.5">
                {j.lines.map((l, k) => (
                  <li key={k} className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-2">
                    <span className="text-caption text-subtle">{TYPE_LABEL[l.type] ?? "Item"}</span>
                    <span className="min-w-0">{l.name}{lineDetail(l) && <span className="text-muted-foreground"> · {lineDetail(l)}</span>}</span>
                    <span className="tabular-nums">{formatMoney(l.total)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-right font-medium tabular-nums" data-testid="doc-job-total">Job Total: {formatMoney(j.total)}</div>
            </section>
          );
        })}
        {(r.extras ?? []).length > 0 && (
          <section className="text-sm" data-testid="doc-extras">
            <h3 className="font-semibold uppercase tracking-wide">{jobs.length ? "Other charges" : "Services"}</h3>
            <ul className="mt-1 grid gap-0.5">
              {(r.extras ?? []).map((l, k) => (
                <li key={k} className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-2">
                  <span className="text-caption text-subtle">{TYPE_LABEL[l.type] ?? "Item"}</span>
                  <span className="min-w-0">{l.name}</span>
                  <span className="tabular-nums">{formatMoney(l.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {((r.declined ?? []).length > 0 || (r.recommended ?? []).length > 0) && (
        <section className="mt-3 border-t border-border pt-3 text-sm" data-testid="doc-declined">
          <h3 className="font-semibold uppercase tracking-wide">Declined / recommended</h3>
          <ul className="mt-1 grid gap-0.5">
            {(r.declined ?? []).map((d, k) => (
              <li key={`d${k}`} className="flex items-baseline justify-between gap-3">
                <span>{d.title} <span className="text-muted-foreground">· {PRIORITY[d.priority]}</span></span>
                {d.total != null && <span className="tabular-nums">{formatMoney(d.total)}</span>}
              </li>
            ))}
            {(r.recommended ?? []).map((d, k) => (
              <li key={`r${k}`} className="flex items-baseline justify-between gap-3">
                <span>{d.title}{d.recommendation && <span className="text-muted-foreground"> · {REC[d.recommendation]}</span>}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-3 grid gap-0.5 border-t border-border pt-3 text-sm" data-testid="doc-totals">
        {cats && cats.labor > 0 && <Row label="Labor" value={cats.labor} />}
        {cats && cats.parts > 0 && <Row label="Parts" value={cats.parts} />}
        {cats && cats.fees > 0 && <Row label="Fees" value={cats.fees} />}
        {cats && cats.sublets > 0 && <Row label="Sublets" value={cats.sublets} />}
        {cats && cats.services > 0 && <Row label="Services" value={cats.services} />}
        <Row label="Subtotal" value={r.subtotal} strong />
        <Row label={taxLabel(r)} value={r.tax} />
        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-1 text-base font-semibold"><span>TOTAL</span><span className="tabular-nums" data-testid="doc-total">{formatMoney(r.total)}</span></div>
        {r.payments.map((p, k) => (
          <div key={k} className="flex justify-between text-muted-foreground">
            <span>{p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Paid"} · {METHOD.get(p.method)}{p.note ? ` (${p.note})` : ""}{p.paid_at ? ` · ${formatDate(p.paid_at)}` : ""}</span>
            <span className="tabular-nums">{p.kind === "refund" ? "+" : "−"}{formatMoney(p.amount)}</span>
          </div>
        ))}
        {!wip && <div className="flex justify-between font-semibold"><span>BALANCE DUE</span><span className="tabular-nums" data-testid="doc-balance">{formatMoney(r.balance)}</span></div>}
      </section>

      {(r.authorizations ?? []).length > 0 && (
        <section className="mt-3 border-t border-border pt-3 text-sm" data-testid="doc-authorizations">
          <h3 className="font-semibold uppercase tracking-wide">Authorization log</h3>
          <ul className="mt-1 grid gap-0.5 text-muted-foreground">
            {(r.authorizations ?? []).map((a, k) => (
              <li key={k}>{AUTH_KIND[a.kind]}: {AUTH_HOW[a.method]} {formatDateTime(a.authorized_at)}{a.amount != null && a.amount > 0 ? ` · ${formatMoney(a.amount)}` : ""} · {a.name}</li>
            ))}
          </ul>
        </section>
      )}

      {(r.warranty_text || r.parts_disposition) && (
        <section className="mt-3 grid gap-0.5 border-t border-border pt-3 text-sm" data-testid="doc-warranty">
          {r.warranty_text && <div><span className="font-semibold">WARRANTY:</span> {r.warranty_text}</div>}
          {r.parts_disposition && (
            <div className="text-muted-foreground" data-testid="doc-parts">
              Replaced parts:{" "}
              {(["offered", "returned", "declined"] as const).map((k, i) => (
                <span key={k} className={cn(r.parts_disposition === k ? "font-semibold text-foreground" : "")}>{i > 0 ? " / " : ""}{r.parts_disposition === k ? `[${k}]` : k}</span>
              ))}
            </div>
          )}
        </section>
      )}
      {children}
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "font-medium")}>
      <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}
