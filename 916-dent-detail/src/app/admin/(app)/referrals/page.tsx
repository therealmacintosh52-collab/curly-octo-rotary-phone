import type { Metadata } from 'next';
import Link from 'next/link';
import { referralCredit } from '@/config/pricing';
import { fmtDate, money } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { repo } from '@/lib/db';
import { referralAdminAction } from '../../_actions/growth';
import { ActionForm } from '../../_ui/forms';
import { Badge, Card, Empty, PageHeader, Section, Stat } from '../../_ui';

export const metadata: Metadata = { title: 'Referrals' };
export const dynamic = 'force-dynamic';

export default async function ReferralsPage() {
  await requireStaff();
  const db = repo();
  const [codes, credits] = await Promise.all([db.referral_codes.list({ orderBy: 'created_at', desc: true }), db.referral_credits.list({ orderBy: 'created_at', desc: true, limit: 100 })]);
  const ids = [...new Set([...codes.map((c) => c.customer_id), ...credits.map((c) => c.referred_customer_id)].filter((x): x is string => !!x))];
  const cust = new Map((await db.customers.list({ whereIn: [{ col: 'id', values: ids }] })).map((c) => [c.id, c]));
  const codeById = new Map(codes.map((c) => [c.id, c]));
  const liability = credits.filter((c) => c.status === 'available').reduce((s, c) => s + c.amount, 0);
  return (
    <>
      <PageHeader title="Referrals" eyebrow={`${money(referralCredit)} for you and a friend (config)`} />
      <Section>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Credit owed" value={money(liability)} sub="available, not yet used" />
          <Stat label="Redeemed" value={money(credits.filter((c) => c.status === 'redeemed').reduce((s, c) => s + c.amount, 0))} sub={`${credits.filter((c) => c.status === 'redeemed').length} credits`} />
        </div>
      </Section>
      <Section title="Codes">
        {codes.length === 0 ? <Empty>No codes yet. Create one from a customer page.</Empty> : (
          <Card>{codes.map((c) => (
            <div key={c.id} className="adm-row">
              <span className="min-w-0 flex-1"><span className="block font-mono font-semibold text-gold-light">{c.code}</span><Link href={`/admin/customers/${c.customer_id}`} className="truncate text-sm text-[#b9bcc3] underline underline-offset-4">{cust.get(c.customer_id ?? '')?.name ?? 'Customer'}</Link></span>
              <Badge tone={c.active ? 'green' : 'neutral'}>{c.active ? 'active' : 'off'}</Badge>
              <ActionForm action={referralAdminAction} className="contents" submit={c.active ? 'Turn off' : 'Turn on'} submitClass="adm-btn adm-btn-line"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value={c.active ? 'deactivate' : 'activate'} /></ActionForm>
            </div>
          ))}</Card>
        )}
      </Section>
      <Section title="Credit ledger">
        {credits.length === 0 ? <Empty>No credits earned yet. A credit is earned when a referred customer&apos;s first job is finished.</Empty> : (
          <Card>{credits.map((c) => {
            const owner = cust.get(codeById.get(c.referral_code_id)?.customer_id ?? '');
            return (
              <div key={c.id} className="adm-row">
                <span className="min-w-0 flex-1"><span className="block font-semibold">{money(c.amount)} · {owner?.name ?? 'Referrer'}</span><span className="text-sm text-[#a9acb3]">referred {cust.get(c.referred_customer_id ?? '')?.name ?? 'a customer'} · {fmtDate(c.created_at)}</span></span>
                <Badge tone={c.status === 'available' ? 'gold' : c.status === 'redeemed' ? 'green' : 'neutral'}>{c.status}</Badge>
                {c.status === 'available' && <ActionForm action={referralAdminAction} className="contents" submit="Void" submitClass="adm-btn adm-btn-line"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="void_credit" /></ActionForm>}
              </div>
            );
          })}</Card>
        )}
      </Section>
    </>
  );
}
