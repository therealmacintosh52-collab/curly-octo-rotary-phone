import type { Metadata } from 'next';
import { suggestQuote } from '@/lib/admin/records';
import { repo } from '@/lib/db';
import { requireStaff } from '@/lib/auth/server';
import { createQuoteAction } from '../../../_actions/crm';
import { ActionForm } from '../../../_ui/forms';
import { Field, PageHeader, Section } from '../../../_ui';
import { ServiceChecks, SizeSelect } from '../../../_ui/parts';
import { QuoteSuggest } from './QuoteSuggest';

export const metadata: Metadata = { title: 'New quote' };
export const dynamic = 'force-dynamic';

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ lead?: string; customer?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const lead = sp.lead ? await repo().leads.get(sp.lead) : null;
  const customerId = sp.customer ?? lead?.customer_id ?? '';
  const vehicles = customerId ? await repo().vehicles.list({ where: { customer_id: customerId } }) : [];
  // Suggestions are computed on the server from config so no price is ever typed into the client bundle.
  const sizes = ['compact', 'sedan', 'suv', 'truck', 'xl'];
  const table: Record<string, Record<string, { low: number | null; high: number | null }>> = {};
  for (const sid of ['paint-correction', 'ceramic', 'decon', 'interior', 'pdr', 'hail']) {
    table[sid] = {};
    for (const sz of sizes) { const r = suggestQuote([sid], sz); table[sid]![sz] = { low: r.low, high: r.high }; }
  }
  return (
    <>
      <PageHeader title="New quote" back={{ href: lead ? `/admin/leads/${lead.id}` : '/admin/pipeline', label: 'Back' }} />
      <Section>
        <ActionForm action={createQuoteAction} submit="Save quote">
          <input type="hidden" name="leadId" value={lead?.id ?? ''} />
          <input type="hidden" name="customerId" value={customerId} />
          <ServiceChecks />
          <SizeSelect />
          {vehicles.length > 0 && <Field label="Vehicle" htmlFor="vehicleId"><select id="vehicleId" name="vehicleId" className="adm-input"><option value="">Not specified</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{[v.year, v.make, v.model].filter(Boolean).join(' ')}</option>)}</select></Field>}
          <QuoteSuggest table={table} />
          <Field label="Notes for the customer" htmlFor="notes"><textarea id="notes" name="notes" maxLength={1000} className="adm-input" /></Field>
        </ActionForm>
      </Section>
    </>
  );
}
