import type { Metadata } from 'next';
import { loadByToken, viewFor, BookingError, type BookingView } from '@/lib/booking/service';
import { ManageBooking } from './ManageBooking';
import { site } from '@/config/site';
import { CallLink, TextLink } from '@/components/CtaLinks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Manage your booking',
  robots: { index: false, follow: false, nocache: true },
};

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let view: BookingView | null = null;
  let error: string | null = null;
  try { view = await viewFor(await loadByToken(token)); }
  catch (e) { error = e instanceof BookingError ? e.message : 'We could not load this booking.'; }
  return (
    <>
      <section className="relative overflow-hidden pb-6 pt-28 lg:pt-40">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(201,162,74,0.13),transparent_70%)]" />
        <div className="wrap relative">
          <p className="eyebrow">Your booking</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(1.6rem,4.2vw,3rem)]">Manage your appointment</h1>
        </div>
      </section>
      <div className="wrap pb-40 lg:pb-28">
        {view ? <ManageBooking token={token} initial={view} /> : (
          <div role="alert" className="card max-w-xl p-6">
            <p className="font-semibold text-ivory">{error}</p>
            <p className="mt-2 text-steel">Call or text us and we will sort it out.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <CallLink where="booking_error" className="btn btn-gold">Call {site.phone.display}</CallLink>
              <TextLink where="booking_error" className="btn btn-outline">Text us</TextLink>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
