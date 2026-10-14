"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, CircleDashedIcon, CopyIcon, MessageSquareTextIcon, PenLineIcon, SendIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";
import type { EstimateView, JobEstimate, RoAuthorization } from "@/lib/db/types";
import { estimateLinkAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { RO_EVENTS } from "@/components/jobs/retail-payment";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { detectPlatform, smsHref } from "@/lib/retail/phone";
import type { VisitPanel } from "@/lib/retail/visit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const HOW: Record<string, string> = { online: "on their phone", in_person: "in person", phone: "by phone", email: "by email" };

/** The signature image, for staff only (the file sits in a private bucket and is streamed by a staff-only route). */
function SigImage({ kind, id, name }: { kind: "estimate" | "job" | "pickup"; id: string; name: string }) {
  const { demo, isAdmin } = useSession();
  if (!isAdmin) return null;
  const src = demo ? "/demo/signature.svg" : `/api/signatures/${kind}/${id}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Signature of ${name}`} className="mt-2 h-16 w-48 rounded-md bg-white object-contain p-1" data-testid="signature-image" />;
}

function Row({ done, declined, title, children, actions, testId }: { done: boolean; declined?: boolean; title: string; children?: React.ReactNode; actions?: React.ReactNode; testId: string }) {
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0" data-testid={testId} data-state={declined ? "declined" : done ? "signed" : "open"}>
      <span className="mt-0.5 shrink-0">
        {declined ? <XCircleIcon className="size-5 text-muted-foreground" /> : done ? <CheckCircle2Icon className="size-5 text-success" /> : <CircleDashedIcon className="size-5 text-warning" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">{title}</h3>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

/**
 * Every signature on the visit, in the order they are taken (0059): the
 * approval before work (with the price on screen), extra work found later
 * (texted to the customer to approve or decline), and the signature at pickup
 * after payment. Each shows who signed, how, when and the image (staff only).
 */
export function SignaturesCard({ e, visit, supplements, showMoney, canAct, onSignHere, onSend, supplement }: { e: EstimateView; visit: VisitPanel | null; supplements: JobEstimate[]; showMoney: boolean; canAct: boolean; onSignHere: () => void; onSend: () => void; supplement: boolean }) {
  const { demo } = useSession();
  const [platform, setPlatform] = useState<"ios" | "android" | "unknown">("unknown");
  useEffect(() => {
    const t = setTimeout(() => setPlatform(detectPlatform(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);
  const money = (n: number | null | undefined) => (showMoney && n !== null && n !== undefined ? formatMoney(n) : null);
  const auth = e.authorizations[0] ?? null;
  const open = e.status === "draft" || e.status === "sent" || e.status === "viewed";
  const checkin: RoAuthorization[] = (visit?.authorizations ?? []).filter((a) => a.kind === "initial");
  const changeOrders: RoAuthorization[] = (visit?.authorizations ?? []).filter((a) => a.kind === "change_order");
  const charge = visit?.charge ?? null;

  async function link(s: JobEstimate, how: "copy" | "text") {
    if (demo) {
      if (how === "copy") toast.success("Link copied", { description: "Guest preview — nothing was sent" });
      return;
    }
    const r = await estimateLinkAction(s.id);
    if (!r.ok) return void toast.error(r.error);
    if (how === "copy") {
      try {
        await navigator.clipboard.writeText(r.data);
        toast.success("Link copied");
      } catch {
        toast.error("Could not copy; long-press the link instead");
      }
    } else {
      const body = `Hi ${e.customer.first_name || "there"}, more work came up on your ${e.vehicle?.name ?? "car"}: ${money(s.total) ? `${money(s.total)} plus tax. ` : ""}See it and approve or decline here: ${r.data}`;
      window.location.assign(smsHref(e.customer.phone, body, platform) ?? "#");
    }
  }

  return (
    <Card id="signatures" className="scroll-mt-24" data-testid="signatures-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PenLineIcon className="size-4 text-primary" /> Signatures</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="divide-y divide-border">
          {checkin.map((a) => (
            <Row key={a.id} done title="Check-in authorization" testId="sig-checkin">
              <div>{a.name} · {HOW[a.method]} · {formatDateTime(a.authorized_at)}{money(a.amount) ? ` · diagnosis up to ${money(a.amount)}` : ""}</div>
              {a.has_signature && <SigImage kind="job" id={a.id} name={a.name} />}
            </Row>
          ))}

          <Row
            done={!!auth}
            declined={e.status === "declined"}
            title={supplement ? "Approval of the extra work" : "Approval before work"}
            testId="sig-approval"
            actions={
              canAct && open ? (
                <>
                  <Button size="sm" onClick={onSignHere} data-testid="sig-sign-here"><PenLineIcon /> Sign here</Button>
                  <Button size="sm" variant="outline" onClick={onSend} data-testid="sig-send-link"><SendIcon /> Send to sign on their phone</Button>
                </>
              ) : null
            }
          >
            {auth ? (
              <>
                <div>{auth.name} · signed {HOW[auth.method]} · {formatDateTime(auth.authorized_at)}{money(auth.total) ? ` · approved ${money(auth.total)}` : ""}</div>
                {auth.signature_path && <div className="text-caption text-subtle">Agreed to sign electronically.</div>}
                {auth.signature_path && <SigImage kind="estimate" id={auth.id} name={auth.name} />}
              </>
            ) : e.status === "declined" ? (
              <div>The customer declined {formatDateTime(e.declined_at)}{e.decline_reason ? ` · ${e.decline_reason}` : ""}. It stays on the record.</div>
            ) : (
              <div>
                {open ? "Not signed yet. " : ""}The price is on this screen first{money(e.total) ? ` (${money(e.total)} plus tax)` : ""}, then the customer approves and signs: here in person, or on their phone from the link.
              </div>
            )}
          </Row>

          {!supplement && (
            <Row done={supplements.length > 0 && supplements.every((s) => s.status === "accepted")} title="Extra work" testId="sig-extra">
              {supplements.length === 0 && changeOrders.length === 0 ? (
                <div>None. If the tech finds more, it comes here: text it to the customer to approve or decline before it is done.</div>
              ) : (
                <ul className="mt-1 grid gap-3">
                  {supplements.map((s) => {
                    const co = changeOrders.find((a) => a.estimate_id === s.id && a.decision !== "declined");
                    const declined = s.status === "declined";
                    return (
                      <li key={s.id} className="rounded-lg border border-border px-3 py-2.5" data-testid="sig-extra-row" data-status={s.status}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-foreground">
                            <Link href={`/retail/estimates/${s.id}`} className="font-medium hover:text-primary">{s.display_number}</Link>
                            {money(s.total) && <span className="tabular-nums">{money(s.total)}</span>}
                            <Badge variant={s.status === "accepted" ? "success" : declined ? "muted" : s.status === "draft" ? "outline" : "info"}>{s.status === "accepted" ? "Approved" : declined ? "Declined" : s.status === "draft" ? "Draft" : "Waiting on them"}</Badge>
                          </div>
                          {canAct && (s.status === "sent" || s.status === "viewed") && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => link(s, "text")} data-testid="sig-extra-text"><MessageSquareTextIcon /> Text it</Button>
                              <Button size="sm" variant="outline" onClick={() => link(s, "copy")} data-testid="sig-extra-copy"><CopyIcon /> Copy link</Button>
                            </div>
                          )}
                          {canAct && s.status === "draft" && (
                            <Button asChild size="sm" variant="outline"><Link href={`/retail/estimates/${s.id}`}>Finish and send</Link></Button>
                          )}
                        </div>
                        {co && <div className="mt-1 text-caption text-subtle">{co.name} · {HOW[co.method]} · {formatDateTime(co.authorized_at)}</div>}
                        {co?.has_signature && <SigImage kind="job" id={co.id} name={co.name} />}
                        {declined && <div className="mt-1 text-caption text-subtle">Declined; it stays on the record{changeOrders.find((a) => a.estimate_id === s.id && a.decision === "declined") ? ` (${formatDateTime(changeOrders.find((a) => a.estimate_id === s.id && a.decision === "declined")!.authorized_at)})` : ""}.</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Row>
          )}

          {!supplement && visit && (
            <Row
              done={!!charge?.has_signature}
              title="Pickup, after payment"
              testId="sig-pickup"
              actions={canAct && charge?.paid_at && !charge.has_signature && !charge.picked_up_at ? <Button size="sm" onClick={() => window.dispatchEvent(new Event(RO_EVENTS.sign))} data-testid="sig-pickup-sign"><PenLineIcon /> Customer signs</Button> : null}
            >
              {charge?.has_signature ? (
                <>
                  <div>{charge.receipt_signed_name} · {formatDateTime(charge.receipt_signed_at)}</div>
                  <div className="text-caption text-subtle">&ldquo;I received my vehicle, the work was done as described, and I paid{money(charge.total) ? ` ${money(charge.total)}` : " in full"}{charge.paid_at ? ` on ${formatDateTime(charge.paid_at)}` : ""}.&rdquo;</div>
                  <SigImage kind="pickup" id={visit.jobId} name={charge.receipt_signed_name ?? "Customer"} />
                </>
              ) : charge?.paid_at ? (
                <div>Paid. The customer signs for the car now.</div>
              ) : (
                <div className={cn(!charge && "text-subtle")}>Opens once the invoice is paid in full: the customer signs that they received the car and paid.</div>
              )}
            </Row>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}
