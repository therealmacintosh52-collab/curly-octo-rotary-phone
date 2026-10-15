import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { serviceById, addonDefs } from '@/config/booking';
import { LEAD_SOURCES } from '@/lib/admin/pipeline';
import { searchCustomers } from '@/lib/admin/customers';
import { fmtPhone, sourceLabel } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { createBookingAction } from '../../../_actions/schedule';
import { ActionForm } from '../../../_ui/forms';
import { Card, Field, PageHeader, Row, Section } from '../../../_ui';
import { ServiceChecks, SizeSelect } from '../../../_ui/parts';
import { SlotPicker } from '../../../_ui/SlotPicker';

export const metadata: Metadata = { title: 'Book a job' };
export const dynamic = 'force-dynamic';

export default async function NewBooking({ searchParams }: { searchParams: Promise<{ customer?: string; lead?: string; quote?: string; q?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const db = repo();
  const lead = sp.lead ? await db.leads.get(sp.lead) : null;
  const quote = sp.quote ? await db.quotes.get(sp.quote) : null;
  const customerId = sp.customer ?? lead?.customer_id ?? quote?.customer_id ?? '';
  const customer = customerId ? await db.customers.get(customerId) : null;

  if (!customer && !lead) {
    const list = await searchCustomers(sp.q ?? '', 20);
    return (
      <>
        <PageHeader title="Book a job" eyebrow="Who is it for?" back={{ href: '/admin/schedule', label: 'Schedule' }} />
        <Section>
          <form role="search" action="/admin/schedule/new" className="flex gap-2">
            <label htmlFor="q" className="sr-only">Search customers</label>
            <input id="q" name="q" type="search" defaultValue={sp.q ?? ''} placeholder="Name, phone or email" className="adm-input" autoComplete="off" />
            <button className="adm-btn adm-btn-line" type="submit">Search</button>
          </form>
        </Section>
        <Section title="Pick a customer">
          <Card>{list.map((c) => <Row key={c.id} href={`/admin/schedule/new?customer=${c.id}`} title={c.name} sub={[fmtPhone(c.phone), c.email].filter(Boolean).join(' · ')} />)}</Card>
          <p className="mt-3 text-sm"><Link href="/admin/customers/new" className="text-gold-light underline underline-offset-4">New customer</Link></p>
        </Section>
      </>
    );
  }
  const vehicles = customer ? await db.vehicles.list({ where: { customer_id: customer.id } }) : [];
  const techs = (await db.techs.list({ where: { active: true }, orderBy: 'name' })).map((t) => ({ id: t.id, name: t.name }));
  const name = customer?.name ?? lead?.name ?? 'Customer';
  const preServices = quote?.services ?? [];
  return (
    <>
      <PageHeader title="Book a job" eyebrow={name} back={{ href: lead ? `/admin/leads/${lead.id}` : customer ? `/admin/customers/${customer.id}` : '/admin/schedule', label: 'Back' }} />
      {quote && <Section><p className="text-sm text-[#b9bcc3]">From the quote: {quote.services.map((s) => serviceById(s)?.plain ?? s).join(' + ')}. The dent price range carries over to the booking.</p></Section>}
      <Section>
        <ActionForm action={createBookingAction} submit="Book it" className="space-y-5">
          <input type="hidden" name="customerId" value={customer?.id ?? ''} />
          <input type="hidden" name="leadId" value={lead?.id ?? ''} />
          <input type="hidden" name="quoteId" value={quote?.id ?? ''} />
          <input type="hidden" name="key" value={randomUUID()} />
          <ServiceChecks selected={preServices} />
          <fieldset>
            <legend className="adm-label">Add-ons</legend>
            <div className="grid gap-2">{addonDefs.map((a) => <label key={a.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-[#101113] px-3 text-sm"><input type="checkbox" name="addons" value={a.id} className="h-5 w-5 accent-[#c9a24a]" />{a.label}</label>)}</div>
          </fieldset>
          <SizeSelect value={quote?.size_class ?? vehicles[0]?.size_class ?? 'sedan'} />
          {vehicles.length > 0 && <Field label="Vehicle" htmlFor="vehicleId"><select id="vehicleId" name="vehicleId" defaultValue={quote?.vehicle_id ?? vehicles[0]?.id} className="adm-input"><option value="">Add a new one below</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{[v.year, v.make, v.model].filter(Boolean).join(' ')}</option>)}</select></Field>}
          <details className="adm-card" open={vehicles.length === 0}>
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">New vehicle</summary>
            <div className="grid grid-cols-3 gap-3 px-4 pb-4">
              <Field label="Year" htmlFor="vYear"><input id="vYear" name="vYear" type="number" inputMode="numeric" className="adm-input" /></Field>
              <Field label="Make" htmlFor="vMake"><input id="vMake" name="vMake" className="adm-input" /></Field>
              <Field label="Model" htmlFor="vModel"><input id="vModel" name="vModel" className="adm-input" /></Field>
            </div>
          </details>
          <Field label="Job ZIP" htmlFor="zip" help="Sets travel time and fee."><input id="zip" name="zip" inputMode="numeric" pattern="\d{5}" maxLength={5} required defaultValue={lead?.zip ?? ''} className="adm-input" /></Field>
          <Field label="Job address" htmlFor="addressLine"><input id="addressLine" name="addressLine" required maxLength={120} className="adm-input" autoComplete="off" /></Field>
          <SlotPicker techs={techs} />
          {!lead && <Field label="Lead source" htmlFor="source" help="How this customer found you (used in reports)."><select id="source" name="source" defaultValue="direct" className="adm-input">{LEAD_SOURCES.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}</select></Field>}
          <fieldset className="space-y-2">
            <legend className="adm-label">Deposit</legend>
            <label className="flex min-h-12 items-center gap-3 text-sm"><input type="radio" name="deposit" value="none" defaultChecked className="h-5 w-5 accent-[#c9a24a]" /> No deposit</label>
            <label className="flex min-h-12 items-center gap-3 text-sm"><input type="radio" name="deposit" value="collected" className="h-5 w-5 accent-[#c9a24a]" /> Deposit already collected</label>
            <select name="depositMethod" aria-label="How the deposit was collected" className="adm-input"><option value="cash">Cash</option><option value="zelle">Zelle</option><option value="card_phone">Card on phone</option><option value="check">Check</option></select>
          </fieldset>
          <label className="flex min-h-12 items-start gap-3 text-sm"><input type="checkbox" name="notify" defaultChecked={!!customer?.sms_opt_in || !!customer?.email} className="mt-1 h-5 w-5 accent-[#c9a24a]" /><span>Send the confirmation and reminders (email always; texts only if they opted in)</span></label>
          <Field label="Notes for the tech" htmlFor="notes"><textarea id="notes" name="notes" maxLength={500} className="adm-input" placeholder="Gate code, where to park…" /></Field>
        </ActionForm>
      </Section>
    </>
  );
}
