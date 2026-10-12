import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Pencil, ShieldCheck, History } from "lucide-react";
import { Page } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/source-badge";
import { ConfirmButtons } from "@/components/fixes/confirm-buttons";
import { createClient, getProfile } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/storage";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function FixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile();
  const { data: fix } = await supabase
    .from("fixes")
    .select("*, fix_dtcs(code), fix_parts(*), fix_media(id, storage_path, caption), profiles:author_id(display_name, reputation), fix_revisions(id, version, change_note, created_at, editor:editor_id(display_name))")
    .eq("id", id)
    .maybeSingle();
  if (!fix) notFound();
  const { data: myVote } = profile ? await supabase.from("fix_confirmations").select("verdict").eq("fix_id", id).eq("user_id", profile.id).maybeSingle() : { data: null };
  const { data: notes } = await supabase.from("fix_confirmations").select("verdict, note, created_at, profiles:user_id(display_name)").eq("fix_id", id).not("note", "is", null).order("created_at", { ascending: false }).limit(20);
  const tests = (fix.tests_performed as { test: string; result: string }[]) ?? [];
  const isAuthor = profile?.id === fix.author_id;
  const canEdit = isAuthor || profile?.role === "admin";
  const partsTotal = fix.fix_parts.reduce((s, p) => s + (p.unit_price ? Number(p.unit_price) * Number(p.quantity) : 0), 0);

  return (
    <Page>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SourceBadge source={fix.source_label} />
        {fix.verified_at && (
          <Badge variant="success">
            <ShieldCheck className="size-3" /> Verified
          </Badge>
        )}
        {fix.status !== "approved" && <Badge variant="warning">{fix.status}</Badge>}
        {fix.fix_dtcs.map((d) => (
          <Link key={d.code} href={`/dtc?codes=${d.code}`}>
            <Badge variant="outline" className="font-mono">
              {d.code}
            </Badge>
          </Link>
        ))}
        {canEdit && (
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href={`/fixes/${id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
        )}
      </div>
      <h1 className="text-2xl font-bold leading-tight tracking-tight">{fix.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {fix.year} {fix.make} {fix.model}
        {fix.engine ? ` · ${fix.engine}` : ""}
        {fix.mileage ? ` · ${fix.mileage.toLocaleString()} mi` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {fix.source_label === "SAMPLE" ? "Sample data for illustration" : `By ${fix.profiles?.display_name ?? "a contributor"} · reputation ${fix.profiles?.reputation ?? 0}`} · {formatDate(fix.created_at)}
        {fix.version > 1 ? ` · edited (v${fix.version})` : ""}
      </p>

      {fix.source_label === "SAMPLE" && (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          This is a SAMPLE fix seeded to show the data shape. Part numbers are placeholders. Do not act on it as repair information.
        </p>
      )}

      <div className="mt-4">
        <ConfirmButtons fixId={fix.id} mine={myVote?.verdict ?? null} isAuthor={isAuthor} confirmCount={fix.confirm_count} denyCount={fix.deny_count} />
      </div>

      <div className="mt-6 space-y-4">
        <Block title="Symptoms">{fix.symptoms}</Block>
        {fix.freeze_frame_notes && <Block title="Freeze frame">{fix.freeze_frame_notes}</Block>}
        {tests.length > 0 && (
          <Block title="Tests performed">
            <ol className="space-y-2">
              {tests.map((t, i) => (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3">
                  <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
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
        <Block title="Fix">{fix.fix_description}</Block>
        {fix.fix_parts.length > 0 && (
          <Block title="Parts">
            <table className="w-full text-sm">
              <tbody>
                {fix.fix_parts
                  .sort((a, b) => a.sort - b.sort)
                  .map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-2">
                        {p.name}
                        {p.part_number && <span className="ml-2 font-mono text-xs text-muted-foreground">{p.part_number}</span>}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">×{Number(p.quantity)}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{p.unit_price != null ? formatMoney(Number(p.unit_price)) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {partsTotal > 0 && <p className="mt-2 text-right text-sm text-muted-foreground">Parts (reported) {formatMoney(partsTotal)}</p>}
          </Block>
        )}
        {fix.labor_hours != null && (
          <p className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-muted-foreground" /> Actual labor time: <strong>{Number(fix.labor_hours)} h</strong> <span className="text-xs text-muted-foreground">(reported by contributor, not a labor guide value)</span>
          </p>
        )}
        {fix.fix_media.length > 0 && (
          <Block title="Photos">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fix.fix_media.map((m) => (
                <li key={m.id}>
                  <a href={publicMediaUrl("fix-media", m.storage_path)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={publicMediaUrl("fix-media", m.storage_path)} alt={m.caption ?? "Fix photo"} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                  </a>
                </li>
              ))}
            </ul>
          </Block>
        )}
        {notes && notes.length > 0 && (
          <Block title="Confirmation notes">
            <ul className="space-y-2">
              {notes.map((n, i) => (
                <li key={i} className="text-sm">
                  <span className={n.verdict === "fixed" ? "text-success" : "text-destructive"}>{n.verdict === "fixed" ? "Fixed it" : "Didn't fix it"}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    · {n.profiles?.display_name ?? "user"} · {formatDate(n.created_at)}
                  </span>
                  <p className="text-muted-foreground">{n.note}</p>
                </li>
              ))}
            </ul>
          </Block>
        )}
        {fix.fix_revisions.length > 0 && (
          <Block title="Edit history">
            <ul className="space-y-1 text-sm">
              {fix.fix_revisions
                .sort((a, b) => b.version - a.version)
                .map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      v{r.version} → v{r.version + 1} · {formatDate(r.created_at)} · {r.editor?.display_name ?? "editor"}
                      {r.change_note ? `: ${r.change_note}` : ""}
                    </span>
                  </li>
                ))}
            </ul>
          </Block>
        )}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Community content is advisory. Verify procedures, specifications and safety steps against OEM service information before performing any repair.
      </p>
    </Page>
  );
}

function Block({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={`rounded-xl border bg-card p-4 ${accent ? "border-primary/50" : "border-border"}`}>
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">{children}</div>
    </section>
  );
}
