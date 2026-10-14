"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, ClipboardCheckIcon, EllipsisVerticalIcon, FileTextIcon, FilmIcon, PlayIcon, PlusIcon, StickyNoteIcon, VideoIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { FindingRecommendation, FindingSeverity, FindingStatus, JobEstimate, JobFinding } from "@/lib/db/types";
import { addFindingAction, deleteFindingAction, updateFindingAction, type FindingRef } from "@/app/(app)/jobs/actions";
import { convertEstimateAction } from "@/app/(app)/retail/estimates/actions";
import { formatMoney } from "@/lib/money";
import { EstimateStatusBadge } from "@/components/retail/estimate-status-badge";
import { useSession } from "@/components/app/session-provider";
import { formatDate, formatDateTime } from "@/lib/dates";
import { MAX_VIDEO_SECONDS, formatClipLength, isVideoMime } from "@/lib/media/kind";
import { readClip, uploadFindingMedia } from "@/lib/media/finding-upload";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker, type PendingPhoto } from "./photo-picker";
import { FindingActions, type ShareContext } from "./finding-actions";
import type { FindingPricing } from "@/lib/retail/finding-quote";

export interface RoNotesProps {
  /** The panel belongs to a repair order (the job page, the invoice) or to an estimate that is not approved yet. */
  jobId?: string;
  estimateId?: string;
  roNumber: string | null;
  /** Estimate panel: the estimate is still open (a recommendation can be added to it). */
  estimateOpen?: boolean;
  /** Rendered at the top of the panel: "Send findings" and when they last went out. */
  extra?: React.ReactNode;
  /** Everything on this RO's notes tab, oldest first. */
  findings: JobFinding[];
  /** Findings on the same car from earlier visits that were never done. */
  fromLastTime: JobFinding[];
  /** The retail menu, for "suggest a service". */
  services: { id: string; name: string }[];
  /** Admins and the job's detailer while the job is open. */
  canWrite: boolean;
  /** Owner and admin remove anything; others only what they wrote. */
  canDeleteAny: boolean;
  userId: string;
  /** The estimates written on this RO (0044) and whether this user prices (builds and applies them). */
  estimates?: JobEstimate[];
  canQuote?: boolean;
  jobOpen?: boolean;
  /** The shop's labor rate, tax and supplies, so a finding can be priced on the spot (0053). */
  pricing?: FindingPricing | null;
  /** The customer's link and contact, for sharing one finding by text or email. */
  share?: ShareContext | null;
  /** What the estimate adds up to so far (staff with prices): "$X plus tax". */
  estimateSoFar?: { display_number: string; subtotal: number; tax: number; total: number } | null;
  /** The findings block at the top of the estimate: wider cards in two columns, bigger photos, bigger text and buttons. */
  large?: boolean;
  /** The block sits in a narrow right-hand column: one finding per row. */
  side?: boolean;
}

const SEVERITY_LABEL: Record<FindingSeverity, string> = { ok: "Looks fine", soon: "Soon", urgent: "Urgent" };
const REC_LABEL: Record<FindingRecommendation, string> = { replace: "RECOMMEND REPLACE", diagnose: "RECOMMEND DIAG", monitor: "RECOMMEND MONITOR" };
const STATUS_BADGE: Record<FindingStatus, { label: string; variant: "muted" | "info" | "success" | "warning" | "destructive" } | null> = {
  open: null,
  quoted: { label: "On an estimate", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  declined: { label: "Declined", variant: "muted" },
  done: { label: "Done", variant: "success" },
};

/**
 * The repair order's notes tab: what the tech saw (notes, findings with a
 * severity, photos and clips) in one feed, what was found last time and never
 * done, and the sheet to add a finding. The advisor builds the estimate from
 * here (next slice).
 */
export function RoNotes(p: RoNotesProps) {
  const router = useRouter();
  const { demo } = useSession();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<JobFinding["media"][number] | null>(null);
  const [pending, start] = useTransition();
  const urgent = p.findings.filter((f) => f.kind === "finding" && f.severity === "urgent" && f.status === "open").length;
  const quotable = p.findings.filter((f) => f.kind === "finding" && (f.status === "open" || f.status === "declined")).map((f) => f.id);
  const estimates = p.estimates ?? [];
  const ref: FindingRef = p.jobId ?? { estimateId: p.estimateId! };
  function applyEstimate(e: JobEstimate) {
    start(async () => {
      if (demo) return void toast.success(`Approved items added to the estimate`, { description: "Guest preview — nothing changed" });
      const r = await convertEstimateAction(e.id, {});
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Approved items added to the estimate`);
      router.refresh();
    });
  }

  function setStatus(f: JobFinding, status: "open" | "declined" | "done") {
    start(async () => {
      if (demo) return void toast.success("Updated", { description: "Guest preview — nothing changed" });
      const r = await updateFindingAction(f.id, ref, { status });
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  }
  function setVisible(f: JobFinding, visible: boolean) {
    start(async () => {
      if (demo) return void toast.success(visible ? "Now shown to the customer" : "Now internal only", { description: "Guest preview — nothing changed" });
      const r = await updateFindingAction(f.id, ref, { customer_visible: visible });
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });
  }
  function remove(f: JobFinding) {
    start(async () => {
      if (demo) return void toast.success("Removed", { description: "Guest preview — nothing changed" });
      const r = await deleteFindingAction(f.id, ref);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Removed");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {p.extra}
      {p.fromLastTime.length > 0 && (
        <Card data-testid="ro-from-last-time">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlertIcon className="size-4 text-warning" /> From last time <Badge variant="warning">{p.fromLastTime.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {p.fromLastTime.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SeverityDot severity={f.severity} />
                      <span className="font-medium">{f.title}</span>
                    </div>
                    <div className="text-caption text-subtle">
                      {f.job_id ? <Link href={`/jobs/${f.job_id}`} className="hover:text-primary">Earlier visit</Link> : "Earlier visit"} · {formatDate(f.job_performed_at)}
                      {f.recommended_service ? ` · ${f.recommended_service}` : ""}
                    </div>
                  </div>
                  {STATUS_BADGE[f.status] ? <Badge variant={STATUS_BADGE[f.status]!.variant}>{STATUS_BADGE[f.status]!.label}</Badge> : <Badge variant="warning">Still open</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          {p.estimateSoFar && (
            <p className="mb-1 text-sm" data-testid="estimate-so-far">
              <span className="text-muted-foreground">Estimate so far ({p.estimateSoFar.display_number}): </span>
              <span className="font-semibold tabular-nums">{formatMoney(p.estimateSoFar.subtotal)}</span>
              <span className="text-muted-foreground"> plus tax {formatMoney(p.estimateSoFar.tax)} = </span>
              <span className="font-semibold tabular-nums">{formatMoney(p.estimateSoFar.total)}</span>
            </p>
          )}
          <CardTitle className="flex items-center gap-2">
            <StickyNoteIcon className="size-4 text-primary" /> Notes {p.findings.length > 0 && <Badge variant="muted">{p.findings.length}</Badge>}
            {urgent > 0 && <Badge variant="destructive">{urgent} urgent</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {p.findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet. What the tech sees goes here: a note, or a finding with a photo or a clip; the advisor quotes from it.</p>
          ) : (
            <ol className={cn("gap-3", p.large && !p.side ? "grid md:grid-cols-2" : "flex flex-col")} data-testid="ro-findings">
              {p.findings.map((f) => (
                <li key={f.id} className={cn("rounded-xl border border-border bg-card/60", p.large ? "p-4" : "p-3")} data-testid={`finding-${f.kind}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {f.kind === "finding" ? <SeverityDot severity={f.severity} /> : <StickyNoteIcon className="size-3.5 text-muted-foreground" />}
                        <span className={cn("font-medium", p.large && "text-base")}>{f.title}</span>
                        {f.kind === "finding" && <span className="text-caption text-subtle">{SEVERITY_LABEL[f.severity]}</span>}
                        {STATUS_BADGE[f.status] && <Badge variant={STATUS_BADGE[f.status]!.variant}>{STATUS_BADGE[f.status]!.label}</Badge>}
                        {f.customer_visible === false && <Badge variant="outline" title="The customer does not see this">Internal</Badge>}
                      </div>
                      {f.body && <p className={cn("mt-1 whitespace-pre-wrap text-muted-foreground", p.large ? "text-base" : "text-sm")}>{f.body}</p>}
                      {f.media.length > 0 && <p className="mt-1 text-caption text-subtle" data-testid="finding-counts">{mediaCounts(f)}</p>}
                      {f.kind === "finding" && f.recommendation && <p className="mt-1" data-testid="finding-recommendation"><Badge variant={f.recommendation === "replace" ? "destructive" : f.recommendation === "diagnose" ? "warning" : "muted"}>{REC_LABEL[f.recommendation]}</Badge></p>}
                      {f.recommended_service && (
                        <p className="mt-1 text-caption text-subtle">
                          Recommends: {f.recommended_service}
                          {p.estimateId && p.canQuote && p.estimateOpen && f.kind === "finding" && f.status === "open" && (
                            <> · <Link href={`/retail/estimates/${p.estimateId}/edit?findings=${f.id}`} className="font-medium text-primary hover:underline" data-testid="finding-add-to-estimate">Add to this estimate</Link></>
                          )}
                        </p>
                      )}
                    </div>
                    {p.canWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`More for ${f.title}`} disabled={pending} className="-mr-1 -mt-1 size-8">
                            <EllipsisVerticalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setVisible(f, f.customer_visible === false)}>{f.customer_visible === false ? "Show to the customer" : "Internal only"}</DropdownMenuItem>
                          {f.status !== "done" && <DropdownMenuItem onSelect={() => setStatus(f, "done")}>Mark done</DropdownMenuItem>}
                          {f.kind === "finding" && f.status === "open" && <DropdownMenuItem onSelect={() => setStatus(f, "declined")}>Customer declined</DropdownMenuItem>}
                          {(f.status === "done" || f.status === "declined") && <DropdownMenuItem onSelect={() => setStatus(f, "open")}>Reopen</DropdownMenuItem>}
                          {(p.canDeleteAny || f.created_by === p.userId) && ["open", "declined", "done"].includes(f.status) && (
                            <DropdownMenuItem variant="destructive" onSelect={() => remove(f)}>
                              Remove
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {f.media.length > 0 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto" data-testid="finding-media">
                      {f.media.map((m) => (
                        <button key={m.id} type="button" onClick={() => setOpen(m)} aria-label={isVideoMime(m.mime) || m.kind === "video" ? "Play the clip" : "Open the photo"} className={cn("relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted", p.large ? "size-32 sm:size-36" : "size-20")}>
                          {isVideoMime(m.mime) || m.kind === "video" ? (
                            <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                              <PlayIcon className="size-5" />
                              <span className="text-caption">{formatClipLength(m.duration_s) || "Clip"}</span>
                            </span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            m.url && <img src={m.url} alt="" className="size-full object-cover" loading="lazy" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <FindingActions f={f} subject={f.job_id ? { jobId: f.job_id } : { estimateId: f.estimate_id ?? p.estimateId! }} canWrite={p.canWrite && ["open", "quoted", "declined"].includes(f.status)} canQuote={!!p.canQuote} pricing={p.pricing} share={p.share} large={p.large} />
                  <div className="mt-2 text-caption text-subtle">{formatDateTime(f.created_at)}</div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {p.canWrite && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} data-testid="finding-add">
                <PlusIcon /> Add a finding
              </Button>
            )}
            {p.canQuote && p.jobId && p.jobOpen !== false && quotable.length > 0 && (
              <Button asChild size="sm" data-testid="build-estimate">
                <Link href={`/retail/estimates/new?job=${p.jobId}&findings=${quotable.join(",")}`}><FileTextIcon /> Build the estimate ({quotable.length})</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {estimates.length > 0 && (
        <Card data-testid="ro-estimates">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileTextIcon className="size-4 text-primary" /> Estimates on this visit <Badge variant="muted">{estimates.length}</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {estimates.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/retail/estimates/${e.id}`} className="font-medium hover:text-primary">{e.display_number}</Link>
                    <span className="ml-2 text-caption text-subtle">{e.lines} {e.lines === 1 ? "item" : "items"}{e.total !== null ? ` · ${formatMoney(e.total)}` : ""}{e.applied_at ? " · on the invoice" : e.status === "accepted" ? " · approved, not added yet" : e.status === "sent" || e.status === "viewed" ? " · waiting on the customer" : ""}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <EstimateStatusBadge status={e.status} />
                    {p.canQuote && e.status === "accepted" && !e.applied_at && (
                      <Button size="sm" onClick={() => applyEstimate(e)} disabled={pending} data-testid="apply-estimate"><ClipboardCheckIcon /> Add to the estimate</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Media</DialogTitle>
          {open && (isVideoMime(open.mime) || open.kind === "video") ? (
            open.url ? (
              <video src={open.url} controls playsInline className="max-h-[80vh] w-full rounded-lg bg-black" data-testid="lightbox-video" />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground" data-testid="lightbox-video">
                <FilmIcon className="size-6" /> The clip is not available in the preview.
              </div>
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            open?.url && <img src={open.url} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {adding && <AddFindingSheet subject={p.jobId ? { jobId: p.jobId } : { estimateId: p.estimateId! }} services={p.services} onClose={() => setAdding(false)} />}
    </div>
  );
}

function SeverityDot({ severity }: { severity: FindingSeverity }) {
  return <span aria-label={SEVERITY_LABEL[severity]} className={cn("inline-block size-2.5 shrink-0 rounded-full", severity === "urgent" ? "bg-destructive" : severity === "soon" ? "bg-warning" : "bg-success")} />;
}

/** "2 photos · 1 video" for a finding's media. */
function mediaCounts(f: JobFinding): string {
  const videos = f.media.filter((m) => isVideoMime(m.mime) || m.kind === "video").length;
  const photos = f.media.length - videos;
  return [photos ? `${photos} ${photos === 1 ? "photo" : "photos"}` : null, videos ? `${videos} ${videos === 1 ? "video" : "videos"}` : null].filter(Boolean).join(" · ");
}

function AddFindingSheet({ subject, services, onClose }: { subject: { jobId: string } | { estimateId: string }; services: { id: string; name: string }[]; onClose: () => void }) {
  const jobId = "jobId" in subject ? subject.jobId : null;
  const estimateId = "estimateId" in subject ? subject.estimateId : null;
  const router = useRouter();
  const { demo, company } = useSession();
  const [kind, setKind] = useState<"finding" | "note">("finding");
  const [severity, setSeverity] = useState<FindingSeverity>("soon");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [service, setService] = useState("none");
  const [recommendation, setRecommendation] = useState<"none" | FindingRecommendation>("none");
  const [internal, setInternal] = useState(false);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [clip, setClip] = useState<{ file: File; mime: string; duration: number | null } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLInputElement>(null);

  async function pickClip(files: FileList | null) {
    const file = files?.[0];
    if (videoRef.current) videoRef.current.value = "";
    if (!file) return;
    const r = await readClip(file);
    if ("error" in r) return void toast.error(r.error);
    setClip(r.clip);
  }

  async function save() {
    if (!title.trim()) return void toast.error("Give it a title");
    setBusy(true);
    try {
      if (demo) {
        toast.success(kind === "note" ? "Note added" : "Finding added", { description: "Guest preview — nothing changed" });
        onClose();
        return;
      }
      const r = await addFindingAction({ ...(jobId ? { job_id: jobId } : { estimate_id: estimateId! }), customer_visible: !internal, kind, severity, title, body: body || null, recommended_service_id: service === "none" ? null : service, recommendation: kind === "finding" && recommendation !== "none" ? recommendation : null });
      if (!r.ok) return void toast.error(r.error);
      const findingId = r.data.id;
      const problems = await uploadFindingMedia({ subject, companyId: company.id, findingId, photos: photos.map((ph) => new File([ph.blob], ph.name || "photo.jpg", { type: "image/jpeg" })), clip, onProgress: setProgress });
      for (const msg of problems) toast.error(msg);
      toast.success(kind === "note" ? "Note added" : "Finding added");
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent side="bottom" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{kind === "note" ? "Add a note" : "Add a finding"}</SheetTitle>
          <SheetDescription>What you saw on the car, with photos or a short clip. A finding carries a severity and can recommend a service; the customer sees it with the quote.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 pb-2">
          <Segmented size="sm" aria-label="Note or finding" value={kind} onValueChange={(v) => setKind(v as "finding" | "note")} items={[{ value: "finding", label: "Finding" }, { value: "note", label: "Note" }]} />
          {kind === "finding" && (
            <div className="grid gap-1.5">
              <Label>How urgent</Label>
              <Segmented size="sm" aria-label="Severity" value={severity} onValueChange={(v) => setSeverity(v as FindingSeverity)} items={[
                { value: "ok", label: <span className="flex items-center gap-1.5"><SeverityDot severity="ok" /> Fine</span> },
                { value: "soon", label: <span className="flex items-center gap-1.5"><SeverityDot severity="soon" /> Soon</span> },
                { value: "urgent", label: <span className="flex items-center gap-1.5"><SeverityDot severity="urgent" /> Urgent</span> },
              ]} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="f-title">{kind === "note" ? "Note" : "What you found"}</Label>
            <Input id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={kind === "note" ? "Customer waits in the lobby" : "Rear pads at 2 mm"} autoFocus data-testid="finding-title" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-body">Details</Label>
            <Textarea id="f-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3} placeholder="Where, how bad, what it needs" />
          </div>
          {kind === "finding" && (
            <div className="grid gap-1.5">
              <Label>What we recommend</Label>
              <Segmented size="sm" aria-label="Recommendation" value={recommendation} onValueChange={(v) => setRecommendation(v as typeof recommendation)} items={[
                { value: "none", label: "Not sure" },
                { value: "replace", label: "Replace" },
                { value: "diagnose", label: "Diagnose" },
                { value: "monitor", label: "Monitor" },
              ]} />
            </div>
          )}
          {kind === "finding" && services.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="f-service">Suggest a service</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger id="f-service"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not sure yet</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Photos</Label>
            <PhotoPicker photos={photos} onChange={setPhotos} disabled={busy} kind="finding" max={6} />
          </div>
          <div className="grid gap-1.5">
            <Label>A short clip</Label>
            {clip ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm" data-testid="finding-clip">
                <span className="flex min-w-0 items-center gap-2"><FilmIcon className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{clip.file.name}</span><span className="shrink-0 text-caption text-subtle">{formatClipLength(clip.duration) || `${Math.round(clip.file.size / 1048576)} MB`}</span></span>
                <button type="button" onClick={() => setClip(null)} aria-label="Remove the clip" className="rounded-full p-1 text-muted-foreground hover:text-foreground"><XIcon className="size-4" /></button>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => videoRef.current?.click()} data-testid="finding-video" className="flex h-14 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60">
                <VideoIcon className="size-4" /> Record a clip (up to {MAX_VIDEO_SECONDS} s)
              </button>
            )}
            <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" aria-label="Video file" onChange={(e) => void pickClip(e.target.files)} />
          </div>
          <label className="flex items-start gap-2 text-sm" data-testid="finding-internal">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
            <span>
              Internal only
              <span className="block text-caption text-subtle">Everything else here is shown to the customer in the text or email.</span>
            </span>
          </label>
          {progress && <p className="text-caption text-subtle" aria-live="polite">{progress}</p>}
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void save()} loading={busy} data-testid="finding-save">Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * On a phone the RO is two tabs, Job and Notes; from 1280 px the notes sit
 * beside the job. The same children render either way.
 */
export function RoLayout({ initialTab = "job", count, notes, children, jobLabel = "Job", stack = false }: { initialTab?: "job" | "notes"; count: number; notes: React.ReactNode; children: React.ReactNode; /** The first tab's name on a phone: Job, Estimate, Invoice. */ jobLabel?: string; /** No tabs: the findings are one big block on top on a phone and a wide column beside the page on a wide screen. */ stack?: boolean }) {
  const [tab, setTab] = useState<"job" | "notes">(initialTab);
  if (stack) {
    return (
      <div className="mt-5 flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start">
        <div className="order-2 min-w-0 xl:order-1">{children}</div>
        <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto" data-testid="ro-notes">{notes}</div>
      </div>
    );
  }
  return (
    <>
      <div className="mt-5 xl:hidden">
        <Segmented
          aria-label="Estimate or notes"
          value={tab}
          onValueChange={(v) => setTab(v as "job" | "notes")}
          items={[
            { value: "job", label: jobLabel },
            { value: "notes", label: <span className="flex items-center gap-1.5">Notes {count > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">{count}</span>}</span> },
          ]}
        />
      </div>
      <div className="mt-5 xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start xl:gap-4">
        <div className={cn("min-w-0", tab !== "job" && "hidden xl:block")}>{children}</div>
        <div className={cn("min-w-0", tab !== "notes" && "hidden xl:block")} data-testid="ro-notes">{notes}</div>
      </div>
    </>
  );
}
