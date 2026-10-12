import Link from "next/link";
import { ThumbsUp, ThumbsDown, ShieldCheck, Clock } from "lucide-react";
import { SourceBadge } from "@/components/source-badge";
import { Badge } from "@/components/ui/badge";
import type { RankedFix } from "@/lib/fixes/queries";

export function FixCard({ item, highlightCodes = [] }: { item: RankedFix; highlightCodes?: string[] }) {
  const f = item.fix;
  return (
    <Link href={`/fixes/${f.id}`} className="block rounded-xl border border-border bg-card p-4 hover:bg-accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{f.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {f.year} {f.make} {f.model}
            {f.engine ? ` · ${f.engine}` : ""}
            {f.mileage ? ` · ${f.mileage.toLocaleString()} mi` : ""}
          </p>
        </div>
        <SourceBadge source={f.source_label} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{f.root_cause}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold text-success">
          <ThumbsUp className="size-3.5" /> {f.confirm_count}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ThumbsDown className="size-3.5" /> {f.deny_count}
        </span>
        <span className="text-muted-foreground">
          net {f.net_score >= 0 ? "+" : ""}
          {f.net_score}
        </span>
        {f.verified_at && (
          <Badge variant="success">
            <ShieldCheck className="size-3" /> Verified
          </Badge>
        )}
        {f.labor_hours != null && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3.5" /> {Number(f.labor_hours)} h
          </span>
        )}
        {item.matchLevel !== "exact" && <Badge variant="muted">{item.matchLevel === "same_year" ? "same year" : "nearby year"}</Badge>}
        <span className="ml-auto flex flex-wrap gap-1">
          {f.fix_dtcs.map((d) => (
            <Badge key={d.code} variant={highlightCodes.includes(d.code) ? "default" : "outline"} className="font-mono">
              {d.code}
            </Badge>
          ))}
        </span>
      </div>
    </Link>
  );
}
