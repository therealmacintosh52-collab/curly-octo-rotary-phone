import type { Metadata } from 'next';
import Link from 'next/link';
import { fmtDate, money } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { balanceOf, plans } from '@/lib/memberships';
import { membershipAdminAction } from '../../_actions/growth';
import { ActionForm } from '../../_ui/forms';
import { Badge, Card, Empty, Field, PageHeader, Section } from '../../_ui';

export const metadata: Metadata = { title: 'Memberships' };
export const dynamic = 'force-dynamic';

export default async function MembershipsPage({ searchParams }: { searchParams: Promise<{ started?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const db = repo();
  const list = await db.memberships.list({ orderBy: 'created_at', desc: true });
  const cust = new Map((await db.customers.list({ whereIn: [{ col: 'id', values: [...new Set(list.map((m) => m.customer_id))] }] })).map((c) => [c.id, c]));
  const rows = await Promise.all(list.map(async (m) => ({ m, bal: await balanceOf(m.id) })));
  const active = rows.filter((r) => r.m.status === 'active' || r.m.status === 'past_due');
  const mrr = active.reduce((s, r) => s + (plans().find((p) => p.id === r.m.tier)?.priceMonthly ?? 0), 0);
  return (
    <>
      <PageHeader title="Memberships" eyebrow={`${active.length} active${mrr ? ` · ${money(mrr)}/mo` : ''}`} />
      {sp.started && <Section><p role="status" className="rounded-xl border border-[#2f6b49] bg-[#0f2017] px-3 py-2 text-sm text-[#a6e8c0]">Checkout complete. The member appears here once Stripe confirms.</p></Section>}
      <Section title="Plans (from config/pricing.ts)">
        <Card>{plans().map((p) => (
          <div key={p.id} className="adm-row"><span className="flex-1"><span className="block font-semibold">{p.name}</span><span className="text-sm text-[#a9acb3]">{p.visitsPerPeriod} visit{p.visitsPerPeriod === 1 ? '' : 's'} per month</span></span>
            <span className="text-right text-sm">{p.priceMonthly === null ? <span className="owner-mark">[OWNER] price</span> : `${money(p.priceMonthly)}/mo`}</span></div>
        ))}</Card>
        <p className="mt-2 text-xs text-[#8c8f96]">Start a membership from a customer&apos;s page. Live mode needs the plan price set first.</p>
      </Section>
      <Section title="Members">
        {rows.length === 0 ? <Empty>No members yet.</Empty> : rows.map(({ m, bal }) => {
          const c = cust.get(m.customer_id);
          return (
            <Card key={m.id} className="mb-3"><div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><Link href={`/admin/customers/${m.customer_id}`} className="font-semibold underline underline-offset-4">{c?.name ?? 'Customer'}</Link><p className="text-sm text-[#a9acb3]">{m.tier} · since {fmtDate(m.started_at)}{m.renews_at ? ` · renews ${fmtDate(m.renews_at)}` : ''}</p></div>
                <span className="flex flex-col items-end gap-1"><Badge tone={m.status === 'active' ? 'green' : m.status === 'cancelled' ? 'neutral' : 'red'}>{m.status.replace('_', ' ')}</Badge>{m.stripe_subscription_id?.startsWith('sub_mock_') && <Badge>demo</Badge>}</span>
              </div>
              <p className="text-sm"><strong data-testid={`credits-${m.id}`}>{bal}</strong> visit credit{bal === 1 ? '' : 's'} left</p>
              {m.status !== 'cancelled' && (
                <div className="grid grid-cols-2 gap-2">
                  {(['use', 'grant', 'portal', 'cancel'] as const).map((op) => (
                    <ActionForm key={op} action={membershipAdminAction} className="contents" submit={{ use: 'Use a visit', grant: 'Grant this month', portal: 'Billing portal', cancel: 'Cancel' }[op]} submitClass={`adm-btn ${op === 'cancel' ? 'adm-btn-danger' : 'adm-btn-line'}`}>
                      <input type="hidden" name="id" value={m.id} /><input type="hidden" name="op" value={op} />
                    </ActionForm>
                  ))}
                </div>
              )}
              {m.status !== 'cancelled' && (
                <ActionForm action={membershipAdminAction} submit="Adjust" submitClass="adm-btn adm-btn-line" className="grid grid-cols-[6rem_1fr_auto] items-end gap-2">
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="op" value="adjust" />
                  <Field label="± visits" htmlFor={`adj-${m.id}`}><input id={`adj-${m.id}`} name="visits" type="number" step="0.5" className="adm-input" /></Field>
                  <Field label="Note" htmlFor={`adjn-${m.id}`}><input id={`adjn-${m.id}`} name="note" maxLength={120} className="adm-input" /></Field>
                </ActionForm>
              )}
            </div></Card>
          );
        })}
      </Section>
    </>
  );
}
