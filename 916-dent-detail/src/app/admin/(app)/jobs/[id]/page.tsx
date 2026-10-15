import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { serviceById } from '@/config/booking';
import { forbidden } from '@/lib/admin/api';
import { canAccessTech } from '@/lib/admin/access';
import { moneyRange, vehicleLabel } from '@/lib/admin/format';
import { addonCatalog } from '@/lib/admin/invoice';
import { ensureJobForBooking, loadJobBundle, snapshotFor } from '@/lib/admin/jobs';
import { addressOf } from '@/lib/admin/links';
import { METHOD_LABEL, MANUAL_METHODS } from '@/lib/admin/payments';
import { isStaff } from '@/lib/auth/roles';
import { requireSession } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { travelMinutes } from '@/lib/geo';
import { balanceOf } from '@/lib/memberships';
import { isStripeLive } from '@/lib/stripe';
import { isTerminalConfigured } from '@/lib/stripe/payments';
import { PageHeader } from '../../../_ui';
import { JobPanel } from '../../../_ui/job/JobPanel';

export const metadata: Metadata = { title: 'Job' };
export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession();
  const { id } = await params;
  const db = repo();
  let job = await db.jobs.get(id);
  if (!job) {
    // /admin/jobs/<bookingId> from the route list when a job row does not exist yet
    const b = await db.bookings.get(id);
    if (!b || !canAccessTech(s, b.tech_id)) notFound();
    job = await ensureJobForBooking(b.id);
    redirect(`/admin/jobs/${job.id}`);
  }
  if (!canAccessTech(s, job.tech_id)) { void forbidden; notFound(); }
  const b = await loadJobBundle(job.id);
  const snapshot = await snapshotFor(job.id);
  if (!b || !snapshot) notFound();
  const { booking, customer } = b;
  const tech = booking.tech_id ? await db.techs.get(booking.tech_id) : null;
  const memberships = customer ? await db.memberships.list({ where: { customer_id: customer.id } }) : [];
  const active = memberships.find((m) => m.status === 'active');
  const quote = booking.quote_id ? await db.quotes.get(booking.quote_id) : null;
  const back = isStaff(s.role) ? { href: `/admin/bookings/${booking.id}`, label: 'Booking' } : { href: '/admin/today', label: 'Today' };
  return (
    <>
      <PageHeader title={booking.services.map((x) => serviceById(x)?.plain ?? x).join(' + ')} eyebrow="Job" back={back} actions={isStaff(s.role) && customer ? <Link className="adm-btn adm-btn-line" href={`/admin/customers/${customer.id}`}>Customer</Link> : undefined} />
      <JobPanel
        jobId={job.id} snapshot={snapshot} depositApplied={b.invoice ? b.invoice.deposit_applied : b.math.depositApplied}
        customer={customer ? { name: customer.name, phone: customer.phone ?? null, email: customer.email ?? null, smsOk: customer.sms_opt_in && !customer.sms_opt_out_at } : null}
        vehicle={vehicleLabel(b.vehicle)} address={addressOf(booking)} services={booking.services.map((x) => serviceById(x)?.plain ?? x).join(' + ')}
        customerNotes={booking.customer_notes ?? null} estimate={booking.price_low != null ? moneyRange(booking.price_low, booking.price_high) : ''} needsReview={booking.needs_review && snapshot.math.subtotal <= 0} staff={isStaff(s.role)}
        addons={addonCatalog().map((a) => ({ id: a.id, label: a.label, price: a.price }))}
        photos={b.photos.filter((p) => p.kind === 'before' || p.kind === 'after' || p.kind === 'other').map((p) => ({ id: p.id, kind: p.kind as 'before' | 'after' | 'other', path: p.storage_path, consent: p.marketing_consent }))}
        quotePhotos={quote?.photo_paths ?? []} notes={b.notes.map((n) => ({ id: n.id, body: n.body, at: n.created_at }))} signaturePath={b.job.signature_path ?? null}
        membership={active ? { id: active.id, tier: active.tier, balance: await balanceOf(active.id) } : null}
        methods={MANUAL_METHODS.map((m) => ({ id: m, label: METHOD_LABEL[m] ?? m }))} demo={s.mode === 'demo'} terminal={isTerminalConfigured()} liveStripe={isStripeLive()}
        etaGuess={tech?.home_zip ? travelMinutes(tech.home_zip, booking.zip) : 20}
      />
    </>
  );
}
