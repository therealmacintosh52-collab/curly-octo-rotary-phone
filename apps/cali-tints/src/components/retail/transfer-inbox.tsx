"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InboxIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import type { MyTransfers, TransferRow } from "@/lib/db/types";
import { cancelTransferAction, respondTransferAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { ageLabel } from "@/lib/retail/estimate-stage";

function Box({ title, icon, count, children, testId }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode; testId: string }) {
  return (
    <section className="rounded-xl border border-border bg-card surface-raised" data-testid={testId}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">{icon} {title}</h2>
        {count > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">{count}</span>}
      </header>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

function Line({ t, who, children }: { t: TransferRow; who: string; children: React.ReactNode }) {
  return (
    <li className="py-3 text-sm" data-testid="transfer-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/retail/estimates/${t.estimate_id}`} className="font-medium hover:text-primary">{t.number}</Link>
          <span className="text-muted-foreground"> · {t.customer ?? "Customer"}{t.vehicle ? ` · ${t.vehicle}` : ""}</span>
          <div className="text-caption text-subtle">{who} · {t.status_label} · {ageLabel(t.created_at)}</div>
          {t.message && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">&ldquo;{t.message}&rdquo;</p>}
        </div>
        <div className="flex shrink-0 gap-2">{children}</div>
      </div>
    </li>
  );
}

/** Visits offered to me (accept or decline) and visits I offered (cancel), like the shop's Incoming / Outgoing boxes. */
export function TransferInbox({ data }: { data: MyTransfers }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  function answer(t: TransferRow, accept: boolean) {
    start(async () => {
      if (demo) return void toast.success(accept ? "Accepted" : "Declined", { description: "Guest preview — nothing changed" });
      const r = await respondTransferAction(t.id, accept);
      if (!r.ok) return void toast.error(r.error);
      toast.success(accept ? "It is yours now" : "Declined");
      router.refresh();
    });
  }
  function cancel(t: TransferRow) {
    start(async () => {
      if (demo) return void toast.success("Cancelled", { description: "Guest preview — nothing changed" });
      const r = await cancelTransferAction(t.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Cancelled");
      router.refresh();
    });
  }
  return (
    <>
      <Box title="Incoming" icon={<InboxIcon className="size-4 text-primary" />} count={data.incoming.length} testId="transfer-incoming">
        {data.incoming.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground" data-testid="transfer-incoming-empty">Your inbox is clear.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.incoming.map((t) => (
              <Line key={t.id} t={t} who={`From ${t.from}`}>
                <Button size="sm" onClick={() => answer(t, true)} disabled={pending} data-testid="transfer-accept">Accept</Button>
                <Button size="sm" variant="ghost" onClick={() => answer(t, false)} disabled={pending} data-testid="transfer-decline">Decline</Button>
              </Line>
            ))}
          </ul>
        )}
      </Box>
      <Box title="Outgoing" icon={<SendIcon className="size-4 text-primary" />} count={data.outgoing.length} testId="transfer-outgoing">
        {data.outgoing.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Nothing waiting on a coworker.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.outgoing.map((t) => (
              <Line key={t.id} t={t} who={`To ${t.to}`}>
                <Button size="sm" variant="outline" onClick={() => cancel(t)} disabled={pending} data-testid="transfer-cancel">Cancel</Button>
              </Line>
            ))}
          </ul>
        )}
      </Box>
    </>
  );
}
