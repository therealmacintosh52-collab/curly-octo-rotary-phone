import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serviceById } from '@/config/booking';
import { buildTimeline, loadCustomerBundle } from '@/lib/admin/customers';
import { fmtDateTime, fmtPhone, money, moneyRange, sourceLabel, vehicleLabel } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { balanceOf } from '@/lib/memberships';
import { plans } from '@/lib/memberships';
import { updateCustomerAction } from '../../../_actions/crm';
import { startMembershipAction, generateReferralCodeAction } from '../../../_actions/growth';
import { ActionButton, ActionForm } from '../../../_ui/forms';
import { Badge, Card, Empty, Field, KV, PageHeader, Row, Section } from '../../../_ui';
import { ContactButtons, NoteForm, NoteList, Timeline } from '../../../_ui/parts';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customer' };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dup?: string; merged?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const b = await loadCustomerBundle(id);
  if (!b) notFound();
  const c = b.customer;
  const timeline = buildTimeline(b);
  const svc = (ids: string[]) => ids.map((s) => serviceById(s)?.plain ?? s).join(' + ');
  const vById = new Map(b.vehicles.map((v) => [v.id, v]));
  const memberships = await Promise.all(b.memberships.map(async (m) => ({ m, bal: await balanceOf(m.id) })));
  const active = memberships.find((x) => x.m.status === 'active' || x.m.status === 'past_due');
  const owed = b.invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  return (
    <>
      <PageHeader title={c.name} eyebrow="Customer" back={{ href: '/admin/customers', label: 'Customers' }} />
      {sp.dup && <Section><p role="status" className="rounded-xl border border-[#6d5622] bg-[#1f1a0e] px-3 py-2 text-sm text-gold-light">A customer with that phone or email already exists. <Link className="underline" href="/admin/customers/duplicates">Review duplicates</Link>.</p></Section>}
      {sp.merged && <Section><p role="status" className="rounded-xl border border-[#2f6b49] bg-[#0f2017] px-3 py-2 text-sm text-[#a6e8c0]">Merged. Everything from the duplicate now lives on this record.</p></Section>}
      <Section>
        <Card>
          <div className="flex flex-wrap gap-2 px-4 pt-4">
            {c.sms_opt_in && !c.sms_opt_out_at && <Badge tone="green">Texts OK</Badge>}
            {c.sms_opt_out_at && <Badge tone="red">Replied STOP</Badge>}
            {!c.sms_opt_in && !c.sms_opt_out_at && <Badge>No text consent</Badge>}
            {active && <Badge tone="gold">{active.m.tier} member</Badge>}
            {owed.length > 0 && <Badge tone="red">Owes {money(owed.reduce((s, i) => s + i.total, 0))}</Badge>}
          </div>
          <KV items={[['Phone', fmtPhone(c.phone) || '—'], ['Email', c.email ?? '—'], ['Since', fmtDateTime(c.created_at)]]} />
          <ContactButtons phone={c.phone} email={c.email} />
        </Card>
        <details className="mt-3 adm-card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">Edit contact details</summary>
          <div className="px-4 pb-4">
            <ActionForm action={updateCustomerAction} submit="Save">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Name" htmlFor="e-name"><input id="e-name" name="name" required defaultValue={c.name} className="adm-input" /></Field>
              <Field label="Phone" htmlFor="e-phone"><input id="e-phone" name="phone" type="tel" defaultValue={c.phone ?? ''} className="adm-input" /></Field>
              <Field label="Email" htmlFor="e-email"><input id="e-email" name="email" type="email" defaultValue={c.email ?? ''} className="adm-input" /></Field>
            </ActionForm>
          </div>
        </details>
      </Section>

      <Section title="Vehicles" action={<Link href={`/admin/vehicles/new?customer=${c.id}`} className="text-sm text-gold-light underline underline-offset-4">Add vehicle</Link>}>
        {b.vehicles.length === 0 ? <Empty>No vehicles yet.</Empty> : <Card>{b.vehicles.map((v) => <Row key={v.id} href={`/admin/vehicles/${v.id}`} title={vehicleLabel(v)} sub={[v.size_class, v.vin].filter(Boolean).join(' · ')} />)}</Card>}
      </Section>

      <Section title="Bookings" action={<Link href={`/admin/schedule/new?customer=${c.id}`} className="text-sm text-gold-light underline underline-offset-4">Book a job</Link>}>
        {b.bookings.length === 0 ? <Empty>No bookings.</Empty> : (
          <Card>{b.bookings.slice(0, 8).map((k) => <Row key={k.id} href={`/admin/bookings/${k.id}`} title={svc(k.services)} sub={`${fmtDateTime(k.starts_at)} · ${vehicleLabel(vById.get(k.vehicle_id ?? ''))}`} right={<Badge tone={k.status === 'completed' ? 'green' : k.status === 'cancelled' || k.status === 'expired' || k.status === 'no_show' ? 'red' : 'gold'}>{k.status.replace(/_/g, ' ')}</Badge>} />)}</Card>
        )}
      </Section>

      <Section title="Quotes" action={<Link href={`/admin/quotes/new?customer=${c.id}`} className="text-sm text-gold-light underline underline-offset-4">New quote</Link>}>
        {b.quotes.length === 0 ? <Empty>No quotes.</Empty> : <Card>{b.quotes.slice(0, 5).map((q) => <Row key={q.id} href={`/admin/quotes/${q.id}`} title={moneyRange(q.low, q.high)} sub={`${svc(q.services)} · ${fmtDateTime(q.created_at)}`} right={q.mock ? <Badge>demo</Badge> : undefined} />)}</Card>}
      </Section>

      <Section title="Invoices & payments">
        {b.invoices.length === 0 ? <Empty>No invoices yet.</Empty> : (
          <Card>{b.invoices.map((i) => <Row key={i.id} href={`/admin/invoices/${i.id}`} title={`${i.number ?? 'Invoice'} · ${money(i.subtotal)}`} sub={fmtDateTime(i.created_at)} right={<Badge tone={i.status === 'paid' ? 'green' : i.status === 'void' ? 'neutral' : 'gold'}>{i.status}</Badge>} />)}</Card>
        )}
        {b.payments.length > 0 && (
          <Card className="mt-3">{b.payments.slice(0, 8).map((p) => <Row key={p.id} title={`${p.kind === 'refund' ? '−' : ''}${money(Math.abs(p.amount))} ${p.kind}`} sub={`${p.method ?? 'card'}${p.mock ? ' · demo' : ''} · ${fmtDateTime(p.created_at)}`} />)}</Card>
        )}
      </Section>

      <Section title="Membership">
        {memberships.length === 0 ? (
          <Card><div className="space-y-3 p-4">
            <p className="text-sm text-[#b9bcc3]">No membership. Plans and prices come from <code>config/pricing.ts</code>.</p>
            <ActionForm action={startMembershipAction} submit="Start membership" className="space-y-3">
              <input type="hidden" name="customerId" value={c.id} />
              <Field label="Plan" htmlFor="tier"><select id="tier" name="tier" className="adm-input">{plans().map((p) => <option key={p.id} value={p.id}>{p.name}{p.priceMonthly === null ? ' ([OWNER] price not set)' : ` · $${p.priceMonthly}/mo`}</option>)}</select></Field>
            </ActionForm>
          </div></Card>
        ) : <Card>{memberships.map(({ m, bal }) => <Row key={m.id} href="/admin/memberships" title={`${m.tier} · ${m.status.replace(/_/g, ' ')}`} sub={`${bal} visit credit${bal === 1 ? '' : 's'} left${m.renews_at ? ` · renews ${fmtDateTime(m.renews_at)}` : ''}`} />)}</Card>}
      </Section>

      <Section title="Referral">
        <Card><div className="space-y-3 p-4">
          {b.referralCode ? (
            <>
              <p className="text-sm">Code <strong className="font-mono text-gold-light" data-testid="ref-code">{b.referralCode.code}</strong> · gives and earns {money(b.referralCode.credit_amount)}</p>
              <p className="text-sm text-[#b9bcc3]">Share link: <span className="break-all">/book?ref={b.referralCode.code}</span></p>
              <p className="text-sm text-[#b9bcc3]">{b.credits.filter((x) => x.status === 'available').length} credit(s) available · {b.credits.filter((x) => x.status === 'redeemed').length} redeemed</p>
            </>
          ) : <ActionButton action={generateReferralCodeAction} hidden={{ customerId: c.id }}>Create referral code</ActionButton>}
          {c.referral_code_used && <p className="text-sm text-[#b9bcc3]">Arrived with code <strong>{c.referral_code_used}</strong></p>}
        </div></Card>
      </Section>

      <Section title="Lead history">
        {b.leads.length === 0 ? <Empty>No leads.</Empty> : <Card>{b.leads.map((l) => <Row key={l.id} href={`/admin/leads/${l.id}`} title={sourceLabel(l.source)} sub={fmtDateTime(l.created_at)} right={<Badge>{l.stage.replace(/_/g, ' ')}</Badge>} />)}</Card>}
      </Section>

      <Section title="Notes"><NoteList notes={b.notes} /><div className="mt-3"><NoteForm entityType="customer" entityId={c.id} path={`/admin/customers/${c.id}`} /></div></Section>
      <Section title="Activity"><Timeline entries={timeline} /></Section>
    </>
  );
}
