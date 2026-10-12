import Link from "next/link";
import { Plus } from "lucide-react";
import { Page, Empty } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { computeTotals } from "@/lib/estimates/calc";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Estimates" };

export default async function EstimatesPage() {
  const supabase = await createClient();
  const { data: estimates } = await supabase.from("estimates").select("*, estimate_lines(*), vehicles(year, make, model)").order("created_at", { ascending: false }).limit(100);
  return (
    <Page
      title="Estimates"
      actions={
        <Button asChild size="sm">
          <Link href="/estimates/new">
            <Plus /> New
          </Link>
        </Button>
      }
    >
      {!estimates?.length ? (
        <Empty title="No estimates yet" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {estimates.map((e) => {
            const t = computeTotals(
              e.estimate_lines.map((l) => ({ kind: l.kind, description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unit_price), hours: l.hours == null ? null : Number(l.hours), taxable: l.taxable })),
              { taxRate: Number(e.tax_rate), taxParts: e.tax_parts, taxLabor: e.tax_labor },
            );
            return (
              <li key={e.id}>
                <Link href={`/estimates/${e.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-accent">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      #{e.estimate_number} · {e.customer_name || "No customer"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.vehicles ? `${e.vehicles.year} ${e.vehicles.make} ${e.vehicles.model} · ` : ""}
                      {formatDate(e.created_at)}
                    </p>
                  </div>
                  <Badge variant={e.status === "approved" ? "success" : e.status === "declined" ? "destructive" : e.status === "sent" ? "info" : "muted"}>{e.status}</Badge>
                  <span className="w-20 text-right font-semibold tabular-nums">{formatMoney(t.total)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
