"use client";

import { PrintButton } from "@/components/retail/print-button";
import { estimateConditionNote } from "@/lib/retail/part-condition";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CarIcon, ChevronDownIcon, UserIcon, ArrowLeftIcon, CalendarPlusIcon, CheckIcon, ClipboardCheckIcon, CopyIcon, FileDownIcon, LinkIcon, MailIcon, MessageSquareTextIcon, PencilIcon, PlusIcon, SendIcon, Share2Icon, StarIcon, ThumbsDownIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";
import type { ActivityEntry, EstimateView, InspectionTemplate, JobEstimate, SignedDocumentRow, VisitInspection } from "@/lib/db/types";
import { convertEstimateAction, declineEstimateAction, markEstimateAcceptedAction, sendEstimateAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { detectPlatform, formatPhone, smsHref } from "@/lib/retail/phone";
import { SIZE_LABEL } from "@/lib/retail/size-class";
import { Page } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RoLayout } from "@/components/jobs/ro-notes";
import { RoStageBar } from "./ro-stage-bar";
import { RoWorkCard } from "@/components/jobs/ro-work-card";
import { RoInvoiceCard } from "@/components/jobs/ro-invoice-card";
import { RetailPayment } from "@/components/jobs/retail-payment";
import { JobStageBar } from "@/components/jobs/job-stage-bar";
import { InvoiceDocument } from "./invoice-document";
import { SignaturePad, signatureBlob } from "./signature-pad";
import { SignaturesCard } from "./signatures-card";
import { ActivityCard } from "./activity-card";
import { EstimateMeta } from "./estimate-meta";
import { SendToTechButton } from "./send-to-tech";
import { InspectionCard } from "./inspection-card";
import { TransferButton } from "./transfer-dialog";
import { EstimateStageBadge } from "./estimate-stage-badge";
import { documentNumber, viewStage } from "@/lib/retail/estimate-stage";
import type { VisitPanel } from "@/lib/retail/visit";
import type { JobAction } from "@/lib/retail/job-action";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sectionHeading } from "@/lib/retail/sections";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = { walk_in: "Walk-in", online_booking: "Online booking", referral: "Referral", phone: "Phone", social: "Social", other: "Other" };
const money = (n: number | null | undefined) => (n === null || n === undefined ? null : formatMoney(n));

/**
 * One estimate for the staff: where it stands, the options with their lines,
 * the add-ons, the customer's approval with the signature. Owner and admin
 * send it, record an approval taken in person or by phone, decline it, turn
 * it into the job. Managers and detailers see everything but the money.
 */
export function EstimateDetail({ e, showMoney, publicUrl, notes, findingsCount, visit, supplements = [], documents = [], activity = null, inspections = [], inspectionTemplates = [] }: { /** The checklists on this visit and the lists a new one can start from (0073). */ inspections?: VisitInspection[]; inspectionTemplates?: InspectionTemplate[]; /** Who viewed it and who did what, with date and time (0066); only for the people who may read it. */ activity?: ActivityEntry[] | null; /** The frozen signed copies of this visit (0062). */ documents?: SignedDocumentRow[]; /** The extra-work estimates written on this visit (they appear in the Signatures card). */ supplements?: JobEstimate[]; e: EstimateView; showMoney: boolean; publicUrl: string | null; /** Once approved: the work done, the authorizations, the payments and the invoice, read through the visit (0057). */ visit?: VisitPanel | null; /** The findings side panel (notes, photos, clips, recommendations); beside the estimate on a wide screen, a tab on a phone. */ notes?: React.ReactNode; findingsCount?: number }) {
  const router = useRouter();
  const { canPrices, isAdmin, demo } = useSession();
  const [pending, start] = useTransition();
  const [sentUrl, setSentUrl] = useState<string | null>(e.status === "draft" ? null : publicUrl);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "unknown">("unknown");
  useEffect(() => {
    const t = setTimeout(() => setPlatform(detectPlatform(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);

  const open = e.status === "draft" || e.status === "sent" || e.status === "viewed";
  const accepted = e.status === "accepted";
  const auth = e.authorizations[0] ?? null;
  const chosen = e.options.find((o) => o.id === e.selected_option_id) ?? null;
  const customerName = e.customer.display_name ?? e.customer.first_name;
  const url = (visit?.receiptUrl && !open ? visit.receiptUrl : null) ?? sentUrl ?? publicUrl ?? "";
  const ro = e.job ?? null;
  const supplement = e.kind === "supplement" && !!ro;
  const stage = viewStage(e);
  const invoiceDoc = visit?.invoiceDoc ?? null;
  const num = documentNumber({ display_number: e.display_number, invoice_number: ro?.invoice_number ?? null, ro_number: ro?.ro_number ?? e.ro_number ?? null, stage });
  const [applying, startApply] = useTransition();
  function applyToRo() {
    if (!ro) return;
    startApply(async () => {
      if (demo) return void toast.success("Added to the estimate", { description: "Guest preview — nothing changed" });
      const r = await convertEstimateAction(e.id, {});
      if (!r.ok) return void toast.error(r.error);
      toast.success("Approved items added to the estimate");
      router.refresh();
    });
  }
  function createInvoice() {
    startApply(async () => {
      if (demo) return void toast.success("Invoice created", { description: "Guest preview — nothing changed" });
      const r = await convertEstimateAction(e.id, {});
      if (!r.ok) return void toast.error(r.error);
      toast.success("Invoice created");
      router.refresh();
    });
  }
  const lineMeta = (l: EstimateView["options"][number]["lines"][number]) => {
    const t = l.line_type ?? "service";
    if (t === "labor") return `${l.hours} h${showMoney && l.rate !== null && l.rate !== undefined ? ` × ${formatMoney(l.rate)}` : ""}`;
    if (t === "part") return [l.qty !== 1 ? `${l.qty} ×${showMoney && l.unit_price !== null ? ` ${formatMoney(l.unit_price)}` : ""}` : null, l.part_number, l.vendor, estimateConditionNote(l.part_condition)].filter(Boolean).join(" · ");
    if (t === "sublet") return l.vendor ?? "";
    return "";
  };
  const smsBody = `Hi ${e.customer.first_name || "there"}, here is your estimate${e.vehicle?.name ? ` for the ${e.vehicle.name}` : ""} from ${e.company.name}: ${url}`;

  function send(via: "email" | "link") {
    start(async () => {
      if (demo) {
        setSentUrl(publicUrl);
        toast.success(via === "email" ? "Emailed to the customer" : "Link ready", { description: "Guest preview — nothing was sent" });
        return;
      }
      const r = await sendEstimateAction(e.id, via);
      if (!r.ok) return void toast.error(r.error);
      setSentUrl(r.data.url);
      if (via === "email") toast[r.data.emailed ? "success" : "warning"](r.data.emailed ? `Emailed to ${e.customer.email}` : "Marked sent; the email did not go out", { description: r.data.emailed ? undefined : r.data.note ?? undefined });
      else toast.success("Link ready. Text it or copy it.");
      router.refresh();
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy; long-press the link instead");
    }
  }
  function decline(reason: string) {
    start(async () => {
      if (demo) {
        toast.success("Declined", { description: "Guest preview — nothing changed" });
        setDeclining(false);
        return;
      }
      const r = await declineEstimateAction(e.id, reason);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Declined");
      setDeclining(false);
      router.refresh();
    });
  }

  const mainGrid = (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="contents">
        {invoiceDoc && (
          <div data-testid="estimate-invoice-document">
            <InvoiceDocument r={invoiceDoc} />
          </div>
        )}
        {!invoiceDoc && e.options.map((o) => {
          const isChosen = chosen?.id === o.id;
          // Named jobs (0054): grouped, Diagnosis first, then safety, due soon, optional; the lines of one job sit together.
          const jobs = o.jobs ?? [];
          const lines = jobs.length ? [...jobs.flatMap((j) => o.lines.filter((l) => l.estimate_job_id === j.id)), ...o.lines.filter((l) => !jobs.some((j) => j.id === l.estimate_job_id))] : o.lines;
          const heading = (li: number): React.ReactNode => {
            if (!jobs.length) return sectionHeading(o.lines, li);
            const l = lines[li];
            if (li > 0 && lines[li - 1].estimate_job_id === l.estimate_job_id) return null;
            const j = jobs.find((x) => x.id === l.estimate_job_id);
            if (!j) return "Other items";
            const total = lines.filter((x) => x.estimate_job_id === j.id).reduce((sum, x) => sum + (x.line_total ?? 0), 0);
            return (
              <span className="flex flex-wrap items-center gap-2" data-job={j.title}>
                <span className="text-foreground">{j.title}</span>
                {j.kind !== "diagnosis" && <Badge variant={j.priority === "safety" ? "destructive" : j.priority === "soon" ? "warning" : "muted"} data-testid="job-priority">{{ safety: "Safety", soon: "Due soon", optional: "Optional" }[j.priority]}</Badge>}
                {j.status !== "recommended" && <Badge variant={j.status === "declined" ? "muted" : "success"}>{{ approved: "Approved", declined: "Declined", done: "Done", recommended: "" }[j.status]}</Badge>}
                {showMoney && <span className="ml-auto tabular-nums text-muted-foreground">{money(total)}</span>}
              </span>
            );
          };
          const lineRow = (l: typeof o.lines[number]) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          {(l.line_type ?? "service") !== "service" && <Badge variant="muted">{l.line_type}</Badge>}
                          <span>{l.name}{(l.line_type ?? "service") === "service" && l.qty !== 1 ? ` × ${l.qty}` : ""}</span>
                          {accepted && o.tier === "single" && l.customer_approved === false && <Badge variant="muted">Declined</Badge>}
                        </div>
                        {lineMeta(l) && <div className="text-caption text-subtle">{lineMeta(l)}</div>}
                        {l.benefit_text && <div className="text-caption text-subtle">{l.benefit_text}</div>}
                        {l.modifiers.length > 0 && <div className="text-caption text-warning">{l.modifiers.map((m) => m.label).join(", ")}</div>}
                        {showMoney && l.cost !== null && l.cost !== undefined && <div className="text-caption text-subtle">Cost {formatMoney(Number(l.cost) * ((l.line_type ?? "service") === "labor" ? 1 : l.qty))}</div>}
                      </div>
                      {showMoney && <span className={cn("shrink-0 tabular-nums", accepted && o.tier === "single" && l.customer_approved === false && "line-through text-muted-foreground")}>{money(l.line_total)}</span>}
                    </li>
          );
          if (o.tier === "single" && jobs.length > 0) {
            // One option: the work is numbered sections that open and close, like the shop's own estimate.
            const groups = jobs.map((j) => ({ job: j, ls: lines.filter((l) => l.estimate_job_id === j.id) }));
            const rest = lines.filter((l) => !jobs.some((j) => j.id === l.estimate_job_id));
            return (
              <div key={o.id} className="grid gap-2" data-testid="estimate-option">
                {groups.map(({ job: j, ls }, gi) => {
                  const total = ls.reduce((sum, x) => sum + (x.line_total ?? 0), 0);
                  return (
                    <details key={j.id} open className="group rounded-xl border border-border bg-card surface-raised" data-job={j.title}>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 font-semibold marker:hidden" data-testid="line-section">
                        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground -rotate-90 transition-transform group-open:rotate-0" />
                        <span>{gi + 1}. {j.title}</span>
                        {j.kind !== "diagnosis" && <Badge variant={j.priority === "safety" ? "destructive" : j.priority === "soon" ? "warning" : "muted"} data-testid="job-priority">{{ safety: "Safety", soon: "Due soon", optional: "Optional" }[j.priority]}</Badge>}
                        {j.status !== "recommended" && <Badge variant={j.status === "declined" ? "muted" : "success"}>{{ approved: "Approved", declined: "Declined", done: "Done", recommended: "" }[j.status]}</Badge>}
                        {showMoney && <span className="ml-auto tabular-nums text-muted-foreground">{money(total)}</span>}
                      </summary>
                      <ul className="divide-y divide-border border-t border-border px-4 text-sm">{ls.map((l) => lineRow(l))}</ul>
                    </details>
                  );
                })}
                {rest.length > 0 && (
                  <div className="rounded-xl border border-border bg-card px-4 text-sm surface-raised">
                    <ul className="divide-y divide-border">{rest.map((l) => lineRow(l))}</ul>
                  </div>
                )}
                {showMoney && (o.shop_supplies ?? 0) > 0 && <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"><span className="text-muted-foreground">Shop supplies</span><span className="tabular-nums">{money(o.shop_supplies)}</span></div>}
              </div>
            );
          }
          return (
            <Card key={o.id} className={cn(isChosen && "border-primary", !accepted && o.recommended && "border-primary/50")} data-testid="estimate-option">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {o.name}
                    {isChosen && <Badge variant="success"><CheckIcon /> Chosen</Badge>}
                    {!accepted && o.recommended && e.options.length > 1 && <Badge variant="outline"><StarIcon /> Recommended</Badge>}
                  </CardTitle>
                  {o.description && <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>}
                </div>
                {showMoney && <div className="shrink-0 text-lg font-semibold tabular-nums">{money(o.total)}</div>}
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border text-sm">
                  {lines.map((l, li) => (
                    <Fragment key={l.id}>
                    {heading(li) && <li className="pt-3 pb-1 text-label text-subtle" data-testid="line-section">{heading(li)}</li>}
                    {lineRow(l)}
                    </Fragment>
                  ))}
                </ul>
                {showMoney && (o.shop_supplies ?? 0) > 0 && <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm"><span className="text-muted-foreground">Shop supplies</span><span className="tabular-nums">{money(o.shop_supplies)}</span></div>}
                <div className="mt-2 text-caption text-subtle">About {Math.round((o.duration_minutes / 60) * 10) / 10} h of work</div>
              </CardContent>
            </Card>
          );
        })}

        {!invoiceDoc && e.addons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{accepted ? "Add-ons" : "Add-ons offered"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm" data-testid="estimate-addons">
                {e.addons.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium">{a.name}</div>
                      {a.benefit_text && <div className="text-caption text-subtle">{a.benefit_text}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {accepted ? <Badge variant={a.customer_approved ? "success" : "muted"}>{a.customer_approved ? "Yes" : "No"}</Badge> : a.default_on ? <Badge variant="outline">On by default</Badge> : null}
                      {showMoney && <span className="w-16 text-right tabular-nums">{money(a.line_total)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {!notes && (e.findings ?? []).length > 0 && (
          <Card data-testid="estimate-findings">
            <CardHeader>
              <CardTitle>What the tech found</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {e.findings!.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className={cn("inline-block size-2.5 shrink-0 rounded-full", f.severity === "urgent" ? "bg-destructive" : f.severity === "soon" ? "bg-warning" : "bg-success")} /><span className="font-medium">{f.title}</span></div>
                      {f.body && <p className="mt-0.5 text-caption text-subtle">{f.body}</p>}
                      {f.media.length > 0 && <div className="mt-1 text-caption text-subtle">{f.media.length} {f.media.length === 1 ? "photo or clip" : "photos / clips"} on the estimate</div>}
                    </div>
                    <Badge variant={f.status === "approved" ? "success" : f.status === "declined" ? "muted" : "info"}>{f.status === "approved" ? "Approved" : f.status === "declined" ? "Declined" : "Quoted"}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <InspectionCard estimateId={e.id} inspections={inspections} templates={inspectionTemplates} canShare={!!canPrices} canWrite={!supplement} />

        {(e.customer_notes || e.internal_notes) && (
          <Card className="order-last">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {e.customer_notes && <div><div className="text-caption text-muted-foreground">To the customer</div><p className="whitespace-pre-wrap">{e.customer_notes}</p></div>}
              {e.internal_notes && <div><div className="text-caption text-muted-foreground">Staff only</div><p className="whitespace-pre-wrap">{e.internal_notes}</p></div>}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="contents">
        {showMoney && !invoiceDoc && (
          <Card data-testid="estimate-money">
            <CardContent className="grid gap-1.5 pt-5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{accepted ? "Subtotal" : e.options.length > 1 ? "Subtotal (recommended)" : "Subtotal"}</span><span className="tabular-nums">{money(e.subtotal)}</span></div>
              {(e.shop_supplies ?? 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Shop supplies</span><span className="tabular-nums" data-testid="estimate-supplies">{money(e.shop_supplies)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ({formatTaxRate(Number(e.tax_rate ?? 0))})</span><span className="tabular-nums">{money(e.tax)}</span></div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums" data-testid="estimate-total">{money(e.total)}</span></div>
              {(e.deposit_required ?? 0) > 0 && <div className="flex justify-between text-caption text-subtle"><span>Deposit to book</span><span className="tabular-nums">{money(e.deposit_required)}</span></div>}
              {e.po_number && <div className="flex justify-between text-caption text-subtle"><span>PO</span><span>{e.po_number}</span></div>}
            </CardContent>
          </Card>
        )}

        {canPrices && open && (
          <Card id="estimate-send" className="scroll-mt-24" data-testid="estimate-send">
            <CardHeader>
              <CardTitle>{e.status === "draft" ? "Send it" : "Sent"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {e.status === "draft" && <p className="text-caption text-subtle">The customer opens a link, picks an option, signs and approves. Nothing goes out until you tap.</p>}
              {url && e.status !== "draft" && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-caption">
                  <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate" data-testid="estimate-link">{url}</span>
                  <button type="button" onClick={copy} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground" aria-label="Copy link"><CopyIcon className="size-4" /></button>
                </div>
              )}
              <Button onClick={() => send("email")} loading={pending} disabled={!e.customer.email} data-testid="send-email">
                <MailIcon /> {e.status === "draft" ? "Email the link" : "Email it again"}
              </Button>
              {!e.customer.email && <p className="text-caption text-subtle">No email on file: text the link instead.</p>}
              {e.status === "draft" ? (
                <Button variant="outline" onClick={() => send("link")} loading={pending} data-testid="send-link">
                  <SendIcon /> Mark sent, give me the link
                </Button>
              ) : (
                <>
                  {e.customer.phone && (
                    <Button asChild variant="outline">
                      <a href={smsHref(e.customer.phone, smsBody, platform) ?? "#"} data-testid="text-link">
                        <MessageSquareTextIcon /> Text the link
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" onClick={copy}>
                    <CopyIcon /> Copy the link
                  </Button>
                </>
              )}
              {e.status !== "draft" && (
                <p className="text-caption text-subtle">
                  Sent {formatDateTime(e.sent_at)}{e.view_count ? ` · opened ${e.view_count}× · last ${formatDateTime(e.last_viewed_at)}` : " · not opened yet"}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {canPrices && open && (
          <Card>
            <CardHeader>
              <CardTitle>They answered in person?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="secondary" onClick={() => setAccepting(true)} data-testid="mark-accepted">
                <CheckIcon /> Mark approved
              </Button>
              <Button variant="ghost" onClick={() => setDeclining(true)} data-testid="mark-declined">
                <ThumbsDownIcon /> Declined
              </Button>
            </CardContent>
          </Card>
        )}

        {auth && !visit && (
          <Card data-testid="estimate-authorization">
            <CardHeader>
              <CardTitle>{accepted ? "Approved" : "Answer"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="font-medium">{auth.name}</div>
              <div className="text-caption text-subtle">{formatDateTime(auth.authorized_at)} · {auth.method === "online" ? "signed online" : `in ${auth.method.replace("_", " ")}`}{auth.pay_choice ? ` · ${auth.pay_choice === "deposit" ? "pays the deposit online" : "pays at the shop"}` : ""}</div>
              {auth.signature_path && <Badge variant="success"><PencilIcon /> Signature on file{showMoney ? " · on the PDF" : ""}</Badge>}
              {showMoney && auth.total !== null && <div className="text-caption text-subtle">Approved total {money(auth.total)}</div>}
            </CardContent>
          </Card>
        )}
        {e.status === "declined" && (
          <Card>
            <CardContent className="pt-5 text-sm">
              <div className="font-medium">Declined {formatDateTime(e.declined_at)}</div>
              {e.decline_reason && <p className="mt-1 text-muted-foreground">{e.decline_reason}</p>}
            </CardContent>
          </Card>
        )}

        {supplement && ro && accepted && (
          <Card data-testid="estimate-apply">
            <CardHeader>
              <CardTitle>Next</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {e.applied_at ? (
                <p className="text-sm text-muted-foreground">The approved items are on the main estimate; they are collected with the rest.</p>
              ) : canPrices ? (
                <Button onClick={applyToRo} loading={applying} data-testid="apply-to-ro"><ClipboardCheckIcon /> Add the approved items to the estimate</Button>
              ) : (
                <p className="text-sm text-muted-foreground">Approved; the advisor adds it to the estimate.</p>
              )}
              {ro.primary_estimate_id && <Button asChild variant="outline"><Link href={`/retail/estimates/${ro.primary_estimate_id}`}><FileTextIcon /> Back to the main estimate</Link></Button>}
            </CardContent>
          </Card>
        )}
        {accepted && !supplement && ro && visit && !visit.deleted && (
          <>
            <RoWorkCard jobId={visit.jobId} work={visit.work} canComplete={visit.canComplete} canQc={visit.canQc} unauthorized={visit.unauthorized} invoiced={visit.invoiced} />
            {!visit.invoiced && <RoInvoiceCard jobId={visit.jobId} authorizations={visit.authorizations} unauthorized={visit.unauthorized} lineCount={visit.lineCount} invoiced={visit.invoiced} canConvert={visit.canPrice} showMoney={showMoney} review={visit.review} />}
            {visit.invoiced ? (
              <RetailPayment jobId={visit.jobId} payment={visit.payment} charge={visit.charge} canRecordByHand={visit.canPrice} open customerPhone={e.customer?.phone ?? null} />
            ) : (
              <p className="px-1 text-caption text-subtle" data-testid="payment-waits">Payment opens at the counter once the invoice is made.</p>
            )}
          </>
        )}
        {accepted && !supplement && !ro && (
          <Card data-testid="estimate-invoice">
            <CardHeader>
              <CardTitle>Invoice</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {canPrices ? (
                <>
                  <p className="text-sm text-muted-foreground">Approved, but the invoice could not be created (is a retail location set up in Settings → Dealerships?).</p>
                  <Button onClick={createInvoice} loading={applying} data-testid="create-invoice"><FileTextIcon /> Create the invoice</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Approved; the advisor creates the invoice.</p>
              )}
            </CardContent>
          </Card>
        )}
        <SignaturesCard e={e} visit={visit ?? null} supplements={supplements.filter((x) => x.kind === "supplement")} showMoney={showMoney} canAct={!!canPrices} supplement={supplement} documents={documents} onSignHere={() => setAccepting(true)} onSend={() => (e.status === "draft" ? document.getElementById("estimate-send")?.scrollIntoView({ behavior: "smooth", block: "start" }) : void copy())} />
        {isAdmin && accepted && !supplement && !(visit?.invoiced || visit?.work.completedAt) && (
          <Card>
            <CardHeader>
              <CardTitle>Next</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild data-testid="schedule-estimate">
                <Link href={`/retail/calendar?estimate=${e.id}`}><CalendarPlusIcon /> Schedule it</Link>
              </Button>
              <p className="text-caption text-subtle">Pick a time on the calendar; the estimate is already approved.</p>
            </CardContent>
          </Card>
        )}
        {isAdmin && activity && <ActivityCard entries={activity} />}
      </div>
    </div>
  );

  // The bar at the bottom: Edit, + Service on the left; Share and the one button that changes with the stage on the right.
  const toSend = () => document.getElementById("estimate-send")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const override: { action: NonNullable<JobAction>; onClick?: () => void } | undefined =
    visit && !supplement && accepted && !visit.deleted
      ? undefined
      : e.status === "draft"
        ? { action: { key: "send", label: supplement ? "Send the extra items" : "Send to customer", enabled: !!canPrices, hint: canPrices ? null : "The advisor sends it." }, onClick: toSend }
        : e.status === "sent" || e.status === "viewed"
          ? { action: { key: "startro", label: "Start RO", enabled: !!canPrices, hint: `Waiting on the customer · sent ${formatDateTime(e.sent_at)}${e.view_count ? ` · opened ${e.view_count}×` : " · not opened yet"}. Tap when they approve.` }, onClick: () => setAccepting(true) }
          : accepted && supplement && !e.applied_at
            ? { action: { key: "apply", label: "Add the approved items", enabled: !!canPrices, hint: null }, onClick: applyToRo }
            : accepted && !ro
              ? { action: { key: "makeinvoice", label: "Make the invoice", enabled: !!canPrices, hint: "Approved, but there is no invoice yet." }, onClick: createInvoice }
              : undefined;
  const hasBar = !!override || (!!visit && !supplement && accepted && !visit.deleted);
  const addServiceHref = open ? `/retail/estimates/${e.id}/edit` : ro ? `/retail/estimates/new?job=${ro.id}` : null;
  const bar = hasBar ? (
    <JobStageBar
      jobId={visit?.jobId}
      input={
        visit
          ? {
              completed: !!visit.work.completedAt,
              qc: !!visit.work.qcAt,
              invoiced: visit.invoiced,
              paid: !!visit.payment.paid_at,
              signed: !!visit.charge?.has_signature,
              signatureRequired: visit.charge?.signature_required ?? true,
              pickedUp: !!visit.charge?.picked_up_at,
              unauthorized: visit.unauthorized,
              canComplete: visit.canComplete,
              canQc: visit.canQc,
              canPrice: visit.canPrice,
            }
          : undefined
      }
      override={override}
      leading={
        canPrices && (
          <>
            {open && (
              <Button asChild variant="outline" size="sm" data-testid="bar-edit">
                <Link href={`/retail/estimates/${e.id}/edit`}><PencilIcon /> Edit Mode</Link>
              </Button>
            )}
            {addServiceHref && !supplement && (
              <Button asChild variant="outline" size="sm" data-testid="bar-add-service">
                <Link href={addServiceHref}><PlusIcon /> {open ? "Service" : "Extra work"}</Link>
              </Button>
            )}
          </>
        )
      }
      trailing={
        canPrices && url ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="bar-share"><Share2Icon /> Share</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {e.customer.phone ? (
                <DropdownMenuItem asChild>
                  <a href={smsHref(e.customer.phone, smsBody, platform) ?? "#"} data-testid="bar-share-text"><MessageSquareTextIcon /> Text the link</a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled><MessageSquareTextIcon /> Text (no phone on file)</DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={!e.customer.email} onSelect={() => send("email")} data-testid="bar-share-email"><MailIcon /> {e.customer.email ? "Email the link" : "Email (none on file)"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={copy} data-testid="bar-share-copy"><CopyIcon /> Copy the link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      }
    />
  ) : null;

  return (
    <Page>
      <Link href="/retail/estimates" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Estimates
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-title tracking-wide"><span className="font-medium text-muted-foreground" data-testid="estimate-kind">{num.kind} #</span><span data-testid="estimate-number">{num.primary}</span></h1>
            {num.secondary && <span className="text-sm text-muted-foreground" data-testid="estimate-number-secondary">({num.secondary})</span>}
            <EstimateStageBadge stage={stage} status={e.status} />
            {supplement && ro?.primary_estimate_id && (
              <Badge variant="info" asChild data-testid="estimate-ro">
                <Link href={`/retail/estimates/${ro.primary_estimate_id}`}>Extra work · main estimate</Link>
              </Badge>
            )}
            {e.applied_at && supplement && <Badge variant="success" data-testid="estimate-applied"><CheckIcon /> On the estimate</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground" data-testid="estimate-meta">
            <Badge variant="outline">{SIZE_LABEL[e.size_class]}</Badge>
            <span>Written {formatDate(e.created_at)}</span>
            {e.advisor && <span>Advisor <span className="font-medium text-foreground">{e.advisor}</span></span>}
            {invoiceDoc?.tech && <span>Tech <span className="font-medium text-foreground">{invoiceDoc.tech}</span></span>}
            {e.expires_at && open && <span>· good until {formatDate(e.expires_at)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canPrices && accepted && !!visit && !supplement && stage !== "closed" && stage !== "declined" && stage !== "expired" && (
            <SendToTechButton estimateId={e.id} size="default" variant="outline" text="Send to tech" label={num.primary} summary={`${customerName}${e.vehicle?.name ? ` · ${e.vehicle.name}` : ""}`} />
          )}
          {!supplement && stage !== "closed" && stage !== "declined" && stage !== "expired" && (
            <TransferButton estimateId={e.id} size="default" label={num.primary} summary={`${customerName}${e.vehicle?.name ? ` · ${e.vehicle.name}` : ""}`} />
          )}
          {canPrices && (
            <>
            {open && (
              <Button asChild variant="outline">
                <Link href={`/retail/estimates/${e.id}/edit`}>
                  <PencilIcon /> Edit Mode
                </Link>
              </Button>
            )}
            {showMoney && (
              <>
                <Button asChild variant="outline">
                  <a href={visit?.invoiced ? `/api/receipts/${visit.jobId}/pdf` : `/api/estimates/${e.id}/pdf`} data-testid="estimate-pdf">
                    <FileDownIcon /> {visit?.invoiced ? "Invoice PDF" : "PDF"}
                  </a>
                </Button>
                <PrintButton href={visit?.invoiced ? `/api/receipts/${visit.jobId}/pdf` : `/api/estimates/${e.id}/pdf`} label={visit?.invoiced ? "Print invoice" : "Print"} testId="estimate-print" />
              </>
            )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4"><EstimateMeta e={e} tech={invoiceDoc?.tech ?? null} /></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2" data-testid="estimate-parties">
        <Card>
          <CardContent className="grid gap-1 pt-5 text-sm">
            <div className="flex items-center gap-2 text-label text-subtle"><UserIcon className="size-4" /> Customer</div>
            <Link href={`/retail/customers/${e.customer.id}`} className="text-base font-semibold hover:text-primary" data-testid="estimate-customer">{customerName}</Link>
            {e.customer.phone && <a href={`tel:${e.customer.phone}`} className="text-muted-foreground hover:text-foreground">{formatPhone(e.customer.phone)}</a>}
            {e.customer.email && <span className="min-w-0 truncate text-muted-foreground">{e.customer.email}</span>}
            {!e.customer.phone && !e.customer.email && <span className="text-muted-foreground">No phone or email on file</span>}
            {(e.previous_visits !== null && e.previous_visits !== undefined) && <span className="mt-1 text-caption text-subtle" data-testid="customer-history">{e.previous_visits} previous {e.previous_visits === 1 ? "visit" : "visits"} · Source {SOURCE_LABEL[e.customer.source ?? ""] ?? "Walk-in"}{e.customer.best_contact ? ` · Best contact ${e.customer.best_contact}` : ""}</span>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 pt-5 text-sm" data-testid="estimate-car">
            <div className="flex items-center gap-2 text-label text-subtle"><CarIcon className="size-4" /> Vehicle</div>
            {e.vehicle ? (
              <>
                <span className="text-base font-semibold">{[e.vehicle.name, e.vehicle.trim].filter(Boolean).join(" ")}</span>
                {e.vehicle.vin && <span className="text-muted-foreground">VIN {e.vehicle.vin}</span>}
                {(e.vehicle.engine_size || e.vehicle.engine_code) && <span className="text-muted-foreground">Engine {e.vehicle.engine_size}{e.vehicle.engine_code ? ` (${e.vehicle.engine_code})` : ""}</span>}
                <span className="text-muted-foreground">{[e.vehicle.plate ? `Plate ${e.vehicle.plate}` : null, e.vehicle.color, e.fleet_number ? `Fleet ${e.fleet_number}` : null].filter(Boolean).join(" · ")}</span>
                <span className="text-muted-foreground">{[e.odometer ? `Odometer in ${e.odometer.toLocaleString()} mi` : null, e.job?.odometer_out ? `out ${e.job.odometer_out.toLocaleString()} mi` : null].filter(Boolean).join(" · ")}</span>
              </>
            ) : (
              <span className="text-muted-foreground">No car on file</span>
            )}
          </CardContent>
        </Card>
      </div>

      {e.customer_concern && (
        <blockquote className="mt-3 rounded-xl border border-border bg-card px-4 py-3 text-sm" data-testid="estimate-concern">
          <span className="text-label text-subtle">Customer&apos;s concern</span>
          <p className="mt-1 whitespace-pre-wrap">{e.customer_concern}</p>
        </blockquote>
      )}

      {(e.findings ?? []).some((f) => f.kind === "finding") && (
        <section className="mt-3 rounded-xl border border-border bg-card surface-raised" data-testid="estimate-recommendations">
          <h2 className="px-4 pt-3 text-sm font-semibold">Current recommendations</h2>
          <ul className="divide-y divide-border px-4 pb-1 text-sm">
            {(e.findings ?? []).filter((f) => f.kind === "finding").map((f) => {
              const st = ({ open: ["Recommended", "info"], quoted: ["Pending approval", "warning"], approved: ["Approved", "success"], declined: ["Declined", "muted"], done: ["Done", "success"] } as const)[f.status] ?? (["Recommended", "info"] as const);
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2"><span className={cn("inline-block size-2.5 shrink-0 rounded-full", f.severity === "urgent" ? "bg-destructive" : f.severity === "soon" ? "bg-warning" : "bg-success")} /><span className="truncate font-medium">{f.title}</span></span>
                  <Badge variant={st[1]} className="shrink-0">{st[0]}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <RoStageBar
        className="mt-4"
        roNumber={num.primary}
        hasJob={!!e.job_id}
        estimateStatus={e.status}
        invoicedAt={ro?.invoiced_at ?? (ro?.invoice_number ? ro.performed_at : null)}
        paidAt={ro?.paid_at ?? null}
        pickedUpAt={ro ? (ro.picked_up_at ?? null) : undefined}
        waitingOnApproval={e.status === "sent" || e.status === "viewed"}
      />

      {notes ? (
        <RoLayout stack initialTab="job" jobLabel="Estimate" count={findingsCount ?? 0} notes={notes}>
          {mainGrid}
        </RoLayout>
      ) : (
        <div className="mt-6">{mainGrid}</div>
      )}

      {bar}
      {canPrices && <MarkAcceptedDialog e={e} open={accepting} onOpenChange={setAccepting} />}
      <DeclineDialog open={declining} onOpenChange={setDeclining} onDecline={decline} pending={pending} />
    </Page>
  );
}

/** Staff record an approval given at the counter, on the phone or by email. */
function MarkAcceptedDialog({ e, open, onOpenChange }: { e: EstimateView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { demo, canPrices } = useSession();
  const [agree, setAgree] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [optionId, setOptionId] = useState(e.options.find((o) => o.recommended)?.id ?? e.options[0]?.id ?? "");
  const [lines, setLines] = useState<string[]>(e.addons.filter((a) => a.default_on).map((a) => a.id));
  const [name, setName] = useState(e.customer.display_name ?? "");
  const [method, setMethod] = useState<"in_person" | "phone" | "email">("in_person");
  const chosen = e.options.find((o) => o.id === optionId) ?? null;
  const canSubmit = !!optionId && (method !== "in_person" || (hasInk && agree && name.trim().length >= 2));
  function submit() {
    start(async () => {
      if (demo) {
        toast.success("Marked approved", { description: "Guest preview — nothing changed" });
        onOpenChange(false);
        return;
      }
      let signaturePath: string | null = null;
      if (method === "in_person") {
        const blob = await signatureBlob(padRef.current);
        if (!blob) return void toast.error("Could not read the signature");
        const fd = new FormData();
        fd.append("signature", blob, "signature.png");
        const res = await fetch(`/api/estimates/${e.id}/signature`, { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
        if (!res.ok || !body.path) return void toast.error(body.error ?? "Could not save the signature");
        signaturePath = body.path;
      }
      const r = await markEstimateAcceptedAction(e.id, optionId, lines, name, method, signaturePath);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Approved");
      onOpenChange(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark {e.display_number} approved</DialogTitle>
          <DialogDescription>For an approval you took in person, on the phone or by email. It is recorded under your name.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {canPrices && chosen && (
            <div className="rounded-lg border border-border px-3 py-2.5 text-sm" data-testid="accept-price">
              <div className="text-label text-subtle">What they are approving</div>
              <ul className="mt-1 grid gap-0.5">
                {chosen.lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{l.name}</span><span className="tabular-nums">{formatMoney(l.line_total ?? 0)}</span></li>
                ))}
                {e.addons.filter((a) => lines.includes(a.id)).map((a) => (
                  <li key={a.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{a.name}</span><span className="tabular-nums">{formatMoney(a.line_total ?? 0)}</span></li>
                ))}
              </ul>
              <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-semibold"><span>Total, plus tax</span><span className="tabular-nums" data-testid="accept-total">{formatMoney((chosen.total ?? 0) + e.addons.filter((a) => lines.includes(a.id)).reduce((n, a) => n + (a.line_total ?? 0), 0))}</span></div>
            </div>
          )}
          {e.options.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="acc-option">Option they chose</Label>
              <Select value={optionId} onValueChange={setOptionId}>
                <SelectTrigger id="acc-option"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {e.options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}{o.total !== null ? ` · ${formatMoney(o.total)}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {e.addons.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Add-ons they want</Label>
              {e.addons.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={lines.includes(a.id)} onCheckedChange={(v) => setLines((prev) => (v ? [...prev, a.id] : prev.filter((x) => x !== a.id)))} /> {a.name}{a.line_total !== null ? <span className="text-muted-foreground"> · {formatMoney(a.line_total)}</span> : null}
                </label>
              ))}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="acc-name">Who approved</Label>
            <Input id="acc-name" value={name} onChange={(ev) => setName(ev.target.value)} maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="acc-method">How</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger id="acc-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In person</SelectItem>
                <SelectItem value="phone">On the phone</SelectItem>
                <SelectItem value="email">By email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {method === "in_person" && (
            <>
              <label className="flex items-start gap-2 text-sm" data-testid="accept-consent">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
                <span>The customer agrees to sign electronically, and approves the work and the prices above.</span>
              </label>
              <div ref={padRef}>
                <SignaturePad onChange={setHasInk} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={pending} disabled={!canSubmit} data-testid="mark-accepted-confirm">Record the approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({ open, onOpenChange, onDecline, pending }: { open: boolean; onOpenChange: (o: boolean) => void; onDecline: (reason: string) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>They said no</DialogTitle>
          <DialogDescription>Optional: why. It stays on the estimate for next time.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Too much right now, going elsewhere, just looking…" className="min-h-20" maxLength={300} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => onDecline(reason)} loading={pending}>Mark declined</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
