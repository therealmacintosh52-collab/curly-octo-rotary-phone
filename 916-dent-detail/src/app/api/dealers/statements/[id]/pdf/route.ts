import { NextResponse } from 'next/server';
import { fail, guard } from '@/lib/api/http';
import { asLines, invoiceTerms } from '@/lib/dealers/statements';
import { statementPdf } from '@/lib/dealers/pdf';
import { getDealerContext } from '@/lib/dealers/session';
import { ownerAllowed } from '@/lib/dealers/owner-guard';
import { repo } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Statement PDF, generated on request. Allowed for the dealer that owns it, or the owner. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guard('dealers.statement.pdf', async () => {
    const { id } = await ctx.params;
    const st = await repo().dealer_statements.get(id);
    if (!st) return fail(404, 'not_found', 'Statement not found.');
    const dealerCtx = await getDealerContext();
    const mine = dealerCtx?.dealer.id === st.dealer_id;
    if (!mine && !(await ownerAllowed())) return fail(dealerCtx ? 404 : 401, dealerCtx ? 'not_found' : 'unauthorized', dealerCtx ? 'Statement not found.' : 'Please sign in.');
    const dealer = await repo().dealers.get(st.dealer_id);
    if (!dealer) return fail(404, 'not_found', 'Statement not found.');
    const invoice = st.invoice_id ? await repo().invoices.get(st.invoice_id) : null;
    const bytes = await statementPdf({ statement: st, lines: asLines(st.line_items), dealer, invoice, termsLabel: invoice?.net_days ? (dealer.net_terms_approved ? `Net ${invoice.net_days}` : 'Due on receipt') : invoiceTerms(dealer).label });
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="916-statement-${st.period_start.slice(0, 7)}.pdf"`, 'Cache-Control': 'private, no-store' },
    });
  });
}
