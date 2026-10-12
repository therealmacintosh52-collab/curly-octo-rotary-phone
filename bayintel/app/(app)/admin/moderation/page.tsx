import Link from "next/link";
import { redirect } from "next/navigation";
import { Page, Empty } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { ModerationActions } from "@/components/admin/moderation-actions";
import { createClient, getProfile } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Moderation queue" };

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect("/garage");
  const { status = "open" } = await searchParams;
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("moderation_queue")
    .select("*, fixes(id, title, year, make, model, status, net_score, profiles:author_id(display_name, reputation)), reporter:reported_by(display_name)")
    .eq("status", status as "open" | "resolved" | "dismissed")
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <Page title="Moderation queue" subtitle="New community fixes and reports. Rejecting hides a fix from everyone but its author.">
      <div className="mb-3 flex gap-2 text-sm">
        {["open", "resolved", "dismissed"].map((s) => (
          <Link key={s} href={`/admin/moderation?status=${s}`} className={`rounded-full border px-3 py-1 capitalize ${status === s ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
            {s}
          </Link>
        ))}
      </div>
      {!items?.length ? (
        <Empty title="Queue is empty" />
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={it.kind === "report" ? "destructive" : "info"}>{it.kind.replace("_", " ")}</Badge>
                <span>{formatDate(it.created_at)}</span>
                {it.reporter && <span>· by {it.reporter.display_name}</span>}
              </div>
              {it.fixes && (
                <Link href={`/fixes/${it.fixes.id}`} className="mt-2 block font-medium hover:underline">
                  {it.fixes.title}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {it.fixes.year} {it.fixes.make} {it.fixes.model} · {it.fixes.status} · net {it.fixes.net_score} · author rep {it.fixes.profiles?.reputation ?? 0}
                  </span>
                </Link>
              )}
              {it.reason && <p className="mt-1 text-sm text-muted-foreground">{it.reason}</p>}
              {it.status === "open" ? <ModerationActions queueId={it.id} /> : <p className="mt-2 text-xs text-muted-foreground">{it.status} {it.resolution_note ? `· ${it.resolution_note}` : ""}</p>}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
