"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Slot } from "@/lib/db/types";
import { addDays, dayKeyIn, dayLabelIn, groupSlotsByDay, timeIn } from "@/lib/retail/slots";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Pick a day, then a start time. Seven days at a time, fetched from the one
 * slot engine (find_slots) through whichever action the caller passes:
 * staff, public page or the manage link. Everything shows in the shop's
 * timezone.
 */
export function SlotPicker({
  tz,
  fetchSlots,
  value,
  onChange,
  maxDaysAhead = 60,
  disabled,
}: {
  tz: string;
  fetchSlots: (from: string, to: string) => Promise<{ ok: true; data: Slot[] } | { ok: false; error: string }>;
  value: Slot | null;
  onChange: (s: Slot | null) => void;
  maxDaysAhead?: number;
  disabled?: boolean;
}) {
  const today = useMemo(() => dayKeyIn(new Date(), tz), [tz]);
  const [from, setFrom] = useState(today);
  const [day, setDay] = useState<string | null>(null);
  // The answer for a week, keyed by the request it answers: while the key is stale we are loading.
  const [result, setResult] = useState<{ key: string; slots: Slot[]; error: string | null }>({ key: "", slots: [], error: null });
  const to = addDays(from, 6);
  const key = `${from}:${to}`;
  const loading = result.key !== key;
  const slots = loading ? null : result.slots;
  const error = loading ? null : result.error;

  useEffect(() => {
    let alive = true;
    fetchSlots(from, to).then((r) => {
      if (!alive) return;
      setResult(r.ok ? { key, slots: r.data, error: null } : { key, slots: [], error: r.error });
    });
    return () => {
      alive = false;
    };
  }, [from, to, key, fetchSlots]);

  const groups = useMemo(() => groupSlotsByDay(slots ?? [], tz), [slots, tz]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const activeDay = day && days.includes(day) ? day : (groups[0]?.day ?? null);
  const dayGroup = groups.find((g) => g.day === activeDay);
  const last = addDays(today, maxDaysAhead);

  return (
    <div className="grid gap-3" data-testid="slot-picker">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="icon-sm" aria-label="Earlier week" disabled={from <= today || disabled} onClick={() => { setFrom(addDays(from, -7) < today ? today : addDays(from, -7)); setDay(null); }}>
          <ChevronLeftIcon />
        </Button>
        <div className="text-sm font-medium">{dayLabelIn(`${from}T12:00:00Z`, "UTC")} – {dayLabelIn(`${to}T12:00:00Z`, "UTC")}</div>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Later week" disabled={to >= last || disabled} onClick={() => { setFrom(addDays(from, 7)); setDay(null); }}>
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="Days">
        {days.map((d) => {
          const g = groups.find((x) => x.day === d);
          const n = g?.slots.length ?? 0;
          const on = d === activeDay;
          const label = dayLabelIn(`${d}T12:00:00Z`, "UTC");
          const [wd, md] = label.split(", ");
          return (
            <button key={d} type="button" role="tab" aria-selected={on} disabled={!n || disabled} onClick={() => setDay(d)} className={cn("flex flex-col items-center rounded-lg border px-1 py-1.5 text-caption transition-colors", on ? "border-primary bg-accent-soft text-primary" : n ? "border-border hover:border-border-strong" : "border-transparent text-muted-foreground/50")}>
              <span>{wd}</span>
              <span className="text-sm font-semibold">{md?.split(" ")[1]}</span>
              <span className="text-[10px]">{loading ? "…" : n ? `${n}` : "—"}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && (slots?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Nothing open this week. Try the next one.</p>}
      {dayGroup && (
        <div className="flex flex-wrap gap-2" data-testid="slot-times">
          {dayGroup.slots.map((s) => {
            const on = value?.starts_at === s.starts_at;
            return (
              <button key={s.starts_at} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(on ? null : s)} className={cn("rounded-full border px-3 py-1.5 text-sm tabular-nums transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-border-strong")}>
                {timeIn(s.starts_at, tz)}
              </button>
            );
          })}
        </div>
      )}
      {value && <p className="text-sm font-medium" data-testid="slot-chosen">{dayLabelIn(value.starts_at, tz, true)} at {timeIn(value.starts_at, tz)} · until {timeIn(value.ends_at, tz)}</p>}
    </div>
  );
}
