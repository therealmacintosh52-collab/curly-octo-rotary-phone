"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { RetailCatalogService, VehicleSize } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Every service the shop sells in ONE drop-down: type to filter, tap to tick
 * (the list stays open so several can be ticked at once), the price shown is
 * the one for the car's size. Replaces the long rows of chips.
 */
export function ServiceMenu({ services, selected, size, onToggle, onOther, onBlankJob, label = "Add a service", testId = "service-menu" }: { services: RetailCatalogService[]; selected: Set<string>; size: VehicleSize; onToggle: (s: RetailCatalogService) => void; /** "Other (not on the menu)": a typed name and amount. */ onOther?: () => void; /** A job you name yourself. */ onBlankJob?: () => void; label?: string; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? services.filter((s) => s.name.toLowerCase().includes(t)) : services;
  }, [services, q]);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-between" data-testid={testId}>
          <span className="inline-flex items-center gap-2"><PlusIcon /> {label}</span>
          <ChevronDownIcon className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={{ left: 16, right: 16, top: 72, bottom: 88 }} className="w-[min(22rem,calc(100vw-2rem))] p-2" data-testid={`${testId}-list`}>
        <div className="relative mb-2">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the menu" aria-label="Search the menu" className="h-10 w-full rounded-md border border-border bg-input pr-3 pl-8 text-base outline-none focus-visible:border-primary" data-testid={`${testId}-search`} />
        </div>
        <ul className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-8rem))] overflow-y-auto" role="listbox" aria-multiselectable>
          {shown.map((s) => {
            const on = selected.has(s.id);
            const price = s.prices?.[size] ?? s.default_price;
            return (
              <li key={s.id}>
                <button type="button" role="option" aria-selected={on} onClick={() => onToggle(s)} className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2.5 text-left text-sm hover:bg-muted", on && "text-primary")}>
                  <span className="inline-flex items-center gap-2"><span className="inline-flex size-4 items-center justify-center">{on && <CheckIcon className="size-4" />}</span>{s.name}</span>
                  {price !== null && price !== undefined && <span className="tabular-nums text-muted-foreground">{formatMoney(price)}</span>}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-2.5 py-3 text-sm text-muted-foreground">Nothing matches.</li>}
        </ul>
        {(onBlankJob || onOther) && (
          <div className="mt-2 grid gap-1 border-t border-border pt-2">
            {onBlankJob && <button type="button" onClick={() => { setOpen(false); onBlankJob(); }} className="min-h-11 rounded-md px-2.5 text-left text-sm hover:bg-muted" data-testid={`${testId}-blank`}>A service I name myself…</button>}
            {onOther && <button type="button" onClick={() => { setOpen(false); onOther(); }} className="min-h-11 rounded-md px-2.5 text-left text-sm hover:bg-muted" data-testid={`${testId}-other`}>Other (not on the menu)…</button>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
