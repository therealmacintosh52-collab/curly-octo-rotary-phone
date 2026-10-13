import { TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SourceBadge } from "./source-badge";
import { DTC_SYSTEM_LABELS, SAFETY_FLAG_LABELS } from "@/lib/intel/dtc-systems";
import type { DtcDefinition as Def } from "@/lib/intel/dtc";

/** One trouble code: what it means, which system, the safety note, the usual suspects. */
export function DtcDefinition({ code, row, inferred }: { code: string; row?: Def | null; inferred?: { system: string; description: string } }) {
  const system = row?.system ?? inferred?.system ?? "computer";
  const safety = row?.safety_flag ? SAFETY_FLAG_LABELS[row.safety_flag] : null;
  return (
    <Card data-testid="dtc-definition" data-code={code}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-2xl font-bold tracking-wide">{code}</p>
            <p className="mt-0.5 font-medium leading-snug">{row?.description ?? inferred?.description}</p>
            <p className="mt-1 text-caption text-muted-foreground">
              {DTC_SYSTEM_LABELS[system] ?? system}
              {row ? " · generic definition" : " · not in the database"}
            </p>
          </div>
          <SourceBadge source={row ? "GENERIC" : null} />
        </div>
        {safety && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" data-testid="dtc-safety">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <TriangleAlertIcon className="size-4" /> Safety system: {safety.label}
            </p>
            <p className="mt-1 text-foreground/90">{safety.note}</p>
          </div>
        )}
        {row?.common_causes?.length ? (
          <div className="mt-3">
            <p className="text-label text-subtle">Common causes (general; verify for this car)</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {row.common_causes.map((c) => (
                <li key={c}>
                  <Badge variant="secondary">{c}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
