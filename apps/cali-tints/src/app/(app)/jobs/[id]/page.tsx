import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog, Job, JobPhoto, PriceListRow } from "@/lib/db/types";
import { formatMoney, sumPrices } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Page } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobStatusBadge, vehicleLabel } from "@/components/jobs/jobs-table";
import { JobActions } from "@/components/jobs/job-actions";
import { JobPhotos } from "@/components/jobs/job-photos";
import { AuditTimeline } from "@/components/jobs/audit-timeline";

export const metadata: Metadata = { title: "Job" };

type JobDetail = Job & {
  dealership: { id: string; name: string; invoice_mode: "batch" | "per_job" } | null;
  detailer: { id: string; full_name: string } | null;
  invoice: { id: string; display_number: string; status: "draft" | "submitted" | "partial" | "paid" | "void" } | null;
  job_services: { id: string; service_id: string; price: number; override_reason: string | null; service: { name: string } | null }[];
};

export default async function JobDetailPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("jobs")
    .select(
      `*, dealership:dealerships(id, name, invoice_mode), detailer:profiles!jobs_detailer_id_fkey(id, full_name),
       invoice:invoices(id, display_number, status), job_services(id, service_id, price, override_reason, service:services(name))`,
    )
    .eq("id", id)
    .maybeSingle();
  const job = data as unknown as JobDetail | null;
  if (!job) notFound();

  const [{ data: photos }, priceListRes, auditRes, { data: detailers }] = await Promise.all([
    supabase.from("job_photos").select("*").eq("job_id", id).order("created_at"),
    supabase.rpc("dealership_price_list", { p_dealership_id: job.dealership_id }),
    session.isAdmin
      ? supabase
          .from("audit_log")
          .select("*")
          .or(`row_id.eq.${id},and(table_name.eq.job_services,row_id.in.(${job.job_services.map((s) => s.id).join(",") || "00000000-0000-0000-0000-000000000000"}))`)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as AuditLog[] }),
    session.isAdmin ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name") : Promise.resolve({ data: [] }),
  ]);

  // Photos are private: hand the client short-lived signed URLs.
  const signedPhotos = await Promise.all(
    ((photos ?? []) as JobPhoto[]).map(async (p) => {
      const { data: s } = await supabase.storage.from("job-photos").createSignedUrl(p.storage_path, 60 * 60);
      return { ...p, url: s?.signedUrl ?? null };
    }),
  );

  // Resolve actor names for the audit trail in one query.
  const audit = (auditRes.data ?? []) as AuditLog[];
  const actorIds = Array.from(new Set(audit.map((a) => a.actor_id).filter((x): x is string => !!x)));
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };
  const actorNames = Object.fromEntries((actors ?? []).map((a) => [a.id, a.full_name]));

  const total = sumPrices(job.job_services);
  const locked = !!job.invoice_id && job.invoice?.status !== "void";
  const canEdit = !locked && !job.deleted_at && (session.isAdmin || job.detailer_id === session.userId);

  return (
    <Page narrow>
      <Link href="/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Jobs
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-wider">{job.tag_number}</h1>
            <JobStatusBadge row={{ deleted_at: job.deleted_at, invoice: job.invoice }} />
          </div>
          <p className="mt-1 text-lg">{vehicleLabel(job)}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(job.performed_at)} · {job.dealership?.name} · {job.detailer?.full_name}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl font-semibold tabular-nums">{formatMoney(total)}</div>
          {job.invoice && session.isAdmin && (
            <Link href={`/invoices/${job.invoice.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              {job.invoice.display_number} <ExternalLinkIcon className="size-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4">
        <JobActions
          job={{
            id: job.id,
            dealership_id: job.dealership_id,
            detailer_id: job.detailer_id,
            tag_number: job.tag_number,
            vin: job.vin,
            year: job.year,
            make: job.make,
            model: job.model,
            color: job.color,
            performed_at: job.performed_at,
            ro_po_number: job.ro_po_number,
            notes: job.notes,
            deleted_at: job.deleted_at,
            per_job: job.dealership?.invoice_mode === "per_job",
            services: job.job_services.map((s) => ({
              service_id: s.service_id,
              name: s.service?.name ?? "",
              price: Number(s.price),
              override_reason: s.override_reason,
            })),
          }}
          priceList={(priceListRes.data ?? []) as PriceListRow[]}
          detailers={detailers ?? []}
          canEdit={canEdit}
          isAdmin={session.isAdmin}
          locked={locked}
        />
      </div>

      <div className="mt-6 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {job.job_services.map((s) => (
                <li key={s.id} className="flex items-start justify-between py-2.5 text-sm">
                  <div>
                    <div>{s.service?.name}</div>
                    {s.override_reason && <div className="text-xs text-warning">Override: {s.override_reason}</div>}
                  </div>
                  <span className="tabular-nums">{formatMoney(s.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-border pt-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">VIN</dt>
              <dd className="font-mono">{job.vin ?? "—"}</dd>
              <dt className="text-muted-foreground">Color</dt>
              <dd>{job.color ?? "—"}</dd>
              <dt className="text-muted-foreground">RO / PO</dt>
              <dd>{job.ro_po_number ?? "—"}</dd>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap">{job.notes ?? "—"}</dd>
              {job.dup_reviewed_at && (
                <>
                  <dt className="text-muted-foreground">Double-bill review</dt>
                  <dd>
                    <span className="text-success">Marked OK to bill</span> {formatDateTime(job.dup_reviewed_at)}
                    {job.dup_review_note ? ` · ${job.dup_review_note}` : ""}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Logged</dt>
              <dd>{formatDateTime(job.created_at)}</dd>
              {job.deleted_at && (
                <>
                  <dt className="text-muted-foreground">Deleted</dt>
                  <dd>
                    {formatDateTime(job.deleted_at)}
                    {job.delete_reason ? ` · ${job.delete_reason}` : ""}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Photos <Badge variant="muted">{signedPhotos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <JobPhotos photos={signedPhotos} jobId={job.id} canEdit={canEdit} />
          </CardContent>
        </Card>

        {session.isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTimeline entries={audit} actorNames={actorNames} />
            </CardContent>
          </Card>
        )}
      </div>

      {!canEdit && !job.deleted_at && locked && (
        <p className="mt-4 text-center text-xs text-muted-foreground">This job is on {job.invoice?.display_number} and is locked. Void the invoice to edit it.</p>
      )}
      <div className="h-6" />
      <Button asChild variant="ghost" className="w-full sm:hidden">
        <Link href="/jobs">Back to jobs</Link>
      </Button>
    </Page>
  );
}
