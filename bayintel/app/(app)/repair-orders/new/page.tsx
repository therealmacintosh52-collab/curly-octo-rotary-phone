import Link from "next/link";
import { Page, Empty } from "@/components/shell/page";
import { RoForm } from "@/components/repair-orders/ro-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New repair order" };

export default async function NewRoPage({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: garage } = await supabase.from("vehicles").select("id, year, make, model, nickname, mileage").order("updated_at", { ascending: false }).limit(100);
  const vehicles = (garage ?? []).map((v) => ({ id: v.id, label: `${v.nickname ? v.nickname + " · " : ""}${v.year} ${v.make} ${v.model}`, mileage: v.mileage }));
  return (
    <Page title="New repair order">
      {vehicles.length ? (
        <RoForm vehicles={vehicles} initial={{ vehicle_id: sp.vehicle }} />
      ) : (
        <Empty title="Add a vehicle first">
          <Link href="/garage" className="text-primary underline">
            Go to the garage
          </Link>
        </Empty>
      )}
    </Page>
  );
}
