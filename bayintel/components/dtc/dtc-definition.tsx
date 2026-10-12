import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/source-badge";
import { DTC_SYSTEM_LABELS, SAFETY_FLAG_LABELS } from "@/lib/dtc/systems";
import type { DtcRow } from "@/lib/dtc/queries";

export function DtcDefinition({ code, row, inferred }: { code: string; row?: DtcRow; inferred?: { system: string; description: string } }) {
  const system = row?.system ?? inferred?.system ?? "computer";
  const safety = row?.safety_flag ? SAFETY_FLAG_LABELS[row.safety_flag] : null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-2xl font-bold">{code}</p>
          <p className="mt-0.5 font-medium leading-snug">{row?.description ?? inferred?.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {DTC_SYSTEM_LABELS[system] ?? system}
            {row ? " · Generic (SAE J2012)" : " · Not in database"}
          </p>
        </div>
        <SourceBadge source={row ? "COMMUNITY" : "OWNER"} />
      </div>
      {safety && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" /> Safety system: {safety.label}
          </p>
          <p className="mt-1 text-foreground/90">{safety.note}</p>
        </div>
      )}
      {row?.common_causes?.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Common causes (general, verify for this vehicle)</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {row.common_causes.map((c) => (
              <li key={c}>
                <Badge variant="secondary" className="normal-case tracking-normal">
                  {c}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
