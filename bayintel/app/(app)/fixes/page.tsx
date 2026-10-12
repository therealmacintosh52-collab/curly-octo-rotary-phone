import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Page, Empty } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FixCard } from "@/components/fixes/fix-card";
import { createClient } from "@/lib/supabase/server";
import type { RankedFix } from "@/lib/fixes/queries";

export const metadata = { title: "Confirmed fixes" };

export default async function FixesPage({ searchParams }: { searchParams: Promise<{ q?: string; mine?: string }> }) {
  const { q = "", mine } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let ids: string[] | null = null;
  if (q.trim()) {
    const { data } = await supabase.rpc("search_fixes", { p_query: q.trim(), p_limit: 50 });
    ids = (data ?? []).map((r) => r.fix_id);
  }
  let query = supabase.from("fixes").select("*, fix_dtcs(code), profiles:author_id(display_name, reputation)").order("net_score", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  if (ids) query = ids.length ? query.in("id", ids) : query.in("id", ["00000000-0000-0000-0000-000000000000"]);
  if (mine && user) query = query.eq("author_id", user.id);
  const { data: fixes } = await query;

  const items: RankedFix[] = (fixes ?? []).map((f) => ({ fix: f as unknown as RankedFix["fix"], rankScore: f.net_score, matchLevel: "exact", matchedCodes: [] }));

  return (
    <Page
      title="Confirmed fixes"
      subtitle="Ranked by net confirmations. Vote after you've tried a fix."
      actions={
        <Button asChild size="sm">
          <Link href="/fixes/new">
            <Plus /> Submit
          </Link>
        </Button>
      }
    >
      <form className="mb-4 flex gap-2" action="/fixes">
        <Input name="q" defaultValue={q} placeholder="Search symptoms, codes, parts…" enterKeyHint="search" />
        <Button type="submit" size="icon" aria-label="Search">
          <Search />
        </Button>
      </form>
      <div className="mb-3 flex gap-2 text-sm">
        <Link href="/fixes" className={`rounded-full border px-3 py-1 ${!mine ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          All
        </Link>
        <Link href="/fixes?mine=1" className={`rounded-full border px-3 py-1 ${mine ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          Mine
        </Link>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((it) => (
            <FixCard key={it.fix.id} item={it} />
          ))}
        </div>
      ) : (
        <Empty title={q ? `No fixes match "${q}"` : "No fixes yet"}>
          <Link href="/fixes/new" className="text-primary underline">
            Submit the first one
          </Link>
        </Empty>
      )}
    </Page>
  );
}
