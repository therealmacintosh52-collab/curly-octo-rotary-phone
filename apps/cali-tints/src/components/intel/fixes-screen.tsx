"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LightbulbIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { FixSummary } from "@/lib/db/types";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { FixCard } from "./fix-card";

/** Intel → Fixes: the shop's library, searchable by words or codes. */
export function FixesScreen({ fixes, q, codes, mine }: { fixes: FixSummary[]; q: string; codes: string; mine: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(q || codes);
  const go = (nextMine: boolean) => {
    const sp = new URLSearchParams();
    const term = query.trim();
    if (term) sp.set(/^[PBCU][0-9A-F]{4}([\s,]|$)/i.test(term) ? "codes" : "q", term.replace(/\s+/g, /^[PBCU][0-9A-F]{4}/i.test(term) ? "," : " "));
    if (nextMine) sp.set("mine", "1");
    router.push(`/intel/fixes${sp.size ? `?${sp}` : ""}`);
  };
  return (
    <Page>
      <PageHeader
        eyebrow="Intel"
        title="Fixes"
        description="What the shop has already solved: by code, by car, by symptom."
        actions={
          <Button asChild>
            <Link href="/intel/fixes/new" data-testid="fix-new">
              <PlusIcon /> Write down a fix
            </Link>
          </Button>
        }
      />
      <form
        className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          go(mine);
        }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Words (rattle on cold start) or codes (P0300)" className="h-11 sm:max-w-md" aria-label="Search the fixes" data-testid="fixes-search" />
        <Button type="submit" variant="outline" className="h-11">
          <SearchIcon /> Search
        </Button>
        <Segmented size="sm" aria-label="Whose fixes" value={mine ? "mine" : "all"} onValueChange={(v) => go(v === "mine")} items={[{ value: "all", label: "All" }, { value: "mine", label: "Mine" }]} />
      </form>
      <section className="mt-6 space-y-3" data-testid="fixes-list">
        {fixes.length === 0 ? (
          <EmptyState icon={LightbulbIcon} title={q || codes || mine ? "No fix matches" : "No fixes written down yet"} description={q || codes || mine ? "Try other words, or a code like P0300." : "The first tough one you solve, write it down here and it comes up next time the same code shows on the same car."} action={<Button asChild variant="outline"><Link href="/intel/fixes/new">Write down a fix</Link></Button>} />
        ) : (
          fixes.map((f) => <FixCard key={f.id} fix={f} highlightCodes={codes ? codes.split(",") : []} />)
        )}
      </section>
    </Page>
  );
}
