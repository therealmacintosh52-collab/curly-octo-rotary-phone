import Link from "next/link";
import { ArchiveIcon, ArrowLeftIcon, CameraIcon, CarFrontIcon, CheckIcon, CircleIcon, ClockIcon, XIcon } from "lucide-react";
import type { JobEstimate, JobFinding, PriceListRow } from "@/lib/db/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Page } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JobActions } from "./job-actions";
import { JobPhotos } from "./job-photos";
import type { RetailCharge } from "@/lib/db/types";
import { RetailPayment, type RetailPaymentInfo } from "./retail-payment";
import { RoLayout, RoNotes } from "./ro-notes";
import type { EditableCar } from "./edit-car-sheet";
import { cn } from "@/lib/utils";

export interface JobDetailProps {
  job: EditableCar & {
    dealership_name: string;
    /** Retail jobs: the customer and the vehicle on file (0037). */
    customer?: { id: string; name: string } | null;
    vehicle?: { id: string; name: string } | null;
    invoice: { id: string; display_number: string; status: string } | null;
    /** The QuickBooks invoice number this job sits on (live, kept by the app). */
    quickbooks_doc_number?: string | null;
    /** The shop's own walk-in job: paid at the counter, never invoiced. */
    retail?: boolean;
    /** The repair order number of a retail job (0043). */
    ro_number?: string | null;
    payment?: RetailPaymentInfo;
    deleted_at: string | null;
    deleted_reason: string | null;
    created_at: string;
  };
  photos: { id: string; kind: "photo" | "before" | "after"; url: string | null; created_at: string }[];
  priceList: PriceListRow[];
  detailers: { id: string; full_name: string }[];
  isAdmin: boolean;
  /** Owner, admin: sees the Needs-a-price flag and may type the amount of an "Other" line. No other price appears on a job. */
  canSetAmount: boolean;
  /** retail_charge() for a retail job: the balance, the deposit, the ledger, the receipt signature. */
  charge?: RetailCharge | null;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  /** The notes tab of a retail job (0043). */
  findings?: JobFinding[];
  fromLastTime?: JobFinding[];
  retailServices?: { id: string; name: string }[];
  canNote?: boolean;
  userId?: string;
  initialTab?: "job" | "notes";
  /** The estimates written on this RO (0044). */
  estimates?: JobEstimate[];
}

const vehicle = (v: { year: number | null; make: string | null; model: string | null }) => [v.year, v.make, v.model].filter(Boolean).join(" ");

/**
 * One job, read top to bottom: the car, where it stands (logged → on the
 * month's invoice → paid), services, photos, notes.
 */
export function JobDetail(p: JobDetailProps) {
  const { job, isAdmin, canSetAmount } = p;
  const deleted = !!job.deleted_at;
  const roTitle = !!job.retail && !!job.ro_number;
  const title = `${roTitle ? job.ro_number : job.tag_number}${vehicle(job) ? ` · ${vehicle(job)}` : ""}`;
  const inv = job.invoice;
  const paid = inv?.status === "paid";

  const retail = !!job.retail;
  const paidAtCounter = !!job.payment?.paid_at;
  const estimates = p.estimates ?? [];
  const waiting = estimates.filter((e) => e.status === "sent" || e.status === "viewed").length;
  const toApply = estimates.filter((e) => e.status === "accepted" && !e.applied_at).length;
  const applied = estimates.filter((e) => !!e.applied_at).reduce((s, e) => s + e.lines, 0);
  const steps: { label: string; detail: string; state: "done" | "now" | "todo" | "off" }[] = retail
    ? [
        { label: "Logged", detail: `${formatDate(job.performed_at)} · ${job.dealership_name}`, state: "done" },
        ...(waiting || toApply || applied ? [{ label: waiting ? "Waiting on approval" : toApply ? "Approved" : "Approved work added", detail: waiting ? `${waiting} ${waiting === 1 ? "estimate" : "estimates"} with the customer` : toApply ? "Add the approved work to the RO from the notes tab" : `${applied} ${applied === 1 ? "line" : "lines"} from the estimate`, state: (waiting ? "now" : toApply ? "now" : "done") as "now" | "done" }] : []),
        deleted
          ? { label: "Deleted", detail: `${formatDate(job.deleted_at)}${job.deleted_reason ? ` · ${job.deleted_reason}` : ""} · in the archive`, state: "off" }
          : paidAtCounter
            ? { label: "Paid at the counter", detail: `${job.payment?.payment_method === "clover" ? "Card on the Clover" : job.payment?.payment_method === "cash" ? "Cash" : job.payment?.payment_method === "check" ? "Check" : "Paid"} · ${formatDate(job.payment!.paid_at!)}`, state: "done" }
            : { label: "Collect at the counter", detail: "Retail customer: card on the Clover, or cash / check", state: "now" },
        { label: "Done", detail: paidAtCounter ? "Nothing else to do" : "—", state: deleted ? "off" : paidAtCounter ? "done" : "todo" },
      ]
    : [
    { label: "Logged", detail: `${formatDate(job.performed_at)} · ${job.dealership_name}`, state: "done" },
    deleted
      ? { label: "Deleted", detail: `${formatDate(job.deleted_at)}${job.deleted_reason ? ` · ${job.deleted_reason}` : ""} · in the archive`, state: "off" }
      : inv
        ? { label: "On the month's invoice", detail: `${job.quickbooks_doc_number ? `QuickBooks ${job.quickbooks_doc_number}` : inv.display_number}${inv.status === "void" ? " · voided" : ""}`, state: "done" }
        : job.quickbooks_doc_number
          ? { label: "In QuickBooks", detail: `Invoice ${job.quickbooks_doc_number} · open until the month closes`, state: "done" }
          : { label: "QuickBooks", detail: "Goes on the dealership's open invoice when it syncs", state: "now" },
    deleted || !inv || inv.status === "void"
      ? { label: "Paid", detail: "—", state: deleted ? "off" : "todo" }
      : paid
        ? { label: "Paid", detail: "The dealership paid the invoice", state: "done" }
        : { label: "Paid", detail: inv.status === "draft" ? "Invoice not sent yet" : inv.status === "partial" ? "Partly paid" : "Waiting on the dealership", state: inv.status === "draft" ? "todo" : "now" },
  ];

  return (
    <Page>
      <Link href="/jobs" className="mb-4 inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> {isAdmin ? "Jobs" : "My jobs"}
      </Link>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-label text-subtle">
            {formatDate(job.performed_at, "EEE, MMM d, yyyy")} · {job.dealership_name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-title tracking-wide">{title}</h1>
            {deleted ? <Badge variant="destructive">Deleted</Badge> : retail ? (paidAtCounter ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Collect</Badge>) : inv ? <Badge variant="info">{job.quickbooks_doc_number ? `QB ${job.quickbooks_doc_number}` : inv.display_number}</Badge> : job.quickbooks_doc_number ? <Badge variant="muted">QB {job.quickbooks_doc_number}</Badge> : <Badge variant="muted">Not in QuickBooks yet</Badge>}
            {retail && <Badge variant="muted">Retail</Badge>}
            {roTitle && <Badge variant="outline" data-testid="job-tag">Tag {job.tag_number}</Badge>}
            {canSetAmount && !deleted && job.services.some((s) => s.needs_price) && <Badge variant="warning">Needs a price</Badge>}
          </div>
        </div>
      </div>

      {deleted && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm" data-testid="archived-banner">
          <ArchiveIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            Deleted {formatDate(job.deleted_at)}
            {job.deleted_reason ? ` · ${job.deleted_reason}` : ""}. It stays in the archive; nothing is billed.
          </span>
        </div>
      )}

      <div className="mt-5">
        <JobActions job={job} priceList={p.priceList} detailers={p.detailers} isAdmin={isAdmin} canSetAmount={canSetAmount} canEdit={p.canEdit} canDelete={p.canDelete} canRestore={p.canRestore} lockedReason={!p.canEdit && !deleted && inv ? "On an invoice, so the job is locked" : null} />
      </div>

      {retail ? (
        <RoLayout initialTab={p.initialTab} count={(p.findings ?? []).length} notes={<RoNotes jobId={job.id} roNumber={job.ro_number ?? null} findings={p.findings ?? []} fromLastTime={p.fromLastTime ?? []} services={p.retailServices ?? []} canWrite={!!p.canNote && !deleted} canDeleteAny={canSetAmount && isAdmin} userId={p.userId ?? ""} estimates={estimates} canQuote={canSetAmount} jobOpen={!deleted && !paidAtCounter} />}>
          {body(p, steps, retail, deleted, isAdmin, canSetAmount)}
        </RoLayout>
      ) : (
        <div className="mt-6">{body(p, steps, retail, deleted, isAdmin, canSetAmount)}</div>
      )}
    </Page>
  );
}

function body(p: JobDetailProps, steps: { label: string; detail: string; state: "done" | "now" | "todo" | "off" }[], retail: boolean, deleted: boolean, isAdmin: boolean, canSetAmount: boolean) {
  const { job, photos } = p;
  return (
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Where it stands</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className={cn("grid gap-3", steps.length > 3 ? "sm:grid-cols-4" : "sm:grid-cols-3")} data-testid="job-steps">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CarFrontIcon className="size-4 text-primary" /> The car
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <Fact label={retail ? "Tag" : "Stock number"} value={<span className="text-base font-semibold tracking-wide">{job.tag_number}</span>} />
                {retail && job.ro_number && <Fact label="Repair order" value={<span className="font-semibold tracking-wide" data-testid="job-ro">{job.ro_number}</span>} />}
                <Fact label="Vehicle" value={vehicle(job) || "—"} />
                <Fact label="Color" value={job.color ?? "—"} />
                <Fact
                  label="VIN"
                  value={
                    job.vin ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono">{job.vin}</span>
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <Fact label={retail ? "Location" : "Dealership"} value={job.dealership_name} />
                {retail && (
                  <Fact
                    label="Customer"
                    value={job.customer ? <Link href={`/retail/customers/${job.customer.id}`} className="font-medium hover:text-primary" data-testid="job-customer">{job.customer.name}</Link> : <span className="text-muted-foreground">Not on file</span>}
                  />
                )}
                {retail && job.vehicle && <Fact label="On file as" value={<Link href={`/retail/vehicles/${job.vehicle.id}`} className="hover:text-primary">{job.vehicle.name}</Link>} />}
                {job.ro_po_number && <Fact label="RO / PO" value={job.ro_po_number} />}
                {job.notes && <Fact label="Notes" value={<span className="whitespace-pre-wrap">{job.notes}</span>} />}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Services <Badge variant="muted">{job.services.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm" data-testid="job-services">
                {job.services.map((s, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4 py-2">
                    <div className="min-w-0">
                      <div>{s.label || s.name}</div>
                      {canSetAmount && s.needs_price && <div className="text-caption text-warning">Needs a price: tap Edit job and set the amount</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {retail && job.payment && <RetailPayment jobId={job.id} payment={job.payment} charge={p.charge ?? null} canRecordByHand={isAdmin && canSetAmount} open={!deleted} />}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CameraIcon className="size-4 text-primary" /> Photos {photos.length > 0 && <Badge variant="muted">{photos.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JobPhotos photos={photos} jobId={job.id} canEdit={p.canEdit} />
            </CardContent>
          </Card>
          <p className="px-1 text-caption text-subtle">Logged {formatDateTime(job.created_at)}</p>
        </div>
      </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );
}
