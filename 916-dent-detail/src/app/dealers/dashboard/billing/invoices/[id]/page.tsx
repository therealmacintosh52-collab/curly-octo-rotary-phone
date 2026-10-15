import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asLines } from '@/lib/dealers/statements';
import { effectiveInvoiceStatus, money } from '@/lib/dealers/billing';
import { getDealerContext } from '@/lib/dealers/session';
import { repo } from '@/lib/db';

export const metadata = { title: 'Invoice' };
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : '—');

/**
 * Invoice detail. In demo mode this page IS the stand-in for the Stripe-hosted invoice page: the id in the URL is either our
 * invoice id or the mock Stripe invoice id (`in_mock_*`, the "hosted link" stored on mock invoices).
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dealer } = (await getDealerContext())!;
  const db = repo();
  const inv = (await db.invoices.get(id)) ?? (await db.invoices.first({ where: { stripe_invoice_id: id } }));
  if (!inv || inv.dealer_id !== dealer.id) notFound();
  const status = effectiveInvoiceStatus(inv.status, inv.due_at);
  const lines = asLines(inv.line_items);
  const live = inv.hosted_invoice_url && !inv.mock;
  return (
    <div className="grid gap-6">
      <div>
        <Link href="/dealers/dashboard/billing" className="inline-flex min-h-11 items-center text-sm text-steel hover:text-gold-light">← Billing</Link>
        <h1 className="mt-1 text-xl">Invoice {inv.number}</h1>
        <p className="mt-1 text-steel">{inv.memo} · due {date(inv.due_at)} · <span className="dl-badge">{status}</span></p>
      </div>
      {inv.mock && <p className="dl-demo" role="note"><strong>DEMO invoice.</strong> In live mode this is a Stripe-hosted invoice with a real payment page. Nothing can be paid here.</p>}
      <div className="dl-card dl-scroll" tabIndex={0} role="region" aria-label="Invoice lines">
        <table className="dl-table">
          <thead><tr><th scope="col">Vehicle</th><th scope="col">Work</th><th scope="col" className="num">Amount</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.vehicle_id}>
                <td className="text-ivory">{l.label}{l.stock_number ? <span className="block text-xs text-steel">stock {l.stock_number}</span> : null}</td>
                <td className="text-steel">{l.description}{l.addons.map((a) => <span key={a.id} className="block text-xs">+ {a.label}: {money(a.amount)}</span>)}</td>
                <td className="num text-ivory">{money(l.total)}</td>
              </tr>
            ))}
            <tr><td colSpan={2} className="text-right font-semibold text-ivory">Total</td><td className="num text-lg font-semibold text-ivory">{money(inv.total)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-3">
        {live && status !== 'paid' && <a href={inv.hosted_invoice_url!} className="dl-btn dl-btn-gold" rel="noreferrer">Pay online (Stripe)</a>}
        {inv.mock && status !== 'paid' && <button type="button" className="dl-btn dl-btn-line" disabled>Pay online (disabled in demo)</button>}
        {inv.statement_id && <a href={`/api/dealers/statements/${inv.statement_id}/pdf`} download className="dl-btn dl-btn-line">Statement PDF</a>}
      </p>
    </div>
  );
}
