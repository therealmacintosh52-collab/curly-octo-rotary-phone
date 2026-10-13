"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, ReceiptTextIcon, SearchIcon, XIcon } from "lucide-react";
import type { RetailInvoiceList as ListData } from "@/lib/db/types";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerItem } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";
import { RetailInvoiceStatusBadge } from "./retail-invoice-status-badge";

export const RETAIL_INVOICE_PAGE_SIZE = 50;
export type RetailInvoiceFilter = "open" | "paid" | "void" | "all";
const FILTERS: { value: RetailInvoiceFilter; label: string }[] = [
  { value: "open", label: "To collect" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" },
  { value: "void", label: "Void" },
];

/**
 * Retail's own invoices: one per repair order, numbered RI-…, apart from the
 * dealerships' monthly invoices and never sent to QuickBooks. Owner, admin
 * and advisor only (it is all money).
 */
export function RetailInvoiceList({ data, page, q, status }: { data: ListData; page: number; q: string; status: RetailInvoiceFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [text, setText] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setText(q), 0);
    return () => clearTimeout(t);
  }, [q]);

  function go(patch: { q?: string; status?: RetailInvoiceFilter; page?: number }) {
    const sp = new URLSearchParams();
    const nq = patch.q ?? q;
    const ns = patch.status ?? status;
    const np = patch.page ?? 1;
    if (nq) sp.set("q", nq);
    if (ns !== "open") sp.set("status", ns);
    if (np > 1) sp.set("page", String(np));
    start(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  }
  const { rows, count } = data;
  const pages = Math.max(1, Math.ceil(count / RETAIL_INVOICE_PAGE_SIZE));

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
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Invoice or RO number, name, phone or car" aria-label="Search retail invoices" className={cn("pl-9", text && "pr-9")} autoComplete="off" enterKeyHint="search" />
          {text && (
            <button type="button" aria-label="Clear search" onClick={() => { setText(""); go({ q: "" }); }} className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      </form>
      <Segmented aria-label="Invoice status" size="sm" items={FILTERS} value={status} onValueChange={(v) => go({ status: v as RetailInvoiceFilter })} wrap />

      <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="retail-invoice-summary">
        {pending ? "Loading…" : `${count.toLocaleString()} ${count === 1 ? "invoice" : "invoices"}${q ? ` matching “${q}”` : ""}`}
        {!pending && data.unpaid_total > 0 && <span> · {formatMoney(data.unpaid_total)} still to collect</span>}
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={ReceiptTextIcon} title={q ? "Nothing matches" : status === "open" ? "Nothing to collect" : "No invoices here"} description={q ? "Try the RO number, the customer's phone or the car." : "Every retail repair order gets its own invoice the moment it is logged."} />
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden" data-testid="retail-invoice-cards">
            {rows.map((r, i) => (
              <StaggerItem key={r.id} index={i} as="li">
                <Link href={`/retail/invoices/${r.id}`} className="block rounded-xl border border-border bg-card p-3.5 surface-raised transition-colors hover:border-border-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.customer ?? "Walk-in"}</div>
                      <div className="mt-0.5 truncate text-sm text-muted-foreground">{r.vehicle ?? "—"}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <RetailInvoiceStatusBadge status={r.status} />
                      <div className="mt-1 text-sm font-semibold tabular-nums">{formatMoney(r.total)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 text-caption text-subtle">
                    <span className="tracking-wide">{r.number}</span>
                    {r.ro_number && <span>· {r.ro_number}</span>}
                    <span>· {formatDate(r.performed_at)}</span>
                    {r.status === "partial" || r.status === "unpaid" ? <span className="ml-auto font-medium text-foreground">{formatMoney(r.balance)} due</span> : null}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm" data-testid="retail-invoice-table">
              <thead className="bg-muted/40 text-left text-caption text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Vehicle</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/retail/invoices/${r.id}`} className="font-semibold tracking-wide hover:text-primary">{r.number}</Link>
                      <div className="text-caption text-subtle">{[r.ro_number, formatDate(r.performed_at)].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-2.5">{r.customer ?? "—"}</td>
                    <td className="max-w-64 truncate px-4 py-2.5 text-muted-foreground">{r.vehicle ?? "—"}</td>
                    <td className="px-4 py-2.5"><RetailInvoiceStatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.total)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.status === "paid" || r.status === "void" ? "—" : formatMoney(r.balance)}</td>
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
