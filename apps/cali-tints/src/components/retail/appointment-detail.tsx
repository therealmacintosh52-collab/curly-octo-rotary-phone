"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, BanknoteIcon, CalendarClockIcon, CheckIcon, CopyIcon, FileTextIcon, LinkIcon, LogInIcon, UndoIcon, UserXIcon, WrenchIcon, XIcon } from "lucide-react";
import { paymentMethodLower } from "@/lib/retail/payment-labels";
import { toast } from "sonner";
import type { AppointmentStatus, AppointmentView, RetailPaymentMethod, Slot } from "@/lib/db/types";
import { checkInAppointmentAction, depositLinkAction, findSlotsAction, recordDepositAtShopAction, refundPaymentAction, rescheduleAppointmentAction, setAppointmentStatusAction } from "@/app/(app)/retail/appointments/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/retail/phone";
import { SIZE_LABEL } from "@/lib/retail/size-class";
import { dayLabelIn, durationLabel, holdSecondsLeft, mmss, timeIn } from "@/lib/retail/slots";
import { Page } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AppointmentStatusBadge } from "./appointment-status-badge";
import { ContactButtons } from "./text-customer-button";
import { SlotPicker } from "./slot-picker";
import { SignaturePad, signatureBlob } from "./signature-pad";
import { demoSlots } from "./appointment-sheet";

const money = (n: number | null | undefined) => (n === null || n === undefined ? null : formatMoney(n));

/**
 * One appointment for the staff: who, which car, when, which bay/lift/tech,
 * the services (money for owner/admin), where it stands and what to do next:
 * confirm a lead, check the car in (that opens the job), finish, move it,
 * cancel, no-show. The manage link is what the customer got.
 */
export function AppointmentDetail({ a, showMoney, publicUrl, depositsOnline = false }: { a: AppointmentView; showMoney: boolean; publicUrl: string | null; depositsOnline?: boolean }) {
  const router = useRouter();
  const { isAdmin, canMoney, demo } = useSession();
  const [takingDeposit, setTakingDeposit] = useState(false);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [cancelling, setCancelling] = useState<"cancelled" | "no_show" | null>(null);
  const tz = a.company.timezone;
  const live = a.status === "lead" || a.status === "booked" || a.status === "confirmed";
  const held = a.status === "hold" ? holdSecondsLeft(a.hold_expires_at) : 0;

  function setStatus(status: AppointmentStatus, reason?: string) {
    start(async () => {
      if (demo) {
        toast.success("Updated", { description: "Guest preview — nothing changed" });
        setCancelling(null);
        return;
      }
      const r = await setAppointmentStatusAction(a.id, status, reason);
      if (!r.ok) return void toast.error(r.error);
      if (status === "in_progress" && r.data.job_id) {
        const jobId = r.data.job_id;
        toast.success("Checked in · the repair order is open", { action: { label: "Open the notes", onClick: () => router.push(`/jobs/${jobId}?tab=notes`) } });
      } else toast.success(status === "booked" ? "Confirmed" : "Updated");
      setCancelling(null);
      router.refresh();
    });
  }
  async function copy() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Page>
      <Link href="/retail/calendar" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Calendar
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-title">{dayLabelIn(a.starts_at, tz, true)}</h1>
            <AppointmentStatusBadge status={a.status} />
            {held > 0 && <Badge variant="outline">{mmss(held)} left</Badge>}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{timeIn(a.starts_at, tz)} – {timeIn(a.ends_at, tz)} <span className="text-sm font-normal text-muted-foreground">· {durationLabel(a.duration_minutes)}</span></div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="tracking-wide">{a.display_number}</span>
            {a.customer ? <Link href={`/retail/customers/${a.customer.id}`} className="font-medium text-foreground hover:text-primary" data-testid="appointment-customer">{a.customer.display_name ?? a.customer.first_name}</Link> : <span>Online customer</span>}
            {a.vehicle && <span>{[a.vehicle.name, a.vehicle.color].filter(Boolean).join(" · ")}</span>}
            <Badge variant="outline">{SIZE_LABEL[a.size_class]}</Badge>
            <span>· {a.source === "public" ? "booked online" : a.source === "estimate" ? "from an estimate" : "booked by staff"}</span>
          </div>
          {a.customer?.phone && (
            <div className="mt-2 flex items-center gap-2">
              <ContactButtons phone={a.customer.phone} name={a.customer.first_name} />
              <span className="text-caption text-subtle">{formatPhone(a.customer.phone)}</span>
            </div>
          )}
        </div>
        {isAdmin && (
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="appointment-actions">
            {a.status === "lead" && (
              <Button onClick={() => setStatus("booked")} loading={pending} data-testid="appointment-confirm">
                <CheckIcon /> Confirm
              </Button>
            )}
            {a.status === "booked" && (
              <Button variant="outline" onClick={() => setStatus("confirmed")} loading={pending}>
                <CheckIcon /> They confirmed
              </Button>
            )}
            {live && (
              <Button onClick={() => setCheckingIn(true)} data-testid="appointment-checkin">
                <LogInIcon /> Check in
              </Button>
            )}
            {a.status === "in_progress" && (
              <Button onClick={() => setStatus("done")} loading={pending}>
                <CheckIcon /> Done
              </Button>
            )}
            {(live || a.status === "hold") && (
              <Button variant="outline" onClick={() => setMoving(true)} data-testid="appointment-move">
                <CalendarClockIcon /> Move
              </Button>
            )}
            {live && (
              <Button variant="ghost" onClick={() => setCancelling("no_show")}>
                <UserXIcon /> No-show
              </Button>
            )}
            {(live || a.status === "hold") && (
              <Button variant="ghost" onClick={() => setCancelling("cancelled")} data-testid="appointment-cancel">
                <XIcon /> Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Work</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm" data-testid="appointment-services">
                {a.services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium">{s.name}{s.qty !== 1 ? ` × ${s.qty}` : ""}</div>
                      <div className="text-caption text-subtle">{durationLabel(s.duration_minutes)}{s.modifiers.length ? ` · ${s.modifiers.map((m) => m.label).join(", ")}` : ""}</div>
                    </div>
                    {showMoney && <span className="shrink-0 tabular-nums">{money(s.line_total)}</span>}
                  </li>
                ))}
              </ul>
              {showMoney && (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm" data-testid="appointment-money">
                  <span className="text-muted-foreground">Total{(a.deposit_required ?? 0) > 0 ? ` · deposit ${money(a.deposit_required)}` : ""}</span>
                  <span className="text-base font-semibold tabular-nums">{money(a.total)}</span>
                </div>
              )}
              {a.pay_choice && <p className="mt-2 text-caption text-subtle">They chose to {a.pay_choice === "deposit" ? "pay the deposit online" : "pay at the shop"}.</p>}
            </CardContent>
          </Card>

          {(a.deposit_required ?? 0) > 0 || a.deposit_paid_at || a.payments.length > 0 ? (
            <Card data-testid="appointment-deposit">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><BanknoteIcon className="size-4 text-primary" /> Deposit</CardTitle>
                {a.deposit_paid_at ? <Badge variant="success">Paid{showMoney && a.deposit_paid !== null ? ` · ${money(a.deposit_paid)}` : ""}</Badge> : live || a.status === "in_progress" ? <Badge variant="warning">Due{showMoney ? ` · ${money(a.deposit_required)}` : ""}</Badge> : null}
              </CardHeader>
              <CardContent className="grid gap-3">
                {a.payments.length > 0 && (
                  <ul className="divide-y divide-border text-sm" data-testid="appointment-payments">
                    {a.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <div className="font-medium">{p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Balance"} · {paymentMethodLower(p.method)}</div>
                          <div className="text-caption text-subtle">{p.status === "pending" ? "Link sent · not paid yet" : p.status === "failed" ? "Failed" : p.status === "cancelled" ? "Link expired" : p.paid_at ? formatDateTime(p.paid_at) : ""}{p.provider_ref ? ` · ${p.provider_ref}` : ""}{p.note ? ` · ${p.note}` : ""}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {showMoney && p.amount !== null && <span className="tabular-nums">{money(p.amount)}</span>}
                          {canMoney && p.kind !== "refund" && p.status === "paid" && (
                            <Button size="sm" variant="ghost" onClick={() => setRefunding(p.id)} aria-label="Record a refund"><UndoIcon /></Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {isAdmin && !a.deposit_paid_at && (live || a.status === "hold") && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setTakingDeposit(true)} data-testid="take-deposit"><BanknoteIcon /> Take the deposit</Button>
                    {depositsOnline && a.customer && (
                      <Button size="sm" variant="outline" onClick={() => start(async () => { if (demo) return void toast.success("Deposit link · guest preview"); const r = await depositLinkAction(a.id); if (!r.ok) return void toast.error(r.error); try { await navigator.clipboard.writeText(r.data.url); toast.success("Deposit link copied · text it to them"); } catch { toast(r.data.url); } })} loading={pending} data-testid="deposit-link"><LinkIcon /> Copy a pay link</Button>
                    )}
                  </div>
                )}
                {!a.deposit_paid_at && !depositsOnline && (live || a.status === "hold") && <p className="text-caption text-subtle">Online deposits are off; take it at drop-off (cash, check or on the Flex).</p>}
              </CardContent>
            </Card>
          ) : null}
          {(a.customer_notes || a.notes || Object.keys(a.intake ?? {}).length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {a.customer_notes && <div><div className="text-caption text-muted-foreground">From the customer</div><p className="whitespace-pre-wrap">{a.customer_notes}</p></div>}
                {a.notes && <div><div className="text-caption text-muted-foreground">Staff</div><p className="whitespace-pre-wrap">{a.notes}</p></div>}
                {Object.keys(a.intake ?? {}).length > 0 && (
                  <div>
                    <div className="text-caption text-muted-foreground">Their answers</div>
                    <ul>{Object.entries(a.intake).map(([k, v]) => <li key={k}>{k.replace(/_/g, " ")}: {String(v)}</li>)}</ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>In the shop</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex flex-wrap gap-1.5" data-testid="appointment-resources">
                {a.resources.map((r) => (
                  <Badge key={r.id} variant="outline">{r.name}</Badge>
                ))}
                {a.resources.length === 0 && <span className="text-muted-foreground">No bay assigned</span>}
              </div>
              {a.job_id && (
                <Button asChild variant="secondary">
                  <Link href={`/jobs/${a.job_id}`} data-testid="appointment-job"><WrenchIcon /> Open the job</Link>
                </Button>
              )}
              {a.estimate && (
                <Button asChild variant="outline">
                  <Link href={`/retail/estimates/${a.estimate.id}`}><FileTextIcon /> {a.estimate.display_number}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-caption text-subtle">
              <div>Created {formatDateTime(a.created_at)}</div>
              {a.confirmed_at && <div>Confirmed {formatDateTime(a.confirmed_at)}</div>}
              {a.checked_in_at && <div>Checked in {formatDateTime(a.checked_in_at)}</div>}
              {a.done_at && <div>Done {formatDateTime(a.done_at)}</div>}
              {a.cancelled_at && <div>{a.status === "no_show" ? "No-show" : "Cancelled"} {formatDateTime(a.cancelled_at)}{a.cancel_reason ? ` · ${a.cancel_reason}` : ""}</div>}
            </CardContent>
          </Card>
          {isAdmin && publicUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Their link</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <p className="text-caption text-subtle">The customer moves or cancels the appointment here, inside the policy.</p>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-caption">
                  <span className="min-w-0 truncate" data-testid="appointment-link">{publicUrl}</span>
                  <button type="button" onClick={copy} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground" aria-label="Copy link"><CopyIcon className="size-4" /></button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <MoveDialog a={a} open={moving} onOpenChange={setMoving} />
      {checkingIn && <CheckInDialog a={a} showMoney={showMoney} onClose={() => setCheckingIn(false)} />}
      {takingDeposit && <TakeDepositDialog a={a} onClose={() => setTakingDeposit(false)} />}
      {refunding && <RefundDialog paymentId={refunding} appointmentId={a.id} onClose={() => setRefunding(null)} />}
      <Dialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cancelling === "no_show" ? "Mark as a no-show" : "Cancel this appointment"}</DialogTitle>
            <DialogDescription>The bay, lift and tech are freed. {a.customer?.email ? "The customer gets a short email." : ""}</DialogDescription>
          </DialogHeader>
          <CancelForm onSubmit={(reason) => cancelling && setStatus(cancelling, reason)} pending={pending} destructive={cancelling === "cancelled"} />
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function CancelForm({ onSubmit, pending, destructive }: { onSubmit: (reason: string) => void; pending: boolean; destructive: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (optional)" className="min-h-16" maxLength={300} />
      <DialogFooter>
        <Button variant={destructive ? "destructive" : "default"} onClick={() => onSubmit(reason)} loading={pending} data-testid="appointment-cancel-confirm">
          {destructive ? "Cancel it" : "No-show"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Check-in (0052): confirm who and what, take the mileage in, write down the
 * customer's concern in their words, and get the initial authorization (their
 * name and signature, or a phone approval) before the car goes in the bay.
 * Opens the repair order.
 */
function CheckInDialog({ a, showMoney, onClose }: { a: AppointmentView; showMoney: boolean; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [miles, setMiles] = useState("");
  const [concern, setConcern] = useState(a.customer_notes ?? "");
  const [name, setName] = useState(a.customer?.display_name ?? "");
  const [limit, setLimit] = useState(showMoney && a.total ? String(a.total) : "");
  const [method, setMethod] = useState<"in_person" | "phone">("in_person");
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);

  function submit() {
    if (name.trim().length < 2) return void toast.error("Type the customer's name");
    if (method === "in_person" && !hasInk) return void toast.error("Ask them to sign in the box");
    start(async () => {
      if (demo) {
        toast.success("Checked in · the repair order is open", { description: "Guest preview — nothing changed" });
        onClose();
        return;
      }
      let signature_path: string | null = null;
      if (method === "in_person") {
        const blob = await signatureBlob(padRef.current);
        if (!blob) return void toast.error("Could not read the signature");
        const fd = new FormData();
        fd.append("signature", blob, "signature.png");
        const res = await fetch(`/api/appointments/${a.id}/checkin-signature`, { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
        if (!res.ok || !body.path) return void toast.error(body.error ?? "Could not save the signature");
        signature_path = body.path;
      }
      const r = await checkInAppointmentAction(a.id, { name, odometer: miles.replace(/[^\d]/g, "") || null, concern: concern.trim() || null, amount_limit: limit ? Number(limit) : null, method, signature_path });
      if (!r.ok) return void toast.error(r.error);
      const jobId = r.data.job_id;
      toast.success("Checked in · the repair order is open", jobId ? { action: { label: "Open the notes", onClick: () => router.push(`/jobs/${jobId}?tab=notes`) } } : undefined);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" data-testid="checkin-dialog">
        <DialogHeader>
          <DialogTitle>Check in {a.vehicle?.name ?? "the car"}</DialogTitle>
          <DialogDescription>
            {a.customer ? `${a.customer.display_name ?? a.customer.first_name} · ${a.customer.phone ? formatPhone(a.customer.phone) : "no phone on file"}` : "No customer yet"}
            {a.vehicle?.plate ? ` · plate ${a.vehicle.plate}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ci-miles">Mileage in</Label>
            <Input id="ci-miles" inputMode="numeric" value={miles} onChange={(e) => setMiles(e.target.value.replace(/[^\d,]/g, ""))} placeholder="84200" data-testid="checkin-miles" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ci-concern">What the customer says is wrong</Label>
            <Textarea id="ci-concern" value={concern} onChange={(e) => setConcern(e.target.value)} placeholder="In their own words" className="min-h-20" data-testid="checkin-concern" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ci-name">Authorized by</Label>
              <Input id="ci-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" data-testid="checkin-name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ci-how">How</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger id="ci-how" className="w-full" data-testid="checkin-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In person, signs here</SelectItem>
                  <SelectItem value="phone">By phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {showMoney && (
            <div className="grid gap-1.5">
              <Label htmlFor="ci-limit">Authorizes the diagnosis and booked work up to</Label>
              <Input id="ci-limit" type="number" inputMode="decimal" step="0.01" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} data-testid="checkin-limit" />
              <p className="text-caption text-subtle">Anything beyond this is a change order: you re-present it and get a new approval before the work.</p>
            </div>
          )}
          {method === "in_person" && (
            <div ref={padRef}>
              <SignaturePad onChange={setHasInk} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Not now</Button>
          <Button onClick={submit} loading={pending} data-testid="checkin-confirm"><LogInIcon /> Check in and open the RO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ a, open, onOpenChange }: { a: AppointmentView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [slot, setSlot] = useState<Slot | null>(null);
  const tz = a.company.timezone;
  const fetchSlots = useCallback(
    async (from: string, to: string) => {
      if (demo) return { ok: true as const, data: demoSlots(from, tz) };
      return findSlotsAction(a.services.filter((s) => s.service_id).map((s) => ({ service_id: s.service_id!, qty: s.qty, modifiers: s.modifiers.map((m) => m.code) })), from, to);
    },
    [a.services, demo, tz],
  );
  function submit() {
    if (!slot) return;
    start(async () => {
      if (demo) {
        toast.success("Moved", { description: "Guest preview — nothing changed" });
        onOpenChange(false);
        return;
      }
      const r = await rescheduleAppointmentAction(a.id, slot.starts_at);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Moved");
      onOpenChange(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move {a.display_number}</DialogTitle>
          <DialogDescription>Same services, a different time. Only free times are offered.</DialogDescription>
        </DialogHeader>
        {open && <SlotPicker tz={tz} fetchSlots={fetchSlots} value={slot} onChange={setSlot} />}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep it</Button>
          <Button onClick={submit} disabled={!slot} loading={pending} data-testid="appointment-move-confirm">Move it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The deposit taken at drop-off (cash, check, on the Flex), or a Clover payment the owner matches by its id. */
function TakeDepositDialog({ a, onClose }: { a: AppointmentView; onClose: () => void }) {
  const router = useRouter();
  const { demo, canMoney } = useSession();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<RetailPaymentMethod>("clover_flex");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(a.deposit_required !== null ? String(a.deposit_required) : "");
  function submit() {
    start(async () => {
      if (demo) {
        toast.success("Deposit recorded", { description: "Guest preview — nothing changed" });
        onClose();
        return;
      }
      const r = await recordDepositAtShopAction(a.id, method, reference, amount ? Number(amount) : null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.status === "booked" ? "Deposit recorded · booked" : "Deposit recorded");
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take the deposit</DialogTitle>
          <DialogDescription>Recorded on the ledger and applied to the bill at pickup. A lead becomes booked.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="dp-method">How</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as RetailPaymentMethod)}>
              <SelectTrigger id="dp-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clover_flex">Card on the Flex</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                {canMoney && <SelectItem value="clover_online">Paid online (match by Clover payment id)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {a.deposit_required !== null && (
            <div className="grid gap-1.5">
              <Label htmlFor="dp-amount">Amount</Label>
              <Input id="dp-amount" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="dp-ref">Reference (optional)</Label>
            <Input id="dp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check number, Clover payment id" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={pending} data-testid="take-deposit-confirm">Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ paymentId, appointmentId, onClose }: { paymentId: string; appointmentId: string; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a refund</DialogTitle>
          <DialogDescription>The money moves in Clover or the till; this writes it on the ledger.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="rf-amount">Amount</Label><Input id="rf-amount" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
          <div className="grid gap-1.5"><Label htmlFor="rf-note">Why</Label><Input id="rf-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!(Number(amount) > 0)} loading={pending} onClick={() => start(async () => { if (demo) { toast.success("Refund recorded · guest preview"); onClose(); return; } const r = await refundPaymentAction(paymentId, Number(amount), note, appointmentId); if (!r.ok) return void toast.error(r.error); toast.success("Refund recorded"); onClose(); router.refresh(); })}>Record the refund</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
