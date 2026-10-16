"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COLOR_MAX, COLOR_OTHER, COLOR_PRESETS, isPresetColor } from "@/lib/vehicles";
import { cn } from "@/lib/utils";

/**
 * Tap a simple color (White, Black, Silver…), or tap Other and type it. The value is the
 * color itself ("White", "Midnight green"), never the word "Other". A saved color that is not
 * one of the presets opens under Other with its text filled in.
 */
export function ColorPicker({ id, value, onChange, disabled }: { id?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [otherOpen, setOtherOpen] = useState(false);
  const preset = isPresetColor(value);
  const other = otherOpen || (value.trim() !== "" && !preset);
  return (
    <div className="grid gap-2" data-testid="color-picker" id={id}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Color">
        {COLOR_PRESETS.map((c) => {
          const on = !other && value.trim().toLowerCase() === c.name.toLowerCase();
          return (
            <button
              key={c.name}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              data-testid="color-chip"
              data-color={c.name}
              onClick={() => {
                setOtherOpen(false);
                onChange(c.name);
              }}
              className={cn("flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/70", on ? "border-primary/70 bg-accent-soft" : "border-border bg-card hover:border-border-strong", disabled && "pointer-events-none opacity-60")}
            >
              <span className="size-4 shrink-0 rounded-full border border-border-strong" style={{ background: c.swatch }} />
              {c.name}
              {on && <CheckIcon className="size-3.5 text-primary" strokeWidth={3} />}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={other}
          data-testid="color-other"
          onClick={() => {
            setOtherOpen(true);
            if (preset) onChange("");
          }}
          className={cn("flex h-10 items-center rounded-xl border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/70", other ? "border-primary/70 bg-accent-soft" : "border-border bg-card hover:border-border-strong", disabled && "pointer-events-none opacity-60")}
        >
          {COLOR_OTHER}
        </button>
      </div>
      {other && (
        <Input
          value={preset ? "" : value}
          onChange={(e) => onChange(e.target.value.slice(0, COLOR_MAX))}
          placeholder="Type the color"
          maxLength={COLOR_MAX}
          autoComplete="off"
          disabled={disabled}
          data-testid="color-other-input"
          aria-label="Other color"
        />
      )}
    </div>
  );
}
