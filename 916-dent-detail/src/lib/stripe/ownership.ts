// Which of our two invoice systems does a Stripe invoice belong to?
//   * dealer net-terms invoices: our invoices row with dealer_id set (src/lib/dealers), handled ONLY by /api/dealers/stripe-webhook
//   * membership subscription invoices: handled ONLY by /api/admin/stripe/webhook
// Both endpoints can be subscribed to invoice.paid (and share one signing secret by fallback), so each one checks ownership and
// ignores the other's invoices instead of relying on "nothing matched" by accident.
import { repo } from '@/lib/db';

export type InvoiceOwner = 'dealer' | 'subscription' | 'other';

export async function invoiceOwner(stripeInvoice: { id?: unknown; subscription?: unknown; parent?: unknown } | null | undefined): Promise<InvoiceOwner> {
  const id = typeof stripeInvoice?.id === 'string' ? stripeInvoice.id : null;
  if (id) {
    const row = await repo().invoices.first({ where: { stripe_invoice_id: id } });
    if (row?.dealer_id) return 'dealer';
  }
  // Stripe puts the subscription on invoice.subscription (older API versions) or invoice.parent.subscription_details (newer)
  const parent = stripeInvoice?.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  if (stripeInvoice?.subscription || parent?.subscription_details?.subscription) return 'subscription';
  return 'other';
}
