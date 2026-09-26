"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import type { JobFilters } from "@/lib/jobs/query";
import { formatDateOnly } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ALL = "__all";

/**
 * URL-state filter bar. Search and status are always visible; the rest lives
 * in a sheet on phones and inline on desktop. Active filters show as chips so
 * a drilled-down list (from the dashboard) is always explainable.
 */
export function JobsFilters({
  filters,
  services,
  dealerships,
  isAdmin,
}: {
  filters: JobFilters;
  services: { id: string; name: string }[];
  dealerships: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Keep the search box in sync when navigating back/forward.
  useEffect(() => {
    const t = setTimeout(() => setQ(filters.q ?? ""), 0);
    return () => clearTimeout(t);
  }, [filters.q]);

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    start(() => router.push(`${pathname}?${next.toString()}`));
  }

  const serviceName = services.find((s) => s.id === filters.service)?.name;
  const dealershipName = dealerships.find((d) => d.id === filters.dealership)?.name;
  const chips: { key: string; label: string; clear: Record<string, undefined> }[] = [];
  if (filters.service) chips.push({ key: "service", label: serviceName ?? "Service", clear: { service: undefined } });
  if (filters.dealership) chips.push({ key: "dealership", label: dealershipName ?? "Dealership", clear: { dealership: undefined } });
  if (filters.detailer) chips.push({ key: "detailer", label: "One detailer", clear: { detailer: undefined } });
  if (filters.from || filters.to) {
    const label = filters.from && filters.to && filters.from === filters.to ? formatDateOnly(filters.from, "MMM d, yyyy") : `${filters.from ? formatDateOnly(filters.from, "MMM d") : "…"} – ${filters.to ? formatDateOnly(filters.to, "MMM d, yyyy") : "…"}`;
    chips.push({ key: "dates", label, clear: { from: undefined, to: undefined } });
  }
  const hasFilters = chips.length > 0 || !!filters.q || (!!filters.status && filters.status !== "all");
  const advancedCount = chips.length;

  const statusItems = [
    { value: "all", label: "All" },
    { value: "uninvoiced", label: "Uninvoiced" },
    { value: "invoiced", label: "Invoiced" },
    ...(isAdmin ? [{ value: "deleted", label: "Deleted" }] : []),
  ];

  const controls = (layout: "sheet" | "inline") => (
    <div className={cn(layout === "sheet" ? "grid gap-4" : "flex flex-wrap items-end gap-2")}>
      <Field label="Service" layout={layout}>
        <Select value={filters.service ?? ALL} onValueChange={(v) => update({ service: v })}>
          <SelectTrigger size={layout === "inline" ? "sm" : "default"} aria-label="Service" className={layout === "inline" ? "w-44" : undefined}>
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All services</SelectItem>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {dealerships.length > 1 && (
        <Field label="Dealership" layout={layout}>
          <Select value={filters.dealership ?? ALL} onValueChange={(v) => update({ dealership: v })}>
            <SelectTrigger size={layout === "inline" ? "sm" : "default"} aria-label="Dealership" className={layout === "inline" ? "w-52" : undefined}>
              <SelectValue placeholder="Dealership" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All dealerships</SelectItem>
              {dealerships.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <div className={cn(layout === "sheet" ? "grid grid-cols-2 gap-3" : "contents")}>
        <Field label="From" layout={layout}>
          <Input type="date" value={filters.from ?? ""} onChange={(e) => update({ from: e.target.value || undefined })} className={layout === "inline" ? "h-9 w-40 text-sm" : undefined} aria-label="From date" />
        </Field>
        <Field label="To" layout={layout}>
          <Input type="date" value={filters.to ?? ""} onChange={(e) => update({ to: e.target.value || undefined })} className={layout === "inline" ? "h-9 w-40 text-sm" : undefined} aria-label="To date" />
        </Field>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3" data-pending={pending || undefined} aria-busy={pending || undefined}>
      {/* Search + filters button */}
      <div className="flex gap-2">
        <form
          className="relative min-w-0 flex-1"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q });
          }}
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tag, VIN or model" className="pl-10 pr-9" enterKeyHint="search" autoCapitalize="characters" aria-label="Search jobs" />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ("");
                update({ q: undefined });
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </form>
        <Button type="button" variant="outline" className="relative shrink-0 gap-2 sm:hidden" onClick={() => setSheetOpen(true)} aria-label="More filters">
          <SlidersHorizontalIcon />
          Filters
          {advancedCount > 0 && <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{advancedCount}</span>}
        </Button>
      </div>

      {/* Status + inline controls (desktop) */}
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Segmented aria-label="Invoice status" items={statusItems} value={filters.status ?? "all"} onValueChange={(v) => update({ status: v === "all" ? undefined : v })} className="w-full sm:w-auto" />
        <div className="hidden sm:block">{controls("inline")}</div>
      </div>

      {/* Active filter chips */}
      <AnimatePresence initial={false}>
        {hasFilters && (
          <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-2 overflow-hidden">
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={() => update(c.clear)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-accent-soft pl-3 pr-2 text-[13px] font-medium text-primary transition-colors hover:bg-primary/20">
                {c.label}
                <XIcon className="size-3.5" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => start(() => router.push(pathname))}>
              Clear all
            </Button>
          </m.div>
        )}
      </AnimatePresence>

      {/* Phone: filters sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow the list. Changes apply immediately.</SheetDescription>
          </SheetHeader>
          <div className="px-5">{controls("sheet")}</div>
          <SheetFooter className="flex-row">
            {hasFilters && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSheetOpen(false);
                  start(() => router.push(pathname));
                }}
              >
                Clear all
              </Button>
            )}
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, layout, children }: { label: string; layout: "sheet" | "inline"; children: React.ReactNode }) {
  if (layout === "inline")
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-caption text-subtle">{label}</span>
        {children}
      </div>
    );
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
