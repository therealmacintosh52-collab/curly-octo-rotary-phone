"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CameraIcon, CopyIcon, FileTextIcon, MailIcon, MessageSquareTextIcon, PlusIcon, SendIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { JobFinding } from "@/lib/db/types";
import { emailFindingAction, priceFindingAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { hasNativeFileCapture } from "@/lib/camera";
import { readClip, uploadFindingMedia, type ClipPick, type FindingSubject } from "@/lib/media/finding-upload";
import { formatMoney } from "@/lib/money";
import { emptyRow, rowsPayload, rowsTotals, type FindingPricing, type FindingRow } from "@/lib/retail/finding-quote";
import { detectPlatform, smsHref } from "@/lib/retail/phone";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { compressPhoto } from "./photo-picker";

const CameraCapture = dynamic(() => import("./camera-capture").then((m) => m.CameraCapture), { ssr: false });

/** What the share buttons need: the customer's link and how to reach them. */
export type ShareContext = { url: string; firstName: string; vehicle: string | null; phone: string | null; email: string | null };

const REC_TEXT = { replace: "we recommend replacing it", diagnose: "we recommend a diagnosis", monitor: "we recommend keeping an eye on it" } as const;

/**
 * The icon row under a finding: price it on the estimate (labor, parts, fees,
 * "plus tax"), add a photo from the camera, upload from the phone, share it
 * with the customer by text or email.
 */
export function FindingActions({ f, subject, canWrite, canQuote, pricing, share, large }: { large?: boolean; f: JobFinding; subject: FindingSubject; canWrite: boolean; canQuote: boolean; pricing?: FindingPricing | null; share?: ShareContext | null }) {
  const router = useRouter();
  const { demo, company } = useSession();
  const [quoting, setQuoting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMounted, setCameraMounted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "unknown">("unknown");
  const camRef = useRef<HTMLInputElement>(null);
  const upRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setPlatform(detectPlatform(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);

  const quotable = canQuote && !!pricing && f.kind === "finding" && f.status !== "done" && f.status !== "approved";
  const visible = f.customer_visible !== false;
  const canShare = canQuote && visible && !!share;

  async function send(files: File[]) {
    if (demo) return void toast.success(`${files.length === 1 ? "Added" : `${files.length} files added`} to “${f.title}”`, { description: "Guest preview — nothing changed" });
    setBusy("Uploading…");
    try {
      const photos: File[] = [];
      let clip: ClipPick | null = null;
      for (const file of files) {
        if (file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name)) {
          const r = await readClip(file);
          if ("error" in r) toast.error(r.error);
          else clip = r.clip;
        } else {
          photos.push(new File([await compressPhoto(file)], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        }
      }
      const problems = await uploadFindingMedia({ subject, companyId: company.id, findingId: f.id, photos, clip, onProgress: setBusy });
      for (const m of problems) toast.error(m);
      if (!problems.length) toast.success("Added to the finding");
      router.refresh();
    } catch {
      toast.error("Could not process that file");
    } finally {
      setBusy(null);
      if (camRef.current) camRef.current.value = "";
      if (upRef.current) upRef.current.value = "";
    }
  }

  function openCamera() {
    if (hasNativeFileCapture()) camRef.current?.click();
    else {
      setCameraMounted(true);
      setCameraOpen(true);
    }
  }

  const rec = f.recommendation ? REC_TEXT[f.recommendation] : null;
  const smsBody = share ? `Hi ${share.firstName || "there"}, about your ${share.vehicle ?? "car"}: ${f.title}${f.body ? ` (${f.body})` : ""}${rec ? ` — ${rec}` : ""}. Photos and details: ${share.url}` : "";
  const sms = share ? smsHref(share.phone, smsBody, platform) : null;
  const [pending, start] = useTransition();

  function email() {
    start(async () => {
      if (demo) return void toast.success("Email sent", { description: "Guest preview — nothing sent" });
      const r = await emailFindingAction(f.id);
      if (!r.ok) return void toast.error(r.error);
      if (r.data.emailed) toast.success("Emailed that finding");
      else toast.error(r.data.note ?? "The email could not be sent");
      router.refresh();
    });
  }
  async function copy() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy; long-press the link instead");
    }
  }

  if (!canWrite && !quotable && !canShare) return null;
  const icon = large ? "size-11" : "size-8";
  return (
    <div className="mt-2 flex items-center gap-1" data-testid="finding-actions" aria-label={`Actions for ${f.title}`}>
      {quotable && (
        <Button type="button" variant="ghost" size="icon" className={icon} onClick={() => setQuoting(true)} aria-label="Add to estimate" title="Add to estimate: labor, parts, fees" data-testid="finding-quote">
          <FileTextIcon />
        </Button>
      )}
      {canWrite && (
        <>
          <Button type="button" variant="ghost" size="icon" className={icon} onClick={openCamera} disabled={!!busy} aria-label="Take a photo" title="Take a photo" data-testid="finding-camera">
            <CameraIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={icon} onClick={() => upRef.current?.click()} disabled={!!busy} aria-label="Upload from the phone" title="Upload a photo or clip from the phone" data-testid="finding-upload">
            <UploadIcon />
          </Button>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Photo file" onChange={(e) => e.target.files?.length && void send(Array.from(e.target.files))} />
          <input ref={upRef} type="file" accept="image/*,video/*" multiple className="hidden" aria-label="Upload files" onChange={(e) => e.target.files?.length && void send(Array.from(e.target.files))} />
        </>
      )}
      {canShare && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className={icon} aria-label="Share with the customer" title="Share with the customer" data-testid="finding-share" disabled={pending}>
              <SendIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {sms ? (
              <DropdownMenuItem asChild>
                <a href={sms} data-testid="finding-share-text"><MessageSquareTextIcon /> Text it</a>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled><MessageSquareTextIcon /> Text it (no phone on file)</DropdownMenuItem>
            )}
            <DropdownMenuItem disabled={!share?.email} onSelect={email} data-testid="finding-share-email"><MailIcon /> {share?.email ? "Email it" : "Email it (no email on file)"}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copy()} data-testid="finding-share-copy"><CopyIcon /> Copy the link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {busy && <span className="ml-1 text-caption text-subtle" aria-live="polite">{busy}</span>}
      {cameraMounted && <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} title={`Photo for “${f.title}”`} onCapture={(blob) => void send([new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" })])} />}
      {quoting && pricing && <FindingQuoteSheet f={f} pricing={pricing} onClose={() => setQuoting(false)} />}
    </div>
  );
}

const TYPE_LABEL = { labor: "Labor", part: "Part", fee: "Fee" } as const;

/**
 * Price the fix right beside the finding: labor hours × the shop rate, parts,
 * fees. The running total says "plus tax" the way the customer will read it;
 * saving puts every line on one estimate (this one, or a draft on the RO).
 */
function FindingQuoteSheet({ f, pricing, onClose }: { f: JobFinding; pricing: FindingPricing; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [rows, setRows] = useState<FindingRow[]>(() => [emptyRow("labor", pricing, f.title), emptyRow("part", pricing)]);
  const [pending, start] = useTransition();
  const totals = rowsTotals(rows, pricing);
  const set = (i: number, patch: Partial<FindingRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function save() {
    if (totals.error) return void toast.error(totals.error);
    if (totals.lines === 0) return void toast.error("Add at least one line");
    start(async () => {
      if (demo) {
        toast.success("Added to the estimate", { description: `Guest preview — ${formatMoney(totals.subtotal)} plus tax` });
        onClose();
        return;
      }
      const r = await priceFindingAction(f.id, rowsPayload(rows));
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Added to ${r.data.display_number}: ${formatMoney(r.data.total)} with tax`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && !pending && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto" data-testid="finding-quote-sheet">
        <SheetHeader>
          <SheetTitle>Add to the estimate</SheetTitle>
          <SheetDescription>{f.title}. Labor, parts and fees all go on one estimate.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 pb-2">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-border bg-card/60 p-3" data-testid={`quote-row-${r.type}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-label text-subtle">{TYPE_LABEL[r.type]}</span>
                <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove this ${TYPE_LABEL[r.type].toLowerCase()} line`} className="rounded-full p-1 text-muted-foreground hover:text-foreground"><XIcon className="size-4" /></button>
              </div>
              <Input value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder={r.type === "labor" ? "What the service is" : r.type === "part" ? "Part name" : "Fee (disposal, supplies…)"} maxLength={120} aria-label={`${TYPE_LABEL[r.type]} name`} data-testid="quote-label" />
              {r.type === "labor" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1"><span className="text-caption text-subtle">Hours</span><Input inputMode="decimal" value={r.hours} onChange={(e) => set(i, { hours: e.target.value })} placeholder="Hours" aria-label="Hours" data-testid="quote-hours" /></label>
                  <label className="grid gap-1"><span className="text-caption text-subtle">Rate per hour</span><Input inputMode="decimal" value={r.rate} onChange={(e) => set(i, { rate: e.target.value })} placeholder="Rate per hour" aria-label="Rate per hour" data-testid="quote-rate" /></label>
                </div>
              )}
              {r.type === "part" && (
                <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-2">
                  <label className="grid gap-1"><span className="text-caption text-subtle">Qty</span><Input inputMode="decimal" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} placeholder="Qty" aria-label="Quantity" data-testid="quote-qty" /></label>
                  <label className="grid gap-1"><span className="text-caption text-subtle">Price each</span><Input inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} placeholder="Price each" aria-label="Price each" data-testid="quote-price" /></label>
                  <label className="grid gap-1"><span className="text-caption text-subtle">Part #</span><Input value={r.part_number} onChange={(e) => set(i, { part_number: e.target.value })} placeholder="Part #" aria-label="Part number" maxLength={60} /></label>
                </div>
              )}
              {r.type === "fee" && <Input inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} placeholder="Amount" aria-label="Amount" data-testid="quote-price" />}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {(["labor", "part", "fee"] as const).map((t) => (
              <Button key={t} type="button" size="sm" variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow(t, pricing)])} data-testid={`quote-add-${t}`}><PlusIcon /> {TYPE_LABEL[t]}</Button>
            ))}
          </div>
          <dl className="grid gap-1 rounded-xl bg-muted/50 px-3 py-2 text-sm" data-testid="quote-totals">
            <div className="flex justify-between"><dt className="text-muted-foreground">These lines</dt><dd className="tabular-nums" data-testid="quote-subtotal">{formatMoney(totals.subtotal)}</dd></div>
            {totals.shop_supplies > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Shop supplies</dt><dd className="tabular-nums">{formatMoney(totals.shop_supplies)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({(pricing.taxRate * 100).toFixed(2).replace(/\.?0+$/, "")} %)</dt><dd className="tabular-nums" data-testid="quote-tax">{formatMoney(totals.tax)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Total, plus tax</dt><dd className="tabular-nums" data-testid="quote-total">{formatMoney(totals.total)}</dd></div>
          </dl>
          {totals.error && <p className="text-caption text-warning" role="alert">{totals.error}</p>}
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={save} loading={pending} data-testid="quote-save">Add to the estimate</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
