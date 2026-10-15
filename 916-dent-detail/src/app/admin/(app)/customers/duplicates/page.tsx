import type { Metadata } from 'next';
import Link from 'next/link';
import { loadDuplicateGroups } from '@/lib/admin/customers';
import { fmtPhone, fmtDate } from '@/lib/admin/format';
import { requireStaff } from '@/lib/auth/server';
import { mergeCustomersAction } from '../../../_actions/crm';
import { ActionForm } from '../../../_ui/forms';
import { Card, Empty, PageHeader, Section } from '../../../_ui';

export const metadata: Metadata = { title: 'Duplicate customers' };
export const dynamic = 'force-dynamic';

export default async function Duplicates() {
  await requireStaff();
  const groups = await loadDuplicateGroups();
  return (
    <>
      <PageHeader title="Duplicate customers" eyebrow="Same phone or email" back={{ href: '/admin/customers', label: 'Customers' }} />
      {groups.length === 0 && <Section><Empty>No duplicates found. Nice and clean.</Empty></Section>}
      {groups.map((g) => {
        const [keep, ...rest] = g.customers;
        return rest.map((d) => (
          <Section key={`${g.key}-${d.id}`} title={`Same ${g.reason}`}>
            <Card><div className="space-y-3 p-4">
              {[keep!, d].map((c, ix) => (
                <p key={c.id} className="text-sm"><span className="adm-badge mr-2">{ix === 0 ? 'Keep' : 'Merge in'}</span><Link className="font-semibold text-ivory underline underline-offset-4" href={`/admin/customers/${c.id}`}>{c.name}</Link> <span className="text-[#a9acb3]">{fmtPhone(c.phone)} {c.email ?? ''} · added {fmtDate(c.created_at)}</span></p>
              ))}
              <ActionForm action={mergeCustomersAction} submit="Merge" submitClass="adm-btn adm-btn-danger">
                <input type="hidden" name="keepId" value={keep!.id} />
                <input type="hidden" name="dropId" value={d.id} />
                <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" name="confirm" className="h-5 w-5 accent-[#c9a24a]" /> I understand this cannot be undone</label>
              </ActionForm>
            </div></Card>
          </Section>
        ));
      })}
    </>
  );
}
