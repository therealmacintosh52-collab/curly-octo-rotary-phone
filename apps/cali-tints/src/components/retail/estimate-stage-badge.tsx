import type { EstimateStage, EstimateStatus } from "@/lib/db/types";
import { STAGE_META } from "@/lib/retail/estimate-stage";
import { Badge } from "@/components/ui/badge";
import { EstimateStatusBadge } from "./estimate-status-badge";

/** The stage of a visit as a badge: the whole life of the estimate, not only whether the customer said yes. */
export function EstimateStageBadge({ stage, status }: { stage?: EstimateStage; status: EstimateStatus }) {
  if (!stage) return <EstimateStatusBadge status={status} />;
  const m = STAGE_META[stage];
  return (
    <Badge variant={m.variant} title={m.hint} data-stage={stage}>
      {m.short}
    </Badge>
  );
}
