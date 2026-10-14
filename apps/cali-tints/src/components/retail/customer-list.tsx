"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArchiveIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon, UsersIcon, XIcon } from "lucide-react";
import type { CustomerListRow } from "@/lib/db/types";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/retail/phone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerItem } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

export const CUSTOMER_PAGE_SIZE = 50;

/**
 * Every retail customer, searchable by name, phone, email, plate or the car.
 * Phone rows are cards; desktop gets a table. Money (lifetime spend) only
 * reaches owner and admin screens.
 */
export function CustomerList({ rows, count, page, q, archived, showMoney }: { rows: CustomerListRow[]; count: number; page: number; q: string; archived: boolean; showMoney: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [text, setText] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setText(q), 0);
    return () => clearTimeout(t);
  }, [q]);

  function go(patch: { q?: string; archived?: boolean; page?: number }) {
    const sp = new URLSearchParams();
    const nq = patch.q ?? q;
    const na = patch.archived ?? archived;
    const np = patch.page ?? 1;
    if (nq) sp.set("q", nq);
    if (na) sp.set("archived", "1");
    if (np > 1) sp.set("page", String(np));
    start(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  }

  const pages = Math.max(1, Math.ceil(count / CUSTOMER_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: text.trim() });
        }}
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Name, phone, email, plate or car" aria-label="Search customers" className={cn("pl-9", text && "pr-9")} autoComplete="off" enterKeyHint="search" />
          {text && (
            <button type="button" aria-label="Clear search" onClick={() => { setText(""); go({ q: "" }); }} className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant={archived ? "secondary" : "outline"} size="sm" onClick={() => go({ archived: !archived })} aria-pressed={archived}>
            <ArchiveIcon /> {archived ? "Archived" : "Archive"}
          </Button>
          <Button asChild size="sm">
            <Link href="/retail/customers/new">
              <PlusIcon /> New customer
            </Link>
          </Button>
        </div>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending ? "Searching…" : `${count.toLocaleString()} ${count === 1 ? "customer" : "customers"}${q ? ` matching “${q}”` : ""}${archived ? " in the archive" : ""}`}
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title={q ? "No one matches" : archived ? "Nobody archived" : "No customers yet"} description={q ? "Try the phone number or the car." : "Add the first walk-in, or start an estimate and pick New customer there."} action={!q && !archived ? <Button asChild><Link href="/retail/customers/new"><PlusIcon /> New customer</Link></Button> : undefined} />
      ) : (
        <>
          {/* Phone cards */}
          <ul className="flex flex-col gap-2 md:hidden" data-testid="customer-cards">
            {rows.map((r, i) => (
              <StaggerItem key={r.id} index={i} as="li">
                <Link href={`/retail/customers/${r.id}`} className="block rounded-xl border border-border bg-card p-3.5 surface-raised transition-colors hover:border-border-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.display_name ?? formatPhone(r.phone) ?? r.email}</div>
                      <div className="mt-0.5 truncate text-sm text-muted-foreground">{[formatPhone(r.phone), r.email].filter(Boolean).join(" · ") || "No contact"}</div>
                    </div>
                    {showMoney && r.lifetime_spend !== null && r.lifetime_spend > 0 && <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(r.lifetime_spend)}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-caption text-subtle">
                    <span className="truncate">{r.vehicles.length ? r.vehicles.join(" · ") : "No vehicle yet"}</span>
                    <span className="ml-auto shrink-0">{r.visits ? `${r.visits} ${r.visits === 1 ? "visit" : "visits"} · last ${formatDate(r.last_visit)}` : "No visits"}</span>
                  </div>
                  {r.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <Badge key={t} variant="outline">{t}</Badge>
                      ))}
                    </div>
                  )}
                </Link>
              </StaggerItem>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-caption text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contact</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Vehicles</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Visits</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Last visit</th>
                  {showMoney && <th scope="col" className="px-4 py-2.5 text-right font-medium">Spent</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/retail/customers/${r.id}`} className="font-semibold hover:text-primary">{r.display_name ?? formatPhone(r.phone) ?? r.email}</Link>
                      {r.tags.length > 0 && <span className="ml-2 inline-flex gap-1">{r.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{[formatPhone(r.phone), r.email].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="max-w-64 truncate px-4 py-2.5 text-muted-foreground">{r.vehicles.join(" · ") || "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.visits || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.last_visit ? formatDate(r.last_visit) : "—"}</td>
                    {showMoney && <td className="px-4 py-2.5 text-right tabular-nums">{r.lifetime_spend ? formatMoney(r.lifetime_spend) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {page} of {pages}</span>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ page: page - 1 })}><ChevronLeftIcon /> Newer</Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>Older <ChevronRightIcon /></Button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
