import Link from "next/link";
import { ArrowLeftIcon, CarFrontIcon, CheckIcon, CircleIcon, ClockIcon, XIcon } from "lucide-react";
import type { Company, Dealership, Invoice, InvoiceItem, InvoicePayment, InvoiceSubmission, PaymentMethod, PriceListRow } from "@/lib/db/types";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatDate, formatDateOnly, formatDateTime, nowMs } from "@/lib/dates";
import { balanceBreakdown } from "@/lib/invoices/breakdown";
import { Page } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoiceActions } from "./invoice-actions";
import { CarActions } from "./car-actions";
import { PaymentsCard } from "./payments-card";
import { SubmissionsCard } from "./submissions-card";
import { CloverPanel } from "./clover-panel";
import type { CloverCardConfig } from "./charge-card-dialog";
import type { EditableCar } from "@/components/jobs/edit-car-sheet";
import { cn } from "@/lib/utils";

const METHOD: Record<PaymentMethod, string> = { check: "check", ach: "ACH", card: "card", cash: "cash", other: "other" };
const SUBMIT_METHOD = { email: "by email", portal: "on the dealer portal", paper: "on paper" } as const;

export interface InvoiceDetailProps {
  invoice: Invoice;
  items: InvoiceItem[];
  dealership: Dealership;
  company: Company;
  payments: InvoicePayment[];
  submissions: (InvoiceSubmission & { created_by_name: string | null; confirmation_url: string | null })[];
  /** The one car on this invoice (older invoices may carry several → null). */
  car: (EditableCar & { detailer_name: string | null }) | null;
  priceList: PriceListRow[];
  detailers: { id: string; full_name: string }[];
  isAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  lockedReason: string | null;
  reminderDays: number;
  clover: { enabled: boolean; card: CloverCardConfig | null; device: boolean; payLink: boolean; orderUrl: string | null };
}

const vehicle = (v: { year: number | null; make: string | null; model: string | null }) => [v.year, v.make, v.model].filter(Boolean).join(" ");
const days = (iso: string) => Math.max(0, Math.floor((nowMs() - new Date(iso).getTime()) / 86400000));

/**
 * One invoice, read top to bottom: which car, where the money stands, what
 * happened and when, every service and its price, then the records.
 * Admins get the money actions; a detailer sees their car read-only.
 */
export function InvoiceDetail(p: InvoiceDetailProps) {
  const { invoice, items, dealership, company, payments, submissions, car, isAdmin } = p;
  const balance = Math.round((Number(invoice.total) - Number(invoice.amount_paid)) * 100) / 100;
  const overdue = (invoice.status === "submitted" || invoice.status === "partial") && !!invoice.submitted_at && days(invoice.submitted_at) > p.reminderDays;
  const lastSent = submissions.find((s) => s.status === "sent") ?? null;
  const lastPayment = payments[0] ?? null;
  const detailerName = car?.detailer_name ?? items[0]?.detailer_name ?? null;
  const performedOn = car ? car.performed_at : (items[0]?.performed_at ?? invoice.created_at);
  const cars = groupByCar(items);
  const title = car ? `${car.tag_number}${vehicle(car) ? ` · ${vehicle(car)}` : ""}` : cars.length === 1 ? `${cars[0].tag}${cars[0].vehicle ? ` · ${cars[0].vehicle}` : ""}` : `${cars.length} cars`;

  // Steps: logged → sent → paid (or voided).
  const steps: { label: string; detail: string; state: "done" | "now" | "todo" | "off" }[] = [
    { label: "Logged", detail: `${formatDate(performedOn)}${detailerName ? ` · ${detailerName}` : ""} · ${dealership.name}`, state: "done" },
    invoice.status === "void"
      ? { label: "Voided", detail: `${formatDate(invoice.voided_at ?? invoice.updated_at)}${invoice.void_reason ? ` · ${invoice.void_reason}` : ""}`, state: "off" }
      : invoice.submitted_at
        ? { label: "Sent to the dealership", detail: `${formatDate(invoice.submitted_at)}${lastSent ? ` ${SUBMIT_METHOD[lastSent.method]}${lastSent.recipients.length ? ` to ${lastSent.recipients.join(", ")}` : ""}` : ""}`, state: "done" }
        : { label: "Send to the dealership", detail: isAdmin ? "Not sent yet · email it, or collect on the spot" : "Not sent yet", state: "now" },
    invoice.status === "void"
      ? { label: "Paid", detail: "—", state: "off" }
      : invoice.status === "paid"
        ? { label: "Paid in full", detail: `${invoice.paid_at ? formatDateOnly(invoice.paid_at) : ""}${lastPayment ? ` · ${METHOD[lastPayment.method]}${lastPayment.reference ? ` #${lastPayment.reference}` : ""}` : ""}`, state: "done" }
        : { label: invoice.status === "partial" ? "Partly paid" : "Paid", detail: invoice.status === "partial" ? `${formatMoney(invoice.amount_paid)} received · ${formatMoney(balance)} still due` : `${formatMoney(balance)} due · ${invoice.payment_terms}`, state: invoice.submitted_at ? "now" : "todo" },
  ];

  return (
    <Page>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {isAdmin ? "Invoices" : "My cars"}
      </Link>

      {/* Header: the car, then the invoice as its id */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-label text-subtle">
            <span className="tabular-nums">{invoice.display_number}</span> · {dealership.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-title tracking-wide">{title}</h1>
            <InvoiceStatusBadge status={invoice.status} overdue={overdue} />
          </div>
        </div>
        {isAdmin ? (
          <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Total" value={formatMoney(invoice.total)} />
            <Stat label="Paid" value={formatMoney(invoice.amount_paid)} tone={Number(invoice.amount_paid) > 0 ? "success" : undefined} />
            <Stat label={invoice.status === "void" ? "Balance" : balance > 0 ? "Balance due" : "Balance"} value={formatMoney(invoice.status === "void" ? 0 : balance)} tone={balance > 0 && invoice.status !== "void" ? "warning" : "success"} />
          </div>
        ) : (
          <div className="shrink-0">
            <Stat label="Total" value={formatMoney(invoice.total)} />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {isAdmin && (
          <InvoiceActions
            invoice={{ id: invoice.id, status: invoice.status, display_number: invoice.display_number, amount_paid: Number(invoice.amount_paid), total: Number(invoice.total), notes: invoice.notes }}
            dealership={{ name: dealership.name, ap_emails: dealership.ap_emails, submission_method: dealership.submission_method }}
            companyEmail={company.email}
            collect={{ device: p.clover.device, card: !!p.clover.card, payLink: p.clover.payLink }}
            breakdown={balanceBreakdown({ invoice, items, payments })}
          />
        )}
        {car && <CarActions invoiceId={invoice.id} car={car} priceList={p.priceList} detailers={p.detailers} canEdit={p.canEdit} canDelete={p.canDelete} lockedReason={p.lockedReason} />}
      </div>

      <div className={cn("mt-6 grid gap-4", isAdmin && "lg:grid-cols-[1fr_360px]")}>
        <div className="flex min-w-0 flex-col gap-4">
          {/* Where it stands */}
          <Card>
            <CardHeader>
              <CardTitle>Where it stands</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3 sm:grid-cols-3" data-testid="invoice-steps">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3 sm:flex-col sm:gap-2">
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                        s.state === "done" && "border-success bg-success/15 text-success",
                        s.state === "now" && "border-primary bg-accent-soft text-primary",
                        s.state === "todo" && "border-border text-subtle",
                        s.state === "off" && "border-destructive/50 text-destructive",
                      )}
                      aria-hidden
                    >
                      {s.state === "done" ? <CheckIcon className="size-3.5" /> : s.state === "now" ? <ClockIcon className="size-3.5" /> : s.state === "off" ? <XIcon className="size-3.5" /> : <CircleIcon className="size-2.5" />}
                    </span>
                    <div className="min-w-0">
                      <div className={cn("text-sm font-medium", s.state === "todo" && "text-muted-foreground")}>{s.label}</div>
                      <div className="text-caption break-words text-muted-foreground">{s.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* The car */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CarFrontIcon className="size-4 text-primary" /> {cars.length > 1 ? `Cars on this invoice` : "The car"}
                {cars.length > 1 && <Badge variant="muted">{cars.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {car ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  <Fact label="Key tag" value={<span className="text-base font-semibold tracking-wide">{car.tag_number}</span>} />
                  <Fact label="Vehicle" value={vehicle(car) || "—"} />
                  <Fact label="Color" value={car.color ?? "—"} />
                  <Fact label="VIN" value={car.vin ? <span className="font-mono">{car.vin}</span> : "—"} />
                  <Fact label="Dealership" value={dealership.name} />
                  <Fact label="Detailed on" value={formatDate(car.performed_at)} />
                  <Fact label="Detailer" value={detailerName ?? "—"} />
                  {car.ro_po_number && <Fact label="RO / PO" value={car.ro_po_number} />}
                  {car.notes && <Fact label="Notes" value={<span className="whitespace-pre-wrap">{car.notes}</span>} />}
                </dl>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {cars.map((c) => (
                    <li key={c.key} className="flex items-baseline justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <span className="font-semibold tracking-wide">{c.tag}</span>
                        {c.vehicle && <span className="text-muted-foreground"> · {c.vehicle}</span>}
                        <div className="text-caption text-subtle">
                          {formatDate(c.performed_at)}
                          {c.vin ? ` · ${c.vin}` : ""}
                          {c.detailer ? ` · ${c.detailer}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 tabular-nums">{formatMoney(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Services and money */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Services <Badge variant="muted">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm" data-testid="invoice-services">
                {cars.map((c) => (
                  <li key={c.key} className="py-1">
                    {cars.length > 1 && (
                      <div className="pt-1.5 text-caption font-medium text-subtle">
                        {c.tag}
                        {c.vehicle ? ` · ${c.vehicle}` : ""} · {formatDate(c.performed_at, "MMM d")}
                      </div>
                    )}
                    <ul>
                      {c.lines.map((it) => {
                        const override = car?.services.find((s) => (s.label || s.name) === it.service_name)?.override_reason ?? null;
                        return (
                          <li key={it.id} className="flex items-baseline justify-between gap-4 py-2">
                            <div className="min-w-0">
                              <div>{it.service_name}</div>
                              {override && <div className="text-caption text-warning">Price changed: {override}</div>}
                            </div>
                            <span className="shrink-0 tabular-nums">{formatMoney(it.price)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid gap-1.5 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatMoney(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({formatTaxRate(Number(invoice.tax_rate))})</span>
                  <span className="tabular-nums">{formatMoney(invoice.tax)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Invoice total</span>
                  <span className="tabular-nums">{formatMoney(invoice.total)}</span>
                </div>
                {isAdmin && invoice.status !== "void" && (
                  <>
                    {payments.map((pm) => (
                      <div key={pm.id} className="flex justify-between text-muted-foreground">
                        <span>
                          Paid {formatDateOnly(pm.paid_at)} · {pm.source && pm.source !== "manual" ? "Clover" : METHOD[pm.method]}
                          {pm.reference ? ` #${pm.reference}` : ""}
                        </span>
                        <span className="tabular-nums">-{formatMoney(pm.amount)}</span>
                      </div>
                    ))}
                    <div className={cn("flex justify-between border-t border-border pt-2 text-base font-semibold", balance > 0 ? "text-warning" : "text-success")}>
                      <span>{balance > 0 ? "Balance due" : "Paid in full"}</span>
                      <span className="tabular-nums">{formatMoney(balance)}</span>
                    </div>
                  </>
                )}
              </div>
              <p className="mt-3 text-caption text-subtle">
                Terms {invoice.payment_terms}
                {invoice.notes ? ` · ${invoice.notes}` : ""}
              </p>
            </CardContent>
          </Card>

        </div>

        {isAdmin && (
          <div className="flex min-w-0 flex-col gap-4">
            <PaymentsCard invoiceId={invoice.id} invoiceNumber={invoice.display_number} payments={payments} balance={balance} status={invoice.status} cloverCard={p.clover.card} cloverDevice={p.clover.device} />
            <SubmissionsCard submissions={submissions} submittedAt={invoice.submitted_at} />
            <CloverPanel
              enabled={p.clover.enabled}
              hostedCheckout={company.clover_hosted_checkout}
              orderUrl={p.clover.orderUrl}
              invoice={{
                id: invoice.id,
                status: invoice.status,
                balance,
                clover_order_id: invoice.clover_order_id,
                clover_pushed_at: invoice.clover_pushed_at,
                clover_checkout_url: invoice.clover_checkout_url,
                clover_checkout_expires_at: invoice.clover_checkout_expires_at,
              }}
            />
            <p className="px-1 text-caption text-subtle">
              Invoice created {formatDateTime(invoice.created_at)}
              {invoice.period_start !== invoice.period_end ? ` · period ${formatDateOnly(invoice.period_start)} – ${formatDateOnly(invoice.period_end)}` : ""}
            </p>
          </div>
        )}
      </div>
    </Page>
  );
}

/** Lines grouped by car (older invoices carry several cars; new ones exactly one). */
function groupByCar(items: InvoiceItem[]) {
  const map = new Map<string, { key: string; tag: string; vehicle: string; vin: string | null; detailer: string | null; performed_at: string; total: number; lines: InvoiceItem[] }>();
  for (const it of items) {
    const key = it.job_id ?? `${it.tag_number}|${it.performed_at.slice(0, 10)}`;
    const g = map.get(key) ?? { key, tag: it.tag_number, vehicle: vehicle(it), vin: it.vin, detailer: it.detailer_name, performed_at: it.performed_at, total: 0, lines: [] };
    g.total += Number(it.price);
    g.lines.push(it);
    map.set(key, g);
  }
  return [...map.values()];
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" | "success" }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card px-3 py-2.5 surface-raised sm:px-4 sm:py-3 lg:min-w-28 lg:text-right", tone === "warning" && "border-warning/40")}>
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-base font-semibold tabular-nums sm:text-lg", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{value}</div>
    </div>
  );
}
