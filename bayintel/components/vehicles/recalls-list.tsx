import { AlertTriangle } from "lucide-react";
import type { Recall } from "@/lib/providers/types";
import { SourceBadge } from "@/components/source-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, titleCase } from "@/lib/utils";
import { Empty } from "@/components/shell/page";

export function RecallsList({ recalls, error }: { recalls: Recall[]; error?: string }) {
  if (error) return <Empty title="NHTSA recall data unavailable">{error}</Empty>;
  if (!recalls.length) return <Empty title="No open recalls on file with NHTSA">Checked against NHTSA recalls by year, make and model. Verify by VIN at nhtsa.gov/recalls for a definitive answer.</Empty>;
  return (
    <ul className="space-y-3">
      {recalls.map((r) => (
        <li key={r.campaignNumber} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{titleCase(r.component)}</p>
              <p className="text-xs text-muted-foreground">
                Campaign {r.campaignNumber} · {formatDate(r.reportDate)}
              </p>
            </div>
            <SourceBadge source="NHTSA" />
          </div>
          {(r.parkIt || r.parkOutside) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {r.parkIt && (
                <Badge variant="destructive">
                  <AlertTriangle className="size-3" /> Do not drive
                </Badge>
              )}
              {r.parkOutside && (
                <Badge variant="warning">
                  <AlertTriangle className="size-3" /> Park outside
                </Badge>
              )}
            </div>
          )}
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Summary</dt>
              <dd>{r.summary}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Risk</dt>
              <dd>{r.consequence}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Remedy</dt>
              <dd>{r.remedy}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
