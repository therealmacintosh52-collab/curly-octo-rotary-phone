import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { fmtDateTime, money } from '@/lib/admin/format';
import { lineTotal } from '@/lib/admin/invoice';
import { MANUAL_METHODS, METHOD_LABEL, loadInvoiceBundle } from '@/lib/admin/payments';
import { requireStaff } from '@/lib/auth/server';
import { editInvoiceLinesAction, invoicePayLinkAction, recordPaymentAction, voidInvoiceAction } from '../../../_actions/invoices';
import { ActionButton, ActionForm } from '../../../_ui/forms';
import { Badge, Card, Field, KV, PageHeader, Row, Section } from '../../../_ui';
import { invoiceLink } from '@/lib/admin/jobs';

export const metadata: Metadata = { title: 'Invoice' };
export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const b = await loadInvoiceBundle(id);
  if (!b) notFound();
  const { invoice: inv, math, lines, payments } = b;
  const open = inv.status !== 'void';
  return (
    <>
      <PageHeader title={inv.number ?? 'Invoice'} eyebrow={`Invoice · ${inv.status}`} back={{ href: '/admin/invoices', label: 'Invoices' }} />
      <Section>
        <Card>
          <KV items={[
            ['Customer', b.customer ? <Link key="c" className="underline underline-offset-4" href={`/admin/customers/${b.customer.id}`}>{b.customer.name}</Link> : '—'],
            ['Job value', money(math.subtotal)], ['Deposit applied', `−${money(math.depositApplied)}`], ['Due at completion', money(math.total)], ['Paid so far', money(math.paid)],
            ['Balance', <strong key="bal" className={math.balance > 0 ? 'text-gold-light' : 'text-[#8fe0b0]'} data-testid="balance">{money(math.balance)}</strong>],
          ]} />
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
            {b.job && <Link className="adm-btn adm-btn-line flex-1" href={`/admin/jobs/${b.job.id}`}>Job</Link>}
            {inv.booking_id && <a className="adm-btn adm-btn-line flex-1" href={invoiceLink(inv.booking_id)} target="_blank" rel="noreferrer">Customer view</a>}
          </div>
        </Card>
      </Section>
      <Section title="Lines">
        <Card>
          <ActionForm action={editInvoiceLinesAction} submit={open ? 'Save changes' : undefined} className="p-4 space-y-3">
            <input type="hidden" name="invoiceId" value={inv.id} />
            <table className="adm-table">
              <thead><tr><th>Item</th><th className="num">Amount</th><th className="num"><span className="sr-only">Remove</span></th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.label}{l.qty > 1 ? ` × ${l.qty}` : ''}</td>
                    <td className="num">{open && !l.id.startsWith('ref') ? <><label htmlFor={`amt-${l.id}`} className="sr-only">Amount for {l.label}</label><input id={`amt-${l.id}`} name={`amt.${l.id}`} type="number" step="0.01" defaultValue={Math.abs(l.amount)} className="adm-input !min-h-11 !w-24 text-right" /></> : money(lineTotal(l))}</td>
                    <td className="num">{open && !l.id.startsWith('ref') && <label className="inline-flex min-h-11 min-w-11 items-center justify-center"><input type="checkbox" name={`rm.${l.id}`} className="h-5 w-5 accent-[#c9a24a]" aria-label={`Remove ${l.label}`} /></label>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {open && (
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <Field label="Add a line" htmlFor="newLabel"><input id="newLabel" name="newLabel" maxLength={120} className="adm-input" placeholder="e.g. Extra panel (negative for a discount)" /></Field>
                <Field label="Amount" htmlFor="newAmount"><input id="newAmount" name="newAmount" type="number" step="0.01" className="adm-input" /></Field>
              </div>
            )}
          </ActionForm>
        </Card>
      </Section>
      {open && math.balance > 0 && (
        <Section title="Take a payment">
          <Card><div className="space-y-4 p-4">
            <ActionForm action={recordPaymentAction} submit="Record payment" className="space-y-3">
              <input type="hidden" name="invoiceId" value={inv.id} />
              <input type="hidden" name="opId" value={randomUUID()} />
              <Field label="Amount ($)" htmlFor="amount"><input id="amount" name="amount" type="number" step="0.01" min="0.01" max={math.balance} defaultValue={math.balance} required className="adm-input" /></Field>
              <Field label="How they paid" htmlFor="method"><select id="method" name="method" className="adm-input">{MANUAL_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></Field>
              <Field label="Reference (optional)" htmlFor="reference"><input id="reference" name="reference" maxLength={80} className="adm-input" placeholder="Zelle confirmation, check #" /></Field>
            </ActionForm>
            <ActionForm action={invoicePayLinkAction} submit="Create a pay link" submitClass="adm-btn adm-btn-line w-full" className="space-y-2"><input type="hidden" name="invoiceId" value={inv.id} /></ActionForm>
          </div></Card>
        </Section>
      )}
      <Section title="Payments">
        {payments.length === 0 ? <p className="text-sm text-[#a9acb3]">No payments recorded on this invoice yet.</p> : (
          <Card>{payments.map((p) => <Row key={p.id} title={`${money(p.amount)} · ${METHOD_LABEL[p.method ?? 'card'] ?? p.method}`} sub={`${fmtDateTime(p.created_at)}${p.reference ? ` · ${p.reference}` : ''}`} right={<span className="flex gap-1">{p.mock && <Badge>demo</Badge>}<Badge tone={p.status === 'succeeded' ? 'green' : 'red'}>{p.status}</Badge></span>} />)}</Card>
        )}
      </Section>
      {open && payments.every((p) => p.status !== 'succeeded') && (
        <Section><ActionButton action={voidInvoiceAction} hidden={{ invoiceId: inv.id }} confirm="Void this invoice?" className="adm-btn adm-btn-danger">Void invoice</ActionButton></Section>
      )}
    </>
  );
}
