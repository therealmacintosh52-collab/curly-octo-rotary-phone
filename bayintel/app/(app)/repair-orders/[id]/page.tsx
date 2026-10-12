import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Wrench, FileText, ShieldCheck } from "lucide-react";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoStatusButtons } from "@/components/repair-orders/ro-status";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function RoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: ro } = await supabase.from("repair_orders").select("*, vehicles(*), repair_order_media(id, storage_path, caption), fixes!repair_orders_fix_id_fkey(id, title, net_score), estimates(id, estimate_number, status)").eq("id", id).maybeSingle();
  if (!ro) notFound();
  const photos = await Promise.all(
    ro.repair_order_media.map(async (m) => {
      const { data } = await supabase.storage.from("ro-media").createSignedUrl(m.storage_path, 3600);
      return { ...m, url: data?.signedUrl ?? null };
    }),
  );
  const tests = (ro.tests_performed as { test: string; result: string }[]) ?? [];
  const parts = (ro.parts as { name: string; part_number: string | null; quantity: number; unit_price: number | null }[]) ?? [];
  const done = ro.status === "completed" || ro.status === "invoiced";

  return (
    <Page
      title={`RO #${ro.ro_number}`}
      subtitle={
        ro.vehicles ? (
          <Link href={`/vehicles/${ro.vehicles.id}`} className="hover:underline">
            {ro.vehicles.year} {ro.vehicles.make} {ro.vehicles.model}
            {ro.vehicles.engine ? ` · ${ro.vehicles.engine}` : ""}
          </Link>
        ) : undefined
      }
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link href={`/repair-orders/${id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={done ? "success" : "info"}>{ro.status.replace("_", " ")}</Badge>
        <span>{formatDate(ro.created_at)}</span>
        {ro.mileage && <span>· {ro.mileage.toLocaleString()} mi</span>}
        {ro.customer_name && <span>· {ro.customer_name}</span>}
        {ro.dtc_codes.map((c) => (
          <Link key={c} href={`/dtc?codes=${c}&vehicle=${ro.vehicle_id}`}>
            <Badge variant="outline" className="font-mono">
              {c}
            </Badge>
          </Link>
        ))}
      </div>

      {ro.fixes ? (
        <Link href={`/fixes/${ro.fixes.id}`} className="mb-4 flex items-center gap-2 rounded-xl border border-success/50 bg-success/10 p-3 text-sm">
          <ShieldCheck className="size-5 text-success" /> Shared as a Confirmed Fix: <span className="font-medium">{ro.fixes.title}</span>
        </Link>
      ) : (
        <Button asChild size="lg" className="mb-4 w-full" variant={done ? "default" : "outline"}>
          <Link href={`/fixes/new?ro=${ro.id}`}>
            <Wrench /> {done ? "Turn this RO into a Confirmed Fix" : "Share as a Confirmed Fix (prefilled)"}
          </Link>
        </Button>
      )}

      <div className="space-y-3">
        <Block title="Concern">{ro.concern}</Block>
        {ro.cause && <Block title="Cause">{ro.cause}</Block>}
        {ro.correction && <Block title="Correction">{ro.correction}</Block>}
        {tests.length > 0 && (
          <Block title="Tests">
            <ul className="space-y-1">
              {tests.map((t, i) => (
                <li key={i}>
                  <span className="font-medium">{t.test}</span>
                  {t.result && <span className="text-muted-foreground"> — {t.result}</span>}
                </li>
              ))}
            </ul>
          </Block>
        )}
        {parts.length > 0 && (
          <Block title="Parts">
            <ul className="space-y-1">
              {parts.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    {p.name}
                    {p.part_number && <span className="ml-2 font-mono text-xs text-muted-foreground">{p.part_number}</span>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    ×{p.quantity}
                    {p.unit_price != null ? ` · ${formatMoney(p.unit_price)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        )}
        {ro.labor_hours != null && <p className="text-sm">Labor: <strong>{Number(ro.labor_hours)} h</strong></p>}
        {photos.length > 0 && (
          <Block title="Photos">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((m) => (
                <li key={m.id}>
                  {m.url ? (
                    <a href={m.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.caption ?? "RO photo"} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                    </a>
                  ) : (
                    <div className="aspect-square rounded-lg bg-muted" />
                  )}
                </li>
              ))}
            </ul>
          </Block>
        )}
        {ro.notes && <Block title="Notes">{ro.notes}</Block>}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {ro.estimates.length ? (
          ro.estimates.map((e) => (
            <Button key={e.id} asChild variant="outline">
              <Link href={`/estimates/${e.id}`}>
                <FileText /> Estimate #{e.estimate_number} ({e.status})
              </Link>
            </Button>
          ))
        ) : (
          <Button asChild variant="outline">
            <Link href={`/estimates/new?ro=${ro.id}`}>
              <FileText /> Create estimate from this RO
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-4">
        <RoStatusButtons id={ro.id} status={ro.status} />
      </div>
    </Page>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">{children}</div>
    </section>
  );
}
