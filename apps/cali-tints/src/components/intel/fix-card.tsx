import Link from "next/link";
import { ClockIcon, ShieldCheckIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import type { FixSummary, RankedFix } from "@/lib/db/types";
import { fixCarName, matchLabel } from "@/lib/intel/fixes";
import { Badge } from "@/components/ui/badge";

/** One fix in a list: the title, the car, the root cause, the votes, the codes. */
export function FixCard({ fix, highlightCodes = [] }: { fix: FixSummary | RankedFix; highlightCodes?: string[] }) {
  const ranked = "match_level" in fix ? fix : null;
  const label = ranked ? matchLabel(ranked.match_level) : null;
  return (
    <Link href={`/intel/fixes/${fix.id}`} className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/60" data-testid="fix-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{fix.title}</p>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {fixCarName(fix)}
            {fix.mileage ? ` · ${fix.mileage.toLocaleString()} mi` : ""}
          </p>
        </div>
        {fix.is_mine && <Badge variant="outline">Mine</Badge>}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{fix.root_cause}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-caption">
        <span className="inline-flex items-center gap-1 font-semibold text-success">
          <ThumbsUpIcon className="size-3.5" /> {fix.confirm_count}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ThumbsDownIcon className="size-3.5" /> {fix.deny_count}
        </span>
        {fix.confirm_count >= 3 && fix.net_score >= 3 && (
          <Badge variant="success">
            <ShieldCheckIcon className="size-3" /> Proven
          </Badge>
        )}
        {fix.labor_hours != null && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <ClockIcon className="size-3.5" /> {Number(fix.labor_hours)} h
          </span>
        )}
        {label && <Badge variant="muted">{label}</Badge>}
        <span className="ml-auto flex flex-wrap gap-1">
          {fix.codes.map((c) => (
            <Badge key={c} variant={highlightCodes.includes(c) ? "default" : "outline"} className="font-mono">
              {c}
            </Badge>
          ))}
        </span>
      </div>
    </Link>
  );
}
