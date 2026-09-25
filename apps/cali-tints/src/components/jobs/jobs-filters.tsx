"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import type { JobFilters } from "@/lib/jobs/query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ALL = "__all";

/** URL-state filter bar. Every control writes to the query string, so views are shareable and back-button friendly. */
export function JobsFilters({
  filters,
  services,
  detailers,
  dealerships,
  isAdmin,
}: {
  filters: JobFilters;
  services: { id: string; name: string }[];
  detailers: { id: string; full_name: string }[];
  dealerships: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");

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

  const hasFilters = !!(filters.q || filters.service || filters.detailer || filters.dealership || filters.from || filters.to || (filters.status && filters.status !== "all"));

  return (
    <div className="flex flex-col gap-3" data-pending={pending || undefined}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q });
          }}
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tag, VIN, model or RO/PO"
            className="h-11 pl-10"
            enterKeyHint="search"
            autoCapitalize="characters"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ("");
                update({ q: undefined });
              }}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </form>
        <Tabs value={filters.status ?? "all"} onValueChange={(v) => update({ status: v === "all" ? undefined : v })}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="uninvoiced">Uninvoiced</TabsTrigger>
            <TabsTrigger value="invoiced">Invoiced</TabsTrigger>
            {isAdmin && <TabsTrigger value="deleted">Deleted</TabsTrigger>}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Select value={filters.service ?? ALL} onValueChange={(v) => update({ service: v })}>
          <SelectTrigger size="sm" className="sm:w-44">
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
        {dealerships.length > 1 && (
          <Select value={filters.dealership ?? ALL} onValueChange={(v) => update({ dealership: v })}>
            <SelectTrigger size="sm" className="sm:w-52">
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
        )}
        {isAdmin && detailers.length > 0 && (
          <Select value={filters.detailer ?? ALL} onValueChange={(v) => update({ detailer: v })}>
            <SelectTrigger size="sm" className="sm:w-44">
              <SelectValue placeholder="Detailer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All detailers</SelectItem>
              {detailers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input type="date" value={filters.from ?? ""} onChange={(e) => update({ from: e.target.value || undefined })} className="h-9 text-sm sm:w-40" aria-label="From date" />
        <Input type="date" value={filters.to ?? ""} onChange={(e) => update({ to: e.target.value || undefined })} className="h-9 text-sm sm:w-40" aria-label="To date" />
        {hasFilters && (
          <Button variant="ghost" size="sm" className="col-span-2 text-muted-foreground" onClick={() => start(() => router.push(pathname))}>
            <XIcon /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
