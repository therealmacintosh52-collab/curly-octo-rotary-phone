"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClockIcon, FileTextIcon, HistoryIcon, PencilIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { FixDetail } from "@/lib/db/types";
import { deleteFixAction } from "@/app/(app)/intel/actions";
import { useSession } from "@/components/app/session-provider";
import { Page } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fixCarName } from "@/lib/intel/fixes";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ConfirmButtons } from "./confirm-buttons";

/** One fix: the story, the votes, the parts and time, the edit history, and the way into an estimate. */
export function FixDetailView({ fix }: { fix: FixDetail }) {
  const router = useRouter();
  const { demo, canPrices } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const partsTotal = fix.parts.reduce((s, p) => s + (p.unit_price != null ? p.unit_price * p.quantity : 0), 0);

  function remove() {
    start(async () => {
      if (demo) {
        toast.success("Fix removed", { description: "Guest preview — nothing changed" });
        router.push("/intel/fixes");
        return;
      }
      const r = await deleteFixAction(fix.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Fix removed");
      router.push("/intel/fixes");
      router.refresh();
    });
  }

  return (
    <Page narrow>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {fix.codes.map((c) => (
          <Link key={c} href={`/intel/dtc?codes=${c}`}>
            <Badge variant="outline" className="font-mono">
              {c}
            </Badge>
          </Link>
        ))}
        {fix.confirm_count >= 3 && fix.net_score >= 3 && (
          <Badge variant="success">
            <ShieldCheckIcon className="size-3" /> Proven
          </Badge>
        )}
        {fix.is_mine && <Badge variant="outline">Mine</Badge>}
        <span className="ml-auto flex items-center gap-1">
          {fix.can_edit && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/intel/fixes/${fix.id}/edit`} data-testid="fix-edit">
                <PencilIcon /> Edit
              </Link>
            </Button>
          )}
          {fix.can_delete && (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} data-testid="fix-delete">
              <Trash2Icon /> Remove
            </Button>
          )}
        </span>
      </div>
      <h1 className="text-title" data-testid="fix-title-h1">{fix.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {fixCarName(fix)}
        {fix.mileage ? ` · ${fix.mileage.toLocaleString()} mi` : ""}
      </p>
      <p className="mt-1 text-caption text-subtle">
        {formatDate(fix.created_at)}
        {fix.version > 1 ? ` · edited (v${fix.version})` : ""}
      </p>

      <div className="mt-4">
        <ConfirmButtons fixId={fix.id} mine={fix.my_vote} isAuthor={fix.is_mine} confirmCount={fix.confirm_count} denyCount={fix.deny_count} />
      </div>

      {canPrices && (
        <div className="mt-4">
          <Button asChild variant="outline" data-testid="fix-estimate">
            <Link href={`/retail/estimates/new?fix=${fix.id}`}>
              <FileTextIcon /> Build the estimate from this
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <Block title="Symptoms">{fix.symptoms}</Block>
        {fix.freeze_frame_notes && <Block title="Freeze frame">{fix.freeze_frame_notes}</Block>}
        {fix.tests.length > 0 && (
          <Block title="What was tested">
            <ol className="space-y-2" data-testid="fix-tests">
              {fix.tests.map((t, i) => (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3">
                  <span className="font-mono text-caption text-muted-foreground">{i + 1}.</span>
                  <div>
                    <p className="font-medium">{t.test}</p>
                    {t.result && <p className="text-muted-foreground">{t.result}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Block>
        )}
        <Block title="Root cause" accent>
          {fix.root_cause}
        </Block>
        <Block title="What fixed it">{fix.fix_description}</Block>
        {fix.parts.length > 0 && (
          <Block title="Parts">
            <table className="w-full text-sm" data-testid="fix-parts">
              <tbody>
                {fix.parts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-2">
                      {p.name}
                      {p.part_number && <span className="ml-2 font-mono text-caption text-muted-foreground">{p.part_number}</span>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">×{p.quantity}</td>
                    {canPrices && <td className="py-1.5 pl-2 text-right tabular-nums">{p.unit_price != null ? formatMoney(p.unit_price) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {canPrices && partsTotal > 0 && <p className="mt-2 text-right text-sm text-muted-foreground">Parts as written down {formatMoney(partsTotal)}</p>}
          </Block>
        )}
        {fix.labor_hours != null && (
          <p className="flex items-center gap-2 text-sm" data-testid="fix-labor-line">
            <ClockIcon className="size-4 text-muted-foreground" /> It took <strong>{fix.labor_hours} h</strong> <span className="text-caption text-muted-foreground">(actual time, not a labor guide)</span>
          </p>
        )}
        {fix.media.length > 0 && (
          <Block title="Photos">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fix.media.map((m) => (
                <li key={m.id}>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.caption ?? "Photo"} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Block>
        )}
        {fix.notes.length > 0 && (
          <Block title="Notes from the votes">
            <ul className="space-y-2" data-testid="fix-notes">
              {fix.notes.map((n, i) => (
                <li key={i} className="text-sm">
                  <span className={n.verdict === "fixed" ? "text-success" : "text-destructive"}>{n.verdict === "fixed" ? "Fixed it" : "Didn't fix it"}</span> <span className="text-caption text-muted-foreground">· {formatDate(n.created_at)}</span>
                  <p className="text-muted-foreground">{n.note}</p>
                </li>
              ))}
            </ul>
          </Block>
        )}
        {fix.revisions.length > 0 && (
          <Block title="Edit history">
            <ul className="space-y-1 text-sm" data-testid="fix-revisions">
              {fix.revisions.map((r) => (
                <li key={r.version} className="flex items-start gap-2">
                  <HistoryIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    v{r.version} → v{r.version + 1} · {formatDate(r.created_at)}
                    {r.change_note ? `: ${r.change_note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        )}
      </div>
      <p className="mt-6 text-caption text-subtle">The shop&apos;s own notes: verify procedures and specifications in the manufacturer&apos;s service information before a repair.</p>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this fix?</DialogTitle>
            <DialogDescription>It and its votes and photos are deleted for the whole shop.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={remove} loading={pending} data-testid="fix-delete-confirm">
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function Block({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={`rounded-xl border bg-card p-4 ${accent ? "border-primary/50" : "border-border"}`}>
      <h2 className="mb-1.5 text-label text-subtle">{title}</h2>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">{children}</div>
    </section>
  );
}
