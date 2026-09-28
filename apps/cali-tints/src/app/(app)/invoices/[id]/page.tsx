import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { loadInvoiceBundle } from "@/lib/invoices/load";
import type { JobPhoto, PriceListRow } from "@/lib/db/types";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatDate, formatDateOnly, formatDateTime, nowMs } from "@/lib/dates";
import { Page } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { CarActions } from "@/components/invoices/car-actions";
import { JobPhotos } from "@/components/jobs/job-photos";
import type { EditableCar } from "@/components/jobs/edit-car-sheet";
import { balanceBreakdown } from "@/lib/invoices/breakdown";
import { PaymentsCard } from "@/components/invoices/payments-card";
import { SubmissionsCard } from "@/components/invoices/submissions-card";
import { CloverPanel } from "@/components/invoices/clover-panel";
import { cloverContext } from "@/lib/clover/invoices";
import { cloverPublicKey, orderDashboardUrl } from "@/lib/clover/client";
import { CLOVER_HOSTS } from "@/lib/clover/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoice" };
// "Pay on terminal" waits for the customer to tap; give server actions from this page up to 60 s.
export const maxDuration = 60;

type CarRow = {
  id: string;
  dealership_id: string;
  detailer_id: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  performed_at: string;
  ro_po_number: string | null;
  notes: string | null;
  deleted_at: string | null;
  job_services: { service_id: string; price: number; override_reason: string | null; service: { name: string } | null }[];
};

/**
 * One invoice = one car (older invoices may carry several). Admins send,
 * collect and record; the car's detailer sees it read-only and can fix a
 * typo while it is still an unsent draft.
 */
export default async function InvoiceDetailPage(props: PageProps<"/invoices/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  const bundle = await loadInvoiceBundle(id); // RLS: detailers only reach invoices carrying their cars
  if (!bundle) notFound();
  const { invoice, items, dealership, company, payments, submissions } = bundle;
  const supabase = await createClient();

  // The cars on this invoice (for Edit / Delete and photos). Usually one.
  const { data: carRows } = await supabase
    .from("jobs")
    .select("id, dealership_id, detailer_id, tag_number, vin, year, make, model, color, performed_at, ro_po_number, notes, deleted_at, job_services(service_id, price, override_reason, service:services(name))")
    .eq("invoice_id", id)
    .is("deleted_at", null);
  const cars = (carRows ?? []) as unknown as CarRow[];
  const car = cars.length === 1 ? cars[0] : null;

  const [{ data: photos }, priceListRes, { data: detailers }, submissionsWithUrls] = await Promise.all([
    car ? supabase.from("job_photos").select("*").eq("job_id", car.id).order("created_at") : Promise.resolve({ data: [] as JobPhoto[] }),
    car ? supabase.rpc("dealership_price_list", { p_dealership_id: car.dealership_id }) : Promise.resolve({ data: [] as PriceListRow[] }),
    session.isAdmin && car ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    // Signed URLs for uploaded confirmations.
    Promise.all(
      submissions.map(async (s) => {
        if (!s.confirmation_path) return { ...s, confirmation_url: null };
        const { data } = await supabase.storage.from("submission-confirmations").createSignedUrl(s.confirmation_path, 3600);
        return { ...s, confirmation_url: data?.signedUrl ?? null };
      }),
    ),
  ]);
  // Photos are private: hand the client short-lived signed URLs.
  const signedPhotos = await Promise.all(
    ((photos ?? []) as JobPhoto[]).map(async (p) => {
      const { data: s } = await supabase.storage.from("job-photos").createSignedUrl(p.storage_path, 60 * 60);
      return { ...p, url: s?.signedUrl ?? null };
    }),
  );

  const balance = Number(invoice.total) - Number(invoice.amount_paid);
  const clover = session.isAdmin ? cloverContext(company) : null;
  const ecomPublicKey = clover ? await cloverPublicKey(clover) : null;
  const cloverCard = clover && ecomPublicKey ? { publicKey: ecomPublicKey, merchantId: clover.merchantId, sdkUrl: CLOVER_HOSTS[clover.env].sdk } : null;
  const overdue =
    (invoice.status === "submitted" || invoice.status === "partial") &&
    !!invoice.submitted_at &&
    nowMs() - new Date(invoice.submitted_at).getTime() > session.company.reminder_days * 86400000;

  // Car edits: only while nothing has left the building.
  const isDraft = invoice.status === "draft" && Number(invoice.amount_paid) === 0;
  const ownCar = !!car && (session.isAdmin || car.detailer_id === session.userId);
  const canEdit = !!car && isDraft && ownCar;
  const canDelete = !!car && isDraft && session.isAdmin;
  const lockedReason = car && ownCar && !isDraft ? (invoice.status === "void" ? null : Number(invoice.amount_paid) > 0 ? "A payment is recorded, so the car is locked" : "Sent to the dealership, so the car is locked") : null;
  const editable: EditableCar | null = car
    ? {
        id: car.id,
        dealership_id: car.dealership_id,
        detailer_id: car.detailer_id,
        tag_number: car.tag_number,
        vin: car.vin,
        year: car.year,
        make: car.make,
        model: car.model,
        color: car.color,
        performed_at: car.performed_at,
        ro_po_number: car.ro_po_number,
        notes: car.notes,
        services: car.job_services.map((s) => ({ service_id: s.service_id, name: s.service?.name ?? "", price: Number(s.price), override_reason: s.override_reason })),
      }
    : null;

  const firstCar = items[0];
  const carTitle = car ? `${car.tag_number}${[car.year, car.make, car.model].filter(Boolean).length ? ` · ${[car.year, car.make, car.model].filter(Boolean).join(" ")}` : ""}` : firstCar ? `${firstCar.tag_number}${items.length > 1 ? ` +${new Set(items.map((i) => i.tag_number)).size - 1} more` : ""}` : null;

  return (
    <Page>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {session.isAdmin ? "Invoices" : "My cars"}
      </Link>

      {/* Header: the car first, the invoice number as its id */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-title tracking-wide">{carTitle ?? invoice.display_number}</h1>
            <InvoiceStatusBadge status={invoice.status} overdue={overdue} />
          </div>
          <p className="mt-1 text-base text-foreground">
            <span className="tabular-nums">{invoice.display_number}</span> · {dealership.name}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {invoice.period_start === invoice.period_end ? formatDateOnly(invoice.period_start) : `${formatDateOnly(invoice.period_start)} – ${formatDateOnly(invoice.period_end)}`} · logged {formatDate(invoice.created_at)}
            {invoice.ro_po_number ? ` · RO/PO ${invoice.ro_po_number}` : ""}
            {car?.vin ? ` · VIN ${car.vin}` : ""}
          </p>
          {invoice.status === "void" && (
            <p className="mt-1 text-sm text-destructive">
              Voided {formatDateTime(invoice.voided_at)}
              {invoice.void_reason ? ` · ${invoice.void_reason}` : ""}
            </p>
          )}
        </div>
        {session.isAdmin ? (
          <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Total" value={formatMoney(invoice.total)} />
            <Stat label="Paid" value={formatMoney(invoice.amount_paid)} />
            <Stat label="Balance" value={formatMoney(balance)} highlight={balance > 0 && invoice.status !== "void"} />
          </div>
        ) : (
          <div className="shrink-0">
            <Stat label="Total" value={formatMoney(invoice.total)} />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {session.isAdmin && (
          <InvoiceActions
            invoice={{ id: invoice.id, status: invoice.status, display_number: invoice.display_number, amount_paid: Number(invoice.amount_paid), total: Number(invoice.total), notes: invoice.notes }}
            dealership={{ name: dealership.name, ap_emails: dealership.ap_emails, submission_method: dealership.submission_method }}
            companyEmail={company.email}
            collect={{ device: !!(clover && company.clover_device_id), card: !!cloverCard, payLink: !!(clover && company.clover_hosted_checkout) }}
            breakdown={balanceBreakdown({ invoice, items, payments })}
          />
        )}
        {editable && <CarActions invoiceId={invoice.id} car={editable} priceList={(priceListRes.data ?? []) as PriceListRow[]} detailers={detailers ?? []} canEdit={canEdit} canDelete={canDelete} lockedReason={lockedReason} />}
      </div>

      <div className={cn("mt-6 grid gap-4", session.isAdmin && "lg:grid-cols-[1fr_360px]")}>
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {car ? "Services" : "Line items"} <Badge variant="muted">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-5">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" className="pl-5 sm:pl-2">
                        Date
                      </TableHead>
                      <TableHead scope="col">Tag</TableHead>
                      <TableHead scope="col">Vehicle</TableHead>
                      <TableHead scope="col" className="hidden xl:table-cell">
                        VIN
                      </TableHead>
                      <TableHead scope="col">Service</TableHead>
                      <TableHead scope="col" className="pr-5 text-right sm:pr-2">
                        Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="pl-5 text-muted-foreground sm:pl-2">{formatDate(it.performed_at, "MM/dd/yy")}</TableCell>
                        <TableCell className="font-semibold">{it.tag_number}</TableCell>
                        <TableCell className="whitespace-nowrap">{[it.year, it.make, it.model].filter(Boolean).join(" ")}</TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground xl:table-cell">{it.vin ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{it.service_name}</TableCell>
                        <TableCell className="pr-5 text-right tabular-nums sm:pr-2">{formatMoney(it.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 ml-auto grid w-full max-w-xs gap-1.5 px-5 text-sm sm:px-0">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatMoney(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({formatTaxRate(Number(invoice.tax_rate))})</span>
                  <span className="tabular-nums">{formatMoney(invoice.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMoney(invoice.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {car && (
            <Card>
              <CardHeader>
                <CardTitle>Car</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">VIN</dt>
                  <dd className="font-mono">{car.vin ?? "—"}</dd>
                  <dt className="text-muted-foreground">Color</dt>
                  <dd>{car.color ?? "—"}</dd>
                  <dt className="text-muted-foreground">Detailer</dt>
                  <dd>{items[0]?.detailer_name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-wrap">{car.notes ?? "—"}</dd>
                  {car.job_services.some((s) => s.override_reason) && (
                    <>
                      <dt className="text-muted-foreground">Price overrides</dt>
                      <dd className="text-warning">{car.job_services.filter((s) => s.override_reason).map((s) => `${s.service?.name}: ${s.override_reason}`).join(" · ")}</dd>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {car && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Photos <Badge variant="muted">{signedPhotos.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <JobPhotos photos={signedPhotos} jobId={car.id} canEdit={canEdit} />
              </CardContent>
            </Card>
          )}
        </div>

        {session.isAdmin && (
          <div className="flex min-w-0 flex-col gap-4">
            <PaymentsCard invoiceId={invoice.id} invoiceNumber={invoice.display_number} payments={payments} balance={balance} status={invoice.status} cloverCard={cloverCard} cloverDevice={!!(clover && company.clover_device_id)} />
            <CloverPanel
              enabled={!!clover}
              hostedCheckout={company.clover_hosted_checkout}
              orderUrl={clover && invoice.clover_order_id ? orderDashboardUrl(clover, invoice.clover_order_id) : null}
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
            <SubmissionsCard submissions={submissionsWithUrls} submittedAt={invoice.submitted_at} />
            <Card>
              <CardHeader>
                <CardTitle>Terms</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment terms</span>
                  <span>{invoice.payment_terms}</span>
                </div>
                {invoice.notes && <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{invoice.notes}</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Page>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card px-3 py-2.5 surface-raised sm:px-4 sm:py-3 lg:min-w-28 lg:text-right", highlight && "border-warning/40")}>
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-base font-semibold tabular-nums sm:text-lg", highlight && "text-warning")}>{value}</div>
    </div>
  );
}
