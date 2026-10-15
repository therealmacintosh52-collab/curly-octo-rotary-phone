import type { Metadata } from 'next';
import { site } from '@/config/site';
import { fmtDateLong, money } from '@/lib/admin/format';
import { lineTotal } from '@/lib/admin/invoice';
import { loadInvoiceBundle } from '@/lib/admin/payments';
import { loadByToken } from '@/lib/booking/service';
import { repo } from '@/lib/db';
import { isStripeLive } from '@/lib/stripe';
import { PayButton } from './PayButton';

export const metadata: Metadata = { title: 'Your invoice', robots: { index: false, follow: false, nocache: true } };
export const dynamic = 'force-dynamic';

export default async function InvoicePublic({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let bookingId: string | null = null;
  try { bookingId = (await loadByToken(token)).id; } catch { bookingId = null; }
  const inv = bookingId ? await repo().invoices.first({ where: { booking_id: bookingId } }) : null;
  const b = inv ? await loadInvoiceBundle(inv.id) : null;
  if (!b || b.invoice.status === 'draft') {
    return (
      <div className="wrap py-28">
        <h1 className="font-display text-2xl">Invoice not available</h1>
        <p className="lede mt-4">This link is invalid, has expired, or the job is not finished yet. Please call or text us.</p>
      </div>
    );
  }
  const paid = b.math.balance <= 0;
  return (
    <div className="wrap max-w-xl py-28">
      <p className="eyebrow">{site.name}</p>
      <h1 className="font-display mt-2 text-2xl">Invoice {b.invoice.number}</h1>
      <p className="mt-2 text-steel">{b.job?.finished_at ? fmtDateLong(b.job.finished_at) : ''}</p>
      <div className="card mt-8 p-5">
        <table className="w-full text-sm"><tbody>
          {b.lines.map((l) => <tr key={l.id}><td className="py-1.5 pr-3">{l.label}</td><td className="py-1.5 text-right tabular-nums">{money(lineTotal(l))}</td></tr>)}
          <tr className="border-t border-line"><td className="pt-3 pr-3 text-steel">Job total</td><td className="pt-3 text-right tabular-nums">{money(b.math.subtotal)}</td></tr>
          {b.math.depositApplied > 0 && <tr><td className="py-1 pr-3 text-steel">Deposit paid</td><td className="py-1 text-right tabular-nums">−{money(b.math.depositApplied)}</td></tr>}
          {b.math.paid > 0 && <tr><td className="py-1 pr-3 text-steel">Paid</td><td className="py-1 text-right tabular-nums">−{money(b.math.paid)}</td></tr>}
          <tr className="border-t border-line"><td className="pt-3 pr-3 font-semibold">Balance due</td><td className="pt-3 text-right text-lg font-semibold tabular-nums">{money(Math.max(0, b.math.balance))}</td></tr>
        </tbody></table>
        {paid ? <p className="mt-5 rounded-xl border border-[#2f6b49] bg-[#0f2017] px-3 py-2 text-sm text-[#a6e8c0]">Paid in full. Thank you.</p> : <PayButton token={token} live={isStripeLive()} />}
      </div>
      {site.googleReviewUrl && <p className="mt-8 text-steel">If we earned it, <a className="text-gold-light underline underline-offset-4" href={site.googleReviewUrl}>a short Google review</a> means a lot to a small local team.</p>}
    </div>
  );
}
