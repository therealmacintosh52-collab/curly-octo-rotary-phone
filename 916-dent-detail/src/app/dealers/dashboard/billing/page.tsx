import Link from 'next/link';
import { money, monthLabel } from '@/lib/dealers/billing';
import { getDealerContext } from '@/lib/dealers/session';
import { dealerLedger, invoiceTerms } from '@/lib/dealers/statements';

export const metadata = { title: 'Billing' };

const TONE: Record<string, string> = { paid: 'dl-badge-green', overdue: 'dl-badge-red', void: '', sent: 'dl-badge-blue', open: 'dl-badge-gold', draft: '' };
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : '—');

export default async function BillingPage() {
  const { dealer } = (await getDealerContext())!;
  const ledger = await dealerLedger(dealer.id);
  const terms = invoiceTerms(dealer);
  const a = ledger.aging;
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-xl">Billing</h1>
        <p className="mt-2 text-steel">One statement per month. Terms: <strong className="text-ivory">{terms.label}</strong>{dealer.net_terms_approved ? ' (approved)' : dealer.net_terms_requested ? ' (net terms requested: waiting for our approval)' : ' (net terms are approved by us on request)'}.</p>
      </div>

      <section aria-labelledby="bal-h" className="grid gap-4">
        <h2 id="bal-h" className="sr-only">Balance and aging</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="dl-card p-5"><p className="text-sm text-steel">Balance due</p><p className="mt-1 text-3xl tabular-nums text-ivory">{money(ledger.balance)}</p></div>
          <div className="dl-card p-5"><p className="text-sm text-steel">Past due</p><p className={`mt-1 text-3xl tabular-nums ${a.overdue > 0 ? 'text-[#f4a9a9]' : 'text-ivory'}`}>{money(a.overdue)}</p></div>
          <div className="dl-card p-5"><p className="text-sm text-steel">Current</p><p className="mt-1 text-3xl tabular-nums text-ivory">{money(a.current)}</p></div>
        </div>
        <div className="dl-card dl-scroll">
          <table className="dl-table">
            <caption className="px-4 pt-4 text-sm font-semibold text-ivory">Aging (days past due)</caption>
            <thead><tr><th scope="col">Current</th><th scope="col" className="num">1-30</th><th scope="col" className="num">31-60</th><th scope="col" className="num">61-90</th><th scope="col" className="num">90+</th><th scope="col" className="num">Total</th></tr></thead>
            <tbody><tr><td className="tabular-nums">{money(a.current)}</td><td className="num">{money(a.d1_30)}</td><td className="num">{money(a.d31_60)}</td><td className="num">{money(a.d61_90)}</td><td className="num">{money(a.d90plus)}</td><td className="num font-semibold text-ivory">{money(a.total)}</td></tr></tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="st-h" className="grid gap-3">
        <h2 id="st-h" className="text-base">Monthly statements</h2>
        {ledger.statements.length === 0 ? <p className="dl-card p-6 text-steel">Your first statement appears after the first month with finished, priced work.</p> : (
          <div className="dl-card dl-scroll">
            <table className="dl-table">
              <thead><tr><th scope="col">Month</th><th scope="col" className="num">Vehicles</th><th scope="col" className="num">Total</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Download</span></th></tr></thead>
              <tbody>
                {ledger.statements.map((s) => {
                  const inv = ledger.invoices.find((i) => i.id === s.invoice_id);
                  const status = inv ? inv.effectiveStatus : s.status;
                  return (
                    <tr key={s.id}>
                      <th scope="row" className="!border-b !border-[#202227] !text-sm !font-semibold !normal-case !tracking-normal !text-ivory">{monthLabel(s.period_start.slice(0, 7))}</th>
                      <td className="num">{s.vehicle_count ?? 0}</td>
                      <td className="num font-semibold text-ivory">{money(s.total)}</td>
                      <td><span className={`dl-badge ${TONE[status] ?? ''}`}>{status === 'open' ? 'Not yet invoiced' : status}</span></td>
                      <td><a href={`/api/dealers/statements/${s.id}/pdf`} className="dl-btn dl-btn-line dl-btn-sm" download aria-label={`Download PDF statement for ${monthLabel(s.period_start.slice(0, 7))}`}>PDF</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="inv-h" className="grid gap-3">
        <h2 id="inv-h" className="text-base">Invoices</h2>
        {ledger.invoices.length === 0 ? <p className="dl-card p-6 text-steel">No invoices yet.</p> : (
          <div className="dl-card dl-scroll">
            <table className="dl-table">
              <thead><tr><th scope="col">Invoice</th><th scope="col">Due</th><th scope="col" className="num">Amount</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {ledger.invoices.map((i) => (
                  <tr key={i.id}>
                    <th scope="row" className="!border-b !border-[#202227] !text-sm !font-semibold !normal-case !tracking-normal"><Link href={`/dealers/dashboard/billing/invoices/${i.id}`} className="text-gold-light underline underline-offset-4">{i.number ?? i.id.slice(0, 8)}</Link></th>
                    <td className="text-steel">{date(i.due_at)}</td>
                    <td className="num font-semibold text-ivory">{money(i.total)}</td>
                    <td><span className={`dl-badge ${TONE[i.effectiveStatus] ?? ''}`}>{i.effectiveStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
