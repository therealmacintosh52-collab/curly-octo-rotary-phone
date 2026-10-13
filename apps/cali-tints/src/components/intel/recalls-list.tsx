import { ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";
import type { Recall } from "@/lib/intel/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SourceBadge } from "./source-badge";
import { formatDateOnly } from "@/lib/dates";

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** NHTSA recall campaigns for a year / make / model. */
export function RecallsList({ recalls, error }: { recalls: Recall[]; error?: string }) {
  if (error) return <EmptyState icon={ShieldAlertIcon} tone="error" title="NHTSA recall data unavailable" description={error} />;
  if (!recalls.length) return <EmptyState icon={ShieldAlertIcon} title="No recalls on file with NHTSA" description="Checked by year, make and model. For a definitive answer by VIN, nhtsa.gov/recalls." />;
  return (
    <ul className="space-y-3" data-testid="intel-recalls">
      {recalls.map((r) => (
        <li key={r.campaignNumber} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{title(r.component)}</p>
              <p className="text-caption text-muted-foreground">
                Campaign {r.campaignNumber} · {r.reportDate ? formatDateOnly(r.reportDate) : "date unknown"}
              </p>
            </div>
            <SourceBadge source="NHTSA" />
          </div>
          {(r.parkIt || r.parkOutside) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {r.parkIt && (
                <Badge variant="destructive">
                  <TriangleAlertIcon className="size-3" /> Do not drive
                </Badge>
              )}
              {r.parkOutside && (
                <Badge variant="outline" className="border-warning text-warning">
                  <TriangleAlertIcon className="size-3" /> Park outside
                </Badge>
              )}
            </div>
          )}
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-label text-subtle">Summary</dt>
              <dd>{r.summary}</dd>
            </div>
            <div>
              <dt className="text-label text-subtle">Risk</dt>
              <dd>{r.consequence}</dd>
            </div>
            <div>
              <dt className="text-label text-subtle">Remedy</dt>
              <dd>{r.remedy}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
