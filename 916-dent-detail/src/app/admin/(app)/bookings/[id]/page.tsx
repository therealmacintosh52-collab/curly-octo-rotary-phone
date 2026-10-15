import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serviceById } from '@/config/booking';
import { depositPolicy } from '@/config/booking';
import { fmtDateTime, fmtPhone, moneyRange, money, vehicleLabel } from '@/lib/admin/format';
import { addressOf, appleMapsUrl, mapsUrl } from '@/lib/admin/links';
import { OUTCOME_LABEL, policyPreview } from '@/lib/admin/schedule';
import { requireStaff } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { cancelBookingAction, rescheduleAction } from '../../../_actions/schedule';
import { ActionForm } from '../../../_ui/forms';
import { Badge, Card, Field, KV, PageHeader, Section } from '../../../_ui';
import { ContactButtons, NoteForm, NoteList } from '../../../_ui/parts';
import { SlotPicker } from '../../../_ui/SlotPicker';

export const metadata: Metadata = { title: 'Booking' };
export const dynamic = 'force-dynamic';

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = repo();
  const b = await db.bookings.get(id);
  if (!b) notFound();
  const [customer, vehicle, tech, job, techs, notes, invoice] = await Promise.all([
    b.customer_id ? db.customers.get(b.customer_id) : null, b.vehicle_id ? db.vehicles.get(b.vehicle_id) : null, b.tech_id ? db.techs.get(b.tech_id) : null,
    db.jobs.first({ where: { booking_id: b.id } }), db.techs.list({ where: { active: true }, orderBy: 'name' }),
    db.notes.list({ where: { entity_type: 'booking', entity_id: id }, orderBy: 'created_at', desc: true }), db.invoices.first({ where: { booking_id: id } }),
  ]);
  const editable = b.status === 'confirmed' || b.status === 'pending_deposit';
  const cancellable = editable || b.status === 'on_the_way';
  const policy = policyPreview(b);
  const addr = addressOf(b);
  const banner = sp.created ? 'Booked.' : sp.moved ? 'Rescheduled.' : sp.cancelled ? 'Cancelled.' : '';
  return (
    <>
      <PageHeader title={b.services.map((s) => serviceById(s)?.plain ?? s).join(' + ')} eyebrow={`Booking · ${b.status.replace('_', ' ')}`} back={{ href: '/admin/schedule', label: 'Schedule' }} />
      {banner && <Section><p role="status" className="rounded-xl border border-[#2f6b49] bg-[#0f2017] px-3 py-2 text-sm text-[#a6e8c0]">{banner}</p></Section>}
      <Section>
        <Card>
          <KV items={[
            ['When', fmtDateTime(b.starts_at)], ['Length', `${b.duration_min} min`], ['Tech', tech?.name.replace('[OWNER] ', '') ?? 'Unassigned'],
            ['Customer', customer ? <Link key="c" className="underline underline-offset-4" href={`/admin/customers/${customer.id}`}>{customer.name}</Link> : '—'],
            ['Vehicle', vehicleLabel(vehicle) || '—'], ['Where', addr || '—'], ['Price', moneyRange(b.price_low, b.price_high)],
            ['Deposit', `${money(b.deposit_amount)} · ${b.deposit_status}`], ...(b.needs_review ? [['Review', <Badge key="r" tone="gold">Needs price review</Badge>] as [string, React.ReactNode]] : []),
          ]} />
          {b.customer_notes && <p className="whitespace-pre-wrap border-t border-line px-4 py-3 text-sm">{b.customer_notes}</p>}
          <ContactButtons phone={customer?.phone} email={customer?.email} />
          {addr && <div className="flex gap-2 px-4 pb-4"><a className="adm-btn adm-btn-line flex-1" href={mapsUrl(addr)}>Navigate</a><a className="adm-btn adm-btn-line flex-1" href={appleMapsUrl(addr)}>Apple Maps</a></div>}
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
            {job && <Link className="adm-btn adm-btn-gold flex-1" href={`/admin/jobs/${job.id}`}>Open job</Link>}
            {invoice && <Link className="adm-btn adm-btn-line flex-1" href={`/admin/invoices/${invoice.id}`}>Invoice {invoice.number}</Link>}
          </div>
        </Card>
      </Section>
      {editable && (
        <Section title="Reschedule">
          <Card><div className="p-4">
            <ActionForm action={rescheduleAction} submit="Move booking" className="space-y-4">
              <input type="hidden" name="id" value={b.id} />
              <SlotPicker techs={techs.map((t) => ({ id: t.id, name: t.name }))} fixed={{ services: b.services, addons: b.addons, sizeClass: b.size_class ?? 'sedan', zip: b.zip ?? '' }} excludeBookingId={b.id} defaultTechId={b.tech_id ?? ''} idPrefix="rs" />
              <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" name="notify" defaultChecked className="h-5 w-5 accent-[#c9a24a]" /> Tell the customer (new confirmation and reminders)</label>
              <p className="adm-help">The deposit moves with the booking. Staff moves do not count toward the customer&apos;s reschedule limit ({depositPolicy.maxReschedules}).</p>
            </ActionForm>
          </div></Card>
        </Section>
      )}
      {cancellable && (
        <Section title="Cancel or no-show">
          <Card><div className="p-4">
            <p className="mb-3 text-sm text-[#b9bcc3]">
              {b.deposit_status === 'paid'
                ? <>Policy if the customer cancels now ({Math.max(0, Math.round(policy.hoursBefore))} h before): <strong className="text-ivory">{OUTCOME_LABEL[policy.outcome]}</strong>. You can override it below.</>
                : 'No deposit was paid, so nothing is refunded or kept.'}
            </p>
            <ActionForm action={cancelBookingAction} submit="Cancel booking" submitClass="adm-btn adm-btn-danger w-full" className="space-y-3">
              <input type="hidden" name="id" value={b.id} />
              <Field label="Who is cancelling?" htmlFor="initiatedBy"><select id="initiatedBy" name="initiatedBy" className="adm-input"><option value="customer">Customer asked to cancel</option><option value="us">We are cancelling</option></select></Field>
              <Field label="Deposit" htmlFor="choice"><select id="choice" name="choice" className="adm-input"><option value="policy">Follow the policy</option><option value="refund">Refund in full</option><option value="credit">Keep as credit</option><option value="keep">Keep the deposit</option></select></Field>
              <Field label="Reason" htmlFor="reason"><input id="reason" name="reason" required maxLength={200} className="adm-input" /></Field>
              <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" name="noShow" className="h-5 w-5 accent-[#c9a24a]" /> Customer was a no-show (deposit is kept unless you choose otherwise)</label>
              <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" name="notify" defaultChecked className="h-5 w-5 accent-[#c9a24a]" /> Send the cancellation notice</label>
            </ActionForm>
          </div></Card>
        </Section>
      )}
      <Section title="Notes"><NoteList notes={notes} /><div className="mt-3"><NoteForm entityType="booking" entityId={b.id} path={`/admin/bookings/${b.id}`} /></div></Section>
      <Section><p className="text-xs text-[#8c8f96]">Phone on file: {fmtPhone(customer?.phone) || 'none'}</p></Section>
    </>
  );
}
