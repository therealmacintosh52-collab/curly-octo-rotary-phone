'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { loadInvoiceBundle, recordPayment } from '@/lib/admin/payments';
import { loadByToken } from '@/lib/booking/service';
import { repo } from '@/lib/db';
import { isStripeLive } from '@/lib/stripe';
import { createPayLink } from '@/lib/stripe/payments';

/** Customer taps "Pay now". Live: send them to a Stripe-hosted checkout. Mock: DEMO payment recorded immediately. */
export async function payInvoiceAction(token: string): Promise<{ error?: string } | void> {
  let url: string | null = null;
  try {
    const booking = await loadByToken(token);
    const inv = await repo().invoices.first({ where: { booking_id: booking.id } });
    if (!inv) return { error: 'No invoice found.' };
    const b = await loadInvoiceBundle(inv.id);
    if (!b || b.invoice.status === 'void' || !(b.math.balance > 0)) return { error: 'Nothing is due on this invoice.' };
    const h = await headers(); const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const origin = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
    if (!isStripeLive()) {
      await recordPayment({ invoiceId: inv.id, amount: b.math.balance, method: 'stripe_link', actor: 'customer', mock: true, opId: `cust-demo-${inv.id}-${Math.round(b.math.paid * 100)}` });
      return;
    }
    const link = await createPayLink({ amount: b.math.balance, description: `916 Dent & Detail ${inv.number ?? 'invoice'}`, invoiceId: inv.id, bookingId: booking.id, email: b.customer?.email, origin });
    url = link.url;
  } catch (e) {
    return { error: (e as { message?: string }).message?.slice(0, 120) ?? 'That link is not valid.' };
  }
  if (url) redirect(url);
}
