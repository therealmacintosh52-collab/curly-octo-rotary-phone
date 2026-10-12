import { BookingWizard, type EstimateToBook } from "@/components/retail/booking-wizard";
import { ESTIMATE_TOKEN, estimatePublicFixture, publicCatalogFixture } from "@/test/retail-fixtures";

/** Fixture preview of the public booking page (`/book` in the guest demo). Nothing is held. */
export default async function DevBookPreview(props: PageProps<"/dev/preview/retail/book">) {
  const sp = await props.searchParams;
  let estimate: EstimateToBook | null = null;
  if (sp.e === ESTIMATE_TOKEN) {
    const e = estimatePublicFixture(ESTIMATE_TOKEN)!;
    const chosen = e.options[1];
    estimate = { token: ESTIMATE_TOKEN, display_number: e.display_number, first_name: e.customer.first_name, vehicle: e.vehicle?.name ?? null, size_class: e.size_class, services: [...chosen.lines, ...e.addons.filter((a) => a.default_on)].map((l) => l.name), total: e.total ?? 0, deposit: e.deposit_required ?? 0, duration_minutes: chosen.duration_minutes + 45 };
  }
  return <BookingWizard catalog={publicCatalogFixture()} estimate={estimate} demo />;
}
