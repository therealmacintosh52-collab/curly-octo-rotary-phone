"use client";

import { useState, useTransition } from "react";
import { UserIcon } from "lucide-react";
import { toast } from "sonner";
import { setLineTechAction } from "@/app/(app)/retail/canned-actions";
import { useSession } from "@/components/app/session-provider";

/** Who does this labor line: initials for everyone, a picker for the people who assign the work (0074). */
export function LineTech({ estimateId, lineId, tech, techId, technicians, canAssign }: { estimateId: string; lineId: string; tech: string | null | undefined; techId: string | null | undefined; technicians: { id: string; name: string; initials: string }[]; canAssign: boolean }) {
  const { demo } = useSession();
  const [value, setValue] = useState(techId ?? "");
  const [pending, start] = useTransition();
  if (!canAssign || technicians.length === 0) {
    return tech ? <span className="inline-flex items-center gap-1 text-caption text-subtle" data-testid="line-tech-initials"><UserIcon className="size-3" /> {tech}</span> : null;
  }
  return (
    <select
      value={value}
      disabled={pending}
      aria-label="Tech for this labor"
      data-testid="line-tech"
      className="h-6 rounded-md border border-border bg-input px-1.5 text-caption"
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        if (demo) return void toast.success("Assigned", { description: "Guest preview — nothing changed" });
        start(async () => {
          const r = await setLineTechAction(estimateId, lineId, next || null);
          if (!r.ok) {
            setValue(techId ?? "");
            toast.error(r.error);
          }
        });
      }}
    >
      <option value="">No tech yet</option>
      {technicians.map((t) => (
        <option key={t.id} value={t.id}>{t.initials}: {t.name}</option>
      ))}
    </select>
  );
}
