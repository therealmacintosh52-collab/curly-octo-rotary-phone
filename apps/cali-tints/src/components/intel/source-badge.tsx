import { Badge } from "@/components/ui/badge";
import type { SourceLabel } from "@/lib/intel/types";

const LABEL: Record<SourceLabel, { text: string; title: string }> = {
  NHTSA: { text: "NHTSA", title: "From the U.S. National Highway Traffic Safety Administration (public data)" },
  GENERIC: { text: "Generic", title: "Generic OBD-II definition (SAE J2012); verify for this vehicle" },
  SHOP: { text: "This shop", title: "Logged by this shop" },
};

/** Where a record came from; every Intel screen says so. */
export function SourceBadge({ source }: { source: SourceLabel | string | null | undefined }) {
  const l = LABEL[(source ?? "") as SourceLabel];
  if (!l) return null;
  return (
    <Badge variant="outline" title={l.title} className="font-normal">
      {l.text}
    </Badge>
  );
}
