import Link from "next/link";
import { Plus } from "lucide-react";
import { Page, Empty } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Repair orders" };

const TONE: Record<string, "muted" | "info" | "success" | "secondary"> = { open: "muted", in_progress: "info", completed: "success", invoiced: "secondary" };

export default async function RepairOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("repair_orders").select("id, ro_number, status, concern, mileage, created_at, fix_id, vehicles(year, make, model, nickname)").order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status as "open");
  const { data: ros } = await q;
  return (
    <Page
      title="Repair orders"
      actions={
        <Button asChild size="sm">
          <Link href="/repair-orders/new">
            <Plus /> New
          </Link>
        </Button>
      }
    >
      <div className="mb-3 flex gap-2 overflow-x-auto text-sm scrollbar-none">
        {["", "open", "in_progress", "completed", "invoiced"].map((s) => (
          <Link key={s} href={s ? `/repair-orders?status=${s}` : "/repair-orders"} className={`shrink-0 rounded-full border px-3 py-1 capitalize ${(status ?? "") === s ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
            {s ? s.replace("_", " ") : "All"}
          </Link>
        ))}
      </div>
      {!ros?.length ? (
        <Empty title="No repair orders">Open one from a vehicle in your garage.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {ros.map((ro) => (
            <li key={ro.id}>
              <Link href={`/repair-orders/${ro.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    RO #{ro.ro_number} · {ro.vehicles ? `${ro.vehicles.nickname ? ro.vehicles.nickname + " · " : ""}${ro.vehicles.year} ${ro.vehicles.make} ${ro.vehicles.model}` : "Vehicle"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ro.concern} · {formatDate(ro.created_at)}
                  </p>
                </div>
                {ro.fix_id && <Badge variant="success">Fix shared</Badge>}
                <Badge variant={TONE[ro.status] ?? "muted"}>{ro.status.replace("_", " ")}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
