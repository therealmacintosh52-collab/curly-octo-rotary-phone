import { Badge } from "@/components/ui/badge";
import type { SourceLabel } from "@/lib/providers/types";

const META: Record<SourceLabel, { label: string; variant: "info" | "success" | "warning" | "secondary" | "muted"; title: string }> = {
  NHTSA: { label: "NHTSA", variant: "info", title: "Public data from the National Highway Traffic Safety Administration" },
  COMMUNITY: { label: "Community-verified", variant: "success", title: "Submitted by a technician and confirmed by other users" },
  OWNER: { label: "Owner-reported", variant: "secondary", title: "Entered by a vehicle owner or user; not independently verified" },
  LICENSED: { label: "Licensed", variant: "warning", title: "From a licensed data provider" },
  SAMPLE: { label: "Sample", variant: "muted", title: "Illustrative sample data. Not real repair information." },
};

export function SourceBadge({ source, className }: { source: SourceLabel; className?: string }) {
  const m = META[source] ?? META.SAMPLE;
  return (
    <Badge variant={m.variant} title={m.title} className={className}>
      {m.label}
    </Badge>
  );
}
