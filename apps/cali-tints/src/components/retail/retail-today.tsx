import Link from "next/link";
import { CarFrontIcon, PlusIcon, UsersIcon, WalletIcon } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface RetailTodayCar {
  id: string;
  tag: string;
  vehicle: string | null;
  customer: string | null;
  performed_at: string;
  paid_at: string | null;
  services: string[];
}

export interface RetailTodayData {
  customers: number;
  /** Retail cars logged today, newest first. */
  today: RetailTodayCar[];
  /** Retail jobs still to collect (any day). */
  unpaid: RetailTodayCar[];
}

/**
 * The shop's day: walk-in cars logged today, what is still to collect at the
 * counter, and the way into Customers. Leads and holds join this screen with
 * the booking slice. No money here: amounts live on the job page.
 */
export function RetailToday({ data, shopName }: { data: RetailTodayData; shopName: string }) {
  return (
    <Page>
      <PageHeader
        eyebrow={shopName}
        title="Today at the shop"
        description={`${data.today.length} ${data.today.length === 1 ? "car" : "cars"} today · ${data.unpaid.length} to collect · ${data.customers.toLocaleString()} ${data.customers === 1 ? "customer" : "customers"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/retail/customers/new">
                <UsersIcon /> New customer
              </Link>
            </Button>
            <Button asChild>
              <Link href="/jobs/new">
                <PlusIcon /> New job
              </Link>
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="size-4 text-warning" /> To collect
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.unpaid.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding. Every walk-in is paid up.</p>
            ) : (
              <ul className="divide-y divide-border text-sm" data-testid="retail-unpaid">
                {data.unpaid.map((j) => (
                  <li key={j.id}>
                    <CarRow job={j} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarFrontIcon className="size-4 text-primary" /> Logged today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.today.length === 0 ? (
              <p className="text-sm text-muted-foreground">No walk-ins yet today. New job → pick the shop as the location.</p>
            ) : (
              <ul className="divide-y divide-border text-sm" data-testid="retail-today">
                {data.today.map((j) => (
                  <li key={j.id}>
                    <CarRow job={j} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

function CarRow({ job: j }: { job: RetailTodayCar }) {
  return (
    <Link href={`/jobs/${j.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50">
      <div className="min-w-0">
        <div className="font-medium">
          <span className="tracking-wide">{j.tag}</span>
          {j.vehicle && <span className="text-muted-foreground"> · {j.vehicle}</span>}
        </div>
        <div className="truncate text-caption text-subtle">{[j.customer ?? "No customer on file", j.services.join(", ")].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="shrink-0 text-right">
        {j.paid_at ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Collect</Badge>}
        <div className="mt-1 text-caption tabular-nums text-subtle">{formatDate(j.performed_at, "MMM d, h:mm a")}</div>
      </div>
    </Link>
  );
}
