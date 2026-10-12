"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import type { EstimateListRow, EstimateStatus } from "@/lib/db/types";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { SIZE_LABEL } from "@/lib/retail/size-class";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerItem } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";
import { EstimateStatusBadge } from "./estimate-status-badge";

export const ESTIMATE_PAGE_SIZE = 50;
export type EstimateFilter = "open" | "all" | EstimateStatus;
const FILTERS: { value: EstimateFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "accepted", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "all", label: "All" },
];

/** Every estimate, newest first. Money only for owner and admin; the rest see who, which car and where it stands. */
export function EstimateList({ rows, count, page, q, status, showMoney }: { rows: EstimateListRow[]; count: number; page: number; q: string; status: EstimateFilter; showMoney: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [text, setText] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setText(q), 0);
    return () => clearTimeout(t);
  }, [q]);

  function go(patch: { q?: string; status?: EstimateFilter; page?: number }) {
    const sp = new URLSearchParams();
    const nq = patch.q ?? q;
    const ns = patch.status ?? status;
    const np = patch.page ?? 1;
    if (nq) sp.set("q", nq);
    if (ns !== "open") sp.set("status", ns);
    if (np > 1) sp.set("page", String(np));
    start(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  }
  const pages = Math.max(1, Math.ceil(count / ESTIMATE_PAGE_SIZE));

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
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Number, name, phone or car" aria-label="Search estimates" className={cn("pl-9", text && "pr-9")} autoComplete="off" enterKeyHint="search" />
          {text && (
            <button type="button" aria-label="Clear search" onClick={() => { setText(""); go({ q: "" }); }} className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <Button asChild size="sm">
          <Link href="/retail/estimates/new">
            <PlusIcon /> New estimate
          </Link>
        </Button>
      </form>
      <Segmented aria-label="Estimate status" size="sm" items={FILTERS} value={status} onValueChange={(v) => go({ status: v as EstimateFilter })} wrap />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending ? "Loading…" : `${count.toLocaleString()} ${count === 1 ? "estimate" : "estimates"}${q ? ` matching “${q}”` : ""}`}
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={FileTextIcon} title={q ? "Nothing matches" : status === "open" ? "No open estimates" : "No estimates here"} description={q ? "Try the customer's phone or the car." : "Write one from a customer's page or with New estimate."} action={!q ? <Button asChild><Link href="/retail/estimates/new"><PlusIcon /> New estimate</Link></Button> : undefined} />
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden" data-testid="estimate-cards">
            {rows.map((r, i) => (
              <StaggerItem key={r.id} index={i} as="li">
                <Link href={`/retail/estimates/${r.id}`} className="block rounded-xl border border-border bg-card p-3.5 surface-raised transition-colors hover:border-border-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.customer ?? "Customer"}</div>
                      <div className="mt-0.5 truncate text-sm text-muted-foreground">{[r.vehicle, SIZE_LABEL[r.size_class]].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <EstimateStatusBadge status={r.status} />
                      {showMoney && r.total !== null && <div className="mt-1 text-sm font-semibold tabular-nums">{formatMoney(r.total)}</div>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 text-caption text-subtle">
                    <span className="tracking-wide">{r.display_number}</span>
                    <span>· {formatDate(r.created_at)}</span>
                    {r.options > 1 && <span>· {r.options} options</span>}
                    {r.expires_at && r.status !== "accepted" && r.status !== "declined" && <span className="ml-auto">good until {formatDate(r.expires_at)}</span>}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-caption text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Estimate</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Vehicle</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Good until</th>
                  {showMoney && <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/retail/estimates/${r.id}`} className="font-semibold tracking-wide hover:text-primary">{r.display_number}</Link>
                      <div className="text-caption text-subtle">{formatDate(r.created_at)}{r.options > 1 ? ` · ${r.options} options` : ""}</div>
                    </td>
                    <td className="px-4 py-2.5">{r.customer ?? "—"}</td>
                    <td className="max-w-64 truncate px-4 py-2.5 text-muted-foreground">{[r.vehicle, SIZE_LABEL[r.size_class]].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-4 py-2.5"><EstimateStatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.expires_at ? formatDate(r.expires_at) : "—"}</td>
                    {showMoney && <td className="px-4 py-2.5 text-right tabular-nums">{r.total !== null ? formatMoney(r.total) : "—"}</td>}
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
