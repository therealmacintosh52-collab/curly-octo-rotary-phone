"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { ChevronDownIcon } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(ymd: string, n: number) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * "This week" as a tile that opens into its seven days. Each day shows the
 * cars and revenue logged and links to that day's invoices; days still to
 * come are dimmed.
 */
export function WeekTile({ jobs, revenue, weekStart, today, days }: { jobs: number; revenue: number; weekStart: string; today: string; days: { day: string; jobs: number; revenue: number }[] }) {
  const [open, setOpen] = useState(false);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const week = DOW.map((name, i) => {
    const day = addDays(weekStart, i);
    const d = byDay.get(day);
    return { name, day, jobs: d?.jobs ?? 0, revenue: Number(d?.revenue ?? 0), future: day > today, isToday: day === today };
  });

  return (
    <div className={cn("rounded-xl border border-border bg-card surface-raised transition-[border-color] duration-150", open && "border-border-strong")}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group block w-full rounded-xl px-4 py-4 text-left transition-colors hover:bg-accent/40 sm:px-5" data-testid="week-tile">
        <div className="flex items-start justify-between gap-2">
          <div className="text-label text-muted-foreground">This week</div>
          <ChevronDownIcon className={cn("size-4 shrink-0 text-subtle transition-transform duration-150 group-hover:text-primary", open && "rotate-180")} />
        </div>
        <div className="mt-2 text-[1.75rem] leading-8 font-semibold tracking-tight tabular-nums sm:text-[2rem] sm:leading-9">{jobs}</div>
        <div className="mt-1 text-caption text-subtle">
          {jobs} {jobs === 1 ? "car" : "cars"} · {formatMoney(revenue)} · tap for each day
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <ul className="grid grid-cols-7 gap-1 border-t border-border px-2 py-2" data-testid="week-days">
              {week.map((d) => (
                <li key={d.day}>
                  <Link
                    href={`/invoices?from=${d.day}&to=${d.day}`}
                    aria-disabled={d.future || undefined}
                    className={cn(
                      "flex flex-col items-center rounded-lg px-1 py-2 text-center transition-colors hover:bg-accent/60",
                      d.future && "pointer-events-none opacity-40",
                      d.isToday && "bg-accent-soft",
                    )}
                  >
                    <span className="text-[11px] text-muted-foreground">{d.name}</span>
                    <span className="text-caption text-subtle">{formatDateOnly(d.day, "d")}</span>
                    <span className={cn("mt-1 text-base font-semibold tabular-nums", d.jobs === 0 && "text-subtle")}>{d.future ? "·" : d.jobs}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{d.jobs > 0 ? formatMoney(d.revenue).replace(/\.00$/, "") : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
