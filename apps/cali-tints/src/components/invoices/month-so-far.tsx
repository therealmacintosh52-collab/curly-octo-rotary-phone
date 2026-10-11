import Link from "next/link";
import { CalendarClockIcon } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceNowButton } from "./invoice-now-button";

export interface MonthSoFarRow {
  dealership_id: string;
  dealership: string;
  cars: number;
  total: number;
}

/** The month in progress: per dealership, the jobs waiting to become the 1st's invoice. */
export function MonthSoFar({ rows, today, showMoney }: { rows: MonthSoFarRow[]; today: string; showMoney: boolean }) {
  const monthName = formatDateOnly(today, "MMMM");
  return (
    <Card className="mt-5" data-testid="month-so-far">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-primary" /> {monthName} so far
        </CardTitle>
        <CardDescription>Each dealership&apos;s jobs become one invoice on the 1st. Nothing to do until then.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dealerships yet. Add one under Settings → Dealerships.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((r) => (
              <li key={r.dealership_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/jobs?status=open&dealership=${r.dealership_id}`} className="font-medium hover:text-primary">
                    {r.dealership}
                  </Link>
                  <div className="text-caption text-subtle">
                    {r.cars} {r.cars === 1 ? "car" : "cars"} not invoiced yet
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {showMoney && <span className="font-semibold tabular-nums">{formatMoney(r.total)}</span>}
                  <InvoiceNowButton dealershipId={r.dealership_id} dealership={r.dealership} cars={r.cars} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
