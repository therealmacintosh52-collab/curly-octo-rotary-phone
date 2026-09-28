"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { ScanLineIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABELS, type InvoiceFilters as Filters, type SearchDate } from "@/lib/invoices/query";
import { formatDateOnly } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
// The barcode engine (ZXing) is ~200 KB; it only loads the first time the scanner opens.
const VinScanner = dynamic(() => import("@/components/jobs/vin-scanner").then((mod) => mod.VinScanner), { ssr: false });

const ALL = "__all";

/** The unpaid family: the segmented control shows one "Unpaid" segment, and these chips split it. */
const UNPAID = new Set(["unpaid", "outstanding", "draft", "submitted", "partial"]);

/**
 * URL-state filter bar for the one list. Search and status are always
 * visible; dealership, service and dates live in a sheet on phones and inline
 * on desktop. Active filters show as chips so a drilled-down list (from the
 * dashboard) is always explainable. The search box also takes a date
 * ("9/27", "sep", "yesterday"): `searchDate` says the page read it that way.
 */
export function InvoiceFilters({
  filters,
  searchDate = null,
  services,
  dealerships,
  isAdmin,
}: {
  filters: Filters;
  searchDate?: SearchDate | null;
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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMounted, setScannerMounted] = useState(false);

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
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  const serviceName = services.find((s) => s.id === filters.service)?.name;
  const dealershipName = dealerships.find((d) => d.id === filters.dealership)?.name;
  const chips: { key: string; label: string; clear: Record<string, undefined> }[] = [];
  if (filters.service) chips.push({ key: "service", label: serviceName ?? "Service", clear: { service: undefined } });
  if (filters.dealership) chips.push({ key: "dealership", label: dealershipName ?? "Dealership", clear: { dealership: undefined } });
  if (filters.detailer) chips.push({ key: "detailer", label: "One detailer", clear: { detailer: undefined } });
  if (searchDate) chips.push({ key: "search-date", label: searchDate.label, clear: { q: undefined } });
  if (filters.from || filters.to) {
    const label = filters.from && filters.to && filters.from === filters.to ? formatDateOnly(filters.from, "MMM d, yyyy") : `${filters.from ? formatDateOnly(filters.from, "MMM d") : "…"} – ${filters.to ? formatDateOnly(filters.to, "MMM d, yyyy") : "…"}`;
    chips.push({ key: "dates", label, clear: { from: undefined, to: undefined } });
  }
  const hasFilters = chips.length > 0 || !!filters.q || filters.status !== "all";
  const advancedCount = chips.length;

  const segment = UNPAID.has(filters.status) ? "unpaid" : filters.status;
  const statusItems = [
    { value: "all", label: "All" },
    { value: "unpaid", label: "Unpaid" },
    { value: "overdue", label: "Overdue" },
    { value: "paid", label: "Paid" },
    ...(isAdmin ? [{ value: "void", label: "Void" }] : []),
  ];
  const unpaidChips: { value: string; label: string }[] = [
    { value: "unpaid", label: "Any" },
    { value: "draft", label: STATUS_LABELS.draft },
    { value: "submitted", label: "Sent" },
    { value: "partial", label: STATUS_LABELS.partial },
  ];

  const controls = (layout: "sheet" | "inline") => (
    <div className={cn(layout === "sheet" ? "grid gap-4" : "flex flex-wrap items-end gap-2")}>
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tag, VIN, invoice #, model, service or date" className="pl-10 pr-20" enterKeyHint="search" autoCapitalize="characters" aria-label="Search invoices" />
          <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQ("");
                  update({ q: undefined });
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            )}
            {/* Scan the VIN barcode on the car to pull up its invoice. */}
            <button
              type="button"
              aria-label="Scan VIN"
              title="Scan the VIN barcode to find its invoice"
              onClick={() => {
                setScannerMounted(true);
                setScannerOpen(true);
              }}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-primary"
            >
              <ScanLineIcon className="size-5" />
            </button>
          </div>
        </form>
        {scannerMounted && (
          <VinScanner
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onDetected={(v) => {
              setQ(v);
              update({ q: v });
              toast.success("VIN scanned · finding its invoice");
            }}
          />
        )}
        <Button type="button" variant="outline" className="relative shrink-0 gap-2 sm:hidden" onClick={() => setSheetOpen(true)} aria-label="More filters">
          <SlidersHorizontalIcon />
          Filters
          {advancedCount > 0 && <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{advancedCount}</span>}
        </Button>
      </div>

      {/* Status + inline controls (desktop) */}
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Segmented aria-label="Invoice status" items={statusItems} value={segment} onValueChange={(v) => update({ status: v === "all" ? undefined : v })} className="w-full sm:w-auto" />
        <div className="hidden sm:block">{controls("inline")}</div>
      </div>

      {/* Unpaid: split by where the money is */}
      <AnimatePresence initial={false}>
        {segment === "unpaid" && (
          <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-1.5 overflow-hidden" role="group" aria-label="Unpaid by stage">
            {unpaidChips.map((c) => {
              const active = (filters.status === "outstanding" ? "unpaid" : filters.status) === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ status: c.value })}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium transition-colors",
                    active ? "border-primary/40 bg-accent-soft text-primary" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>

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
