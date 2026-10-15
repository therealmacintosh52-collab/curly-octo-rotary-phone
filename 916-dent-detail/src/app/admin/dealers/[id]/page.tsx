import { notFound } from 'next/navigation';
import { ActionButton, ActionForm } from '../../_ui/forms';
import { Badge, Card, Empty, Field, KV, PageHeader, Section } from '../../_ui';
import { dealerServices, resolveRate } from '@/lib/dealers/catalog';
import { asProposals } from '@/lib/dealers/addons';
import { money, monthLabel, previousMonth } from '@/lib/dealers/billing';
import { requireOwner } from '@/lib/dealers/owner-guard';
import { nextStatuses, STATUS_LABEL } from '@/lib/dealers/status';
import { asLines, dealerLedger, invoiceTerms } from '@/lib/dealers/statements';
import { describeServices, vehicleLabel } from '@/lib/dealers/vehicles';
import { repo } from '@/lib/db';
import { dealerWholesale } from '@/config/pricing';
import {
  approveAction, generateStatementAction, issueInvoiceAction, markPaidAction, priceAddonAction, proposeAddonAction, ratesAction, statusAction, termsAction,
  vehiclePriceAction, vehicleStatusAction, voidInvoiceAction, withdrawAddonAction,
} from '../_actions';

export const metadata = { title: 'Dealer' };

const when = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : '—');

export default async function DealerAdminDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const db = repo();
  const dealer = await db.dealers.get(id);
  if (!dealer) notFound();
  const [vehicles, ledger] = await Promise.all([db.dealer_vehicles.list({ where: { dealer_id: id }, orderBy: 'created_at', desc: true, limit: 200 }), dealerLedger(id)]);
  const terms = invoiceTerms(dealer);
  const termsValue = dealer.net_terms_approved ? String(dealer.net_terms_days) : '0';
  const select = 'adm-input';
  return (
    <>
      <PageHeader title={dealer.name} eyebrow="Dealer" back={{ href: '/admin/dealers', label: 'All dealers' }} actions={<Badge tone={dealer.status === 'active' ? 'green' : dealer.status === 'pending' ? 'gold' : 'red'}>{dealer.status}</Badge>} />

      <Section title="Account" id="account">
        <Card>
          <KV items={[
            ['Contact', `${dealer.contact_name ?? '—'} · ${dealer.phone ?? 'no phone'}`], ['Email', dealer.email ?? '—'], ['AP email', dealer.ap_email ?? '—'],
            ['License #', dealer.license_number ?? 'none given'], ['Lots', (dealer.lot_addresses ?? []).join('; ') || '—'],
            ['Expected volume', dealer.expected_monthly_volume != null ? `${dealer.expected_monthly_volume} / month` : '—'],
            ['Net terms', `${terms.label}${dealer.net_terms_requested && !dealer.net_terms_approved ? ' (requested)' : ''}`], ['Approved', when(dealer.approved_at)],
          ]} />
        </Card>
        <div className="mt-3 grid gap-3">
          {dealer.status === 'pending' && (
            <Card className="p-4">
              <ActionForm action={approveAction} submit="Approve account" className="space-y-3">
                <input type="hidden" name="id" value={dealer.id} />
                <Field label="Net terms" htmlFor="ap-terms" help="They asked for net terms: pick what you are comfortable with. You can change it later."><select id="ap-terms" name="terms" className={select} defaultValue={dealer.net_terms_requested ? '30' : '0'}><option value="0">Due on receipt (no net terms)</option><option value="15">Net 15</option><option value="30">Net 30</option></select></Field>
                <Field label="Note (private)" htmlFor="ap-note"><input id="ap-note" name="note" className="adm-input" maxLength={300} /></Field>
              </ActionForm>
              <div className="mt-3 flex gap-2"><ActionButton action={statusAction} hidden={{ id: dealer.id, status: 'rejected' }} className="adm-btn adm-btn-danger" confirm="Reject this account request?">Reject</ActionButton></div>
            </Card>
          )}
          {dealer.status === 'active' && <div className="flex flex-wrap gap-2"><ActionButton action={statusAction} hidden={{ id: dealer.id, status: 'paused' }} confirm="Pause this dealer? They can sign in but cannot submit.">Pause account</ActionButton></div>}
          {(dealer.status === 'paused' || dealer.status === 'rejected') && <div className="flex flex-wrap gap-2"><ActionButton action={statusAction} hidden={{ id: dealer.id, status: 'active' }} className="adm-btn adm-btn-gold">Reactivate</ActionButton></div>}
          {dealer.status !== 'pending' && (
            <Card className="p-4">
              <ActionForm action={termsAction} submit="Save net terms" submitClass="adm-btn adm-btn-line">
                <input type="hidden" name="id" value={dealer.id} />
                <Field label="Net terms" htmlFor="nt"><select id="nt" name="terms" className={select} defaultValue={termsValue}><option value="0">Due on receipt (no net terms)</option><option value="15">Net 15</option><option value="30">Net 30</option></select></Field>
              </ActionForm>
            </Card>
          )}
        </div>
      </Section>

      <Section title="Wholesale rates for this dealer" id="rates">
        <Card className="p-4">
          <ActionForm action={ratesAction} submit="Save rates" submitClass="adm-btn adm-btn-line">
            <input type="hidden" name="id" value={dealer.id} />
            <p className="text-sm text-[#a9acb3]">Whole dollars. Blank = use the default in <code>src/config/pricing.ts</code> (all unset today, so vehicles stay unpriced until you set a rate or price each car).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {dealerServices.map((s) => (
                <Field key={s.id} label={`${s.plain} (per ${s.unit})`} htmlFor={`r-${s.id}`} help={resolveRate(s.id, null, dealerWholesale) === null ? 'Default: not set' : `Default: ${money(resolveRate(s.id, null, dealerWholesale) as number)}`}>
                  <input id={`r-${s.id}`} name={s.id} inputMode="decimal" className="adm-input" defaultValue={typeof (dealer.wholesale_pricing as Record<string, unknown>)?.[s.id] === 'number' ? String((dealer.wholesale_pricing as Record<string, number>)[s.id]) : ''} />
                </Field>
              ))}
            </div>
          </ActionForm>
        </Card>
      </Section>

      <Section title={`Vehicles (${vehicles.length})`} id="vehicles">
        {vehicles.length === 0 ? <Empty>No vehicles submitted.</Empty> : (
          <div className="grid gap-3">
            {vehicles.map((v) => {
              const addons = asProposals(v.addon_approvals).filter((a) => a.status !== 'withdrawn');
              const billed = Boolean(v.statement_id);
              return (
                <Card key={v.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ivory">{vehicleLabel(v)}{v.stock_number ? ` · stock ${v.stock_number}` : ''}</p>
                      <p className="break-all font-mono text-xs text-[#a9acb3]">{v.vin}</p>
                      <p className="mt-1 text-sm text-[#b9bcc3]">{describeServices(v.services, v.panels)}{v.notes ? ` · ${v.notes}` : ''}</p>
                    </div>
                    <Badge tone={v.status === 'done' || v.status === 'invoiced' ? 'green' : v.status === 'in_progress' ? 'gold' : v.status === 'cancelled' ? 'red' : 'blue'}>{STATUS_LABEL[v.status]}</Badge>
                  </div>
                  {nextStatuses(v.status).filter((s) => s !== 'invoiced').length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses(v.status).filter((s) => s !== 'invoiced' && !(billed && s === 'in_progress')).map((s) =>
                        s === 'scheduled' ? (
                          <ActionForm key={s} action={vehicleStatusAction} submit="Schedule" submitClass="adm-btn adm-btn-line" className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="id" value={v.id} /><input type="hidden" name="dealerId" value={dealer.id} /><input type="hidden" name="to" value="scheduled" />
                            <Field label="Visit date" htmlFor={`w-${v.id}`}><input id={`w-${v.id}`} name="when" type="date" className="adm-input" /></Field>
                          </ActionForm>
                        ) : (
                          <ActionButton key={s} action={vehicleStatusAction} hidden={{ id: v.id, dealerId: dealer.id, to: s }} className={s === 'done' ? 'adm-btn adm-btn-gold' : 'adm-btn adm-btn-line'}>{s === 'done' ? 'Mark frontline-ready' : `Mark ${STATUS_LABEL[s].toLowerCase()}`}</ActionButton>
                        ))}
                    </div>
                  )}
                  <ActionForm action={vehiclePriceAction} submit="Save price" submitClass="adm-btn adm-btn-line" className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={v.id} /><input type="hidden" name="dealerId" value={dealer.id} />
                    <Field label={`Price for this work (${v.price_source === 'rate_card' ? 'from rate sheet' : v.price == null ? 'not set' : 'set by you'})`} htmlFor={`p-${v.id}`}><input id={`p-${v.id}`} name="price" inputMode="decimal" className="adm-input" defaultValue={v.price ?? ''} disabled={billed} /></Field>
                  </ActionForm>
                  {addons.length > 0 && (
                    <ul className="space-y-2">
                      {addons.map((a) => (
                        <li key={a.id} className="rounded-xl border border-line p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-ivory">{a.label}{a.price != null ? ` · ${money(a.price)}` : ''}</span><Badge tone={a.status === 'approved' ? 'green' : a.status === 'declined' ? 'red' : a.status === 'proposed' ? 'blue' : 'gold'}>{a.status === 'draft' ? 'needs price' : a.status === 'proposed' ? 'waiting for dealer' : a.status}</Badge></div>
                          {(a.status === 'draft' || a.status === 'proposed') && (
                            <ActionForm action={priceAddonAction} submit={a.status === 'draft' ? 'Price and send' : 'Re-price'} submitClass="adm-btn adm-btn-line" className="mt-2 flex flex-wrap items-end gap-2">
                              <input type="hidden" name="id" value={v.id} /><input type="hidden" name="dealerId" value={dealer.id} /><input type="hidden" name="addonId" value={a.id} />
                              <Field label="Price" htmlFor={`ap-${a.id}`}><input id={`ap-${a.id}`} name="price" inputMode="decimal" className="adm-input" defaultValue={a.price ?? ''} /></Field>
                            </ActionForm>
                          )}
                          {a.status !== 'approved' && a.status !== 'declined' && <div className="mt-2 flex"><ActionButton action={withdrawAddonAction} hidden={{ id: v.id, dealerId: dealer.id, addonId: a.id }} className="adm-btn adm-btn-danger">Withdraw</ActionButton></div>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!billed && v.status !== 'cancelled' && (
                    <details>
                      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-gold-light">Propose an add-on</summary>
                      <ActionForm action={proposeAddonAction} submit="Propose" submitClass="adm-btn adm-btn-line" className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="id" value={v.id} /><input type="hidden" name="dealerId" value={dealer.id} />
                        <Field label="What" htmlFor={`pl-${v.id}`}><input id={`pl-${v.id}`} name="label" className="adm-input" maxLength={80} placeholder="Additional panel: right fender" /></Field>
                        <Field label="Price (blank = draft)" htmlFor={`pp-${v.id}`}><input id={`pp-${v.id}`} name="price" inputMode="decimal" className="adm-input" /></Field>
                      </ActionForm>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Statements and invoices" id="billing">
        <Card className="space-y-4 p-4">
          <KV items={[['Balance due', money(ledger.balance)], ['Past due', money(ledger.aging.overdue)], ['Current', money(ledger.aging.current)], ['1-30 / 31-60 / 61-90 / 90+', `${money(ledger.aging.d1_30)} / ${money(ledger.aging.d31_60)} / ${money(ledger.aging.d61_90)} / ${money(ledger.aging.d90plus)}`]]} />
          <ActionForm action={generateStatementAction} submit="Build statement" submitClass="adm-btn adm-btn-line" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="dealerId" value={dealer.id} />
            <Field label="Month (YYYY-MM)" htmlFor="gs-m"><input id="gs-m" name="month" className="adm-input" defaultValue={previousMonth()} pattern="\d{4}-\d{2}" /></Field>
          </ActionForm>
        </Card>
        <div className="mt-3 grid gap-3">
          {ledger.statements.map((s) => {
            const inv = ledger.invoices.find((i) => i.id === s.invoice_id);
            return (
              <Card key={s.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ivory">{monthLabel(s.period_start.slice(0, 7))} · {money(s.total)} · {asLines(s.line_items).length} vehicle(s)</p>
                  <Badge tone={s.status === 'paid' ? 'green' : s.status === 'overdue' ? 'red' : s.status === 'sent' ? 'blue' : 'gold'}>{inv ? `${inv.number} · ${inv.effectiveStatus}` : 'not invoiced'}</Badge>
                </div>
                {s.unpriced_count ? <p className="text-sm text-gold-light">{s.unpriced_count} finished vehicle(s) were left off: no price yet.</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <a className="adm-btn adm-btn-line" href={`/api/dealers/statements/${s.id}/pdf`} download>PDF</a>
                  {s.status === 'open' && s.total > 0 && <ActionButton action={issueInvoiceAction} hidden={{ dealerId: dealer.id, statementId: s.id }} className="adm-btn adm-btn-gold" confirm={`Issue ${terms.label} invoice for ${money(s.total)}? The dealer's AP contact is emailed.`}>Issue invoice ({terms.label})</ActionButton>}
                  {inv && (inv.status === 'sent' || inv.status === 'overdue') && (
                    <>
                      <ActionForm action={markPaidAction} submit="Mark paid" submitClass="adm-btn adm-btn-line" className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="dealerId" value={dealer.id} /><input type="hidden" name="invoiceId" value={inv.id} />
                        <Field label="Method" htmlFor={`m-${inv.id}`}><select id={`m-${inv.id}`} name="method" className="adm-input"><option value="check">Check</option><option value="ach">ACH / wire</option><option value="card">Card</option><option value="cash">Cash</option></select></Field>
                        <Field label="Reference" htmlFor={`rf-${inv.id}`}><input id={`rf-${inv.id}`} name="reference" className="adm-input" maxLength={60} /></Field>
                      </ActionForm>
                      <ActionButton action={voidInvoiceAction} hidden={{ dealerId: dealer.id, invoiceId: inv.id }} className="adm-btn adm-btn-danger" confirm="Void this invoice? The statement opens again so you can fix and reissue it.">Void</ActionButton>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
          {ledger.statements.length === 0 && <Empty>No statements yet.</Empty>}
        </div>
      </Section>
    </>
  );
}
