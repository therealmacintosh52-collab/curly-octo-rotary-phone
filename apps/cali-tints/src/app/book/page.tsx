import { loadPublicCatalog } from "@/lib/booking/public";
import { loadPublicEstimate } from "@/lib/estimates/public";
import { depositFor } from "@/lib/retail/quote";
import { BookingWizard, type EstimateToBook } from "@/components/retail/booking-wizard";
import { Logo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

/** /book — pick the car size, the services and a time; `?e=<estimate token>` books an approved estimate. */
export default async function BookPage(props: PageProps<"/book">) {
  const sp = await props.searchParams;
  const catalog = await loadPublicCatalog();
  if (!catalog) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <Logo size={56} />
        <h1 className="text-title">Online booking is not set up yet</h1>
        <p className="text-sm text-muted-foreground">Call the shop to book a time.</p>
      </main>
    );
  }
  let estimate: EstimateToBook | null = null;
  if (typeof sp.e === "string") {
    const e = await loadPublicEstimate(sp.e);
    if (e?.status === "accepted") {
      const chosen = e.options.find((o) => o.id === e.selected_option_id);
      const addons = e.addons.filter((a) => a.customer_approved === true);
      estimate = {
        token: sp.e,
        display_number: e.display_number,
        first_name: e.customer.first_name,
        vehicle: e.vehicle?.name ?? null,
        size_class: e.size_class,
        services: [...(chosen?.lines ?? []), ...addons].map((l) => l.name),
        total: e.total ?? 0,
        deposit: e.deposit_required ?? (e.policy ? depositFor(e.total ?? 0, e.policy) : 0),
        duration_minutes: (chosen?.duration_minutes ?? 0) + addons.reduce((s, a) => s + a.duration_minutes, 0),
      };
    }
  }
  return <BookingWizard catalog={catalog} estimate={estimate} />;
}
