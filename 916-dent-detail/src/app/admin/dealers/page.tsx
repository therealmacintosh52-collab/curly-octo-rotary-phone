import { ActionButton } from '../_ui/forms';
import { Badge, Card, Empty, PageHeader, Row, Section } from '../_ui';
import { requireOwner } from '@/lib/dealers/owner-guard';
import { asProposals, pendingFor } from '@/lib/dealers/addons';
import { repo } from '@/lib/db';
import { runMonthlyAction } from './_actions';

export const metadata = { title: 'Dealers' };

export default async function DealersAdminPage() {
  await requireOwner();
  const db = repo();
  const [dealers, vehicles] = await Promise.all([db.dealers.list({ orderBy: 'created_at', desc: true }), db.dealer_vehicles.list({})]);
  const stat = (id: string) => {
    const vs = vehicles.filter((v) => v.dealer_id === id);
    return { open: vs.filter((v) => ['submitted', 'quoted', 'approved', 'scheduled', 'in_progress'].includes(v.status)).length, addons: vs.reduce((n, v) => n + pendingFor(asProposals(v.addon_approvals)).length, 0), draft: vs.reduce((n, v) => n + asProposals(v.addon_approvals).filter((a) => a.status === 'draft').length, 0) };
  };
  const groups = [
    { title: 'Waiting for approval', list: dealers.filter((d) => d.status === 'pending') },
    { title: 'Active', list: dealers.filter((d) => d.status === 'active') },
    { title: 'Paused or rejected', list: dealers.filter((d) => d.status === 'paused' || d.status === 'rejected') },
  ];
  return (
    <>
      <PageHeader title="Dealers" eyebrow="Dealer portal" />
      <Section title="Monthly statements" id="monthly">
        <Card className="space-y-3 p-4">
          <p className="text-sm text-[#a9acb3]">Builds last month&apos;s statement for every active dealer (also runs by itself on the 1st). Vehicles without a price are left off until you price them.</p>
          <div className="flex flex-wrap gap-2"><ActionButton action={runMonthlyAction} className="adm-btn adm-btn-gold">Run for last month</ActionButton></div>
        </Card>
      </Section>
      {groups.map((g) => (
        <Section key={g.title} title={`${g.title} (${g.list.length})`} id={g.title.replace(/\W+/g, '-').toLowerCase()}>
          {g.list.length === 0 ? <Empty>None.</Empty> : (
            <Card>
              {g.list.map((d) => {
                const s = stat(d.id);
                return (
                  <Row key={d.id} href={`/admin/dealers/${d.id}`} title={d.name} sub={`${d.contact_name ?? ''} · ${d.email ?? ''}`}
                    right={<span className="flex flex-col items-end gap-1"><Badge tone={d.status === 'active' ? 'green' : d.status === 'pending' ? 'gold' : 'red'}>{d.status}</Badge>{s.open > 0 && <span className="text-xs text-[#a9acb3]">{s.open} open</span>}{s.addons > 0 && <Badge tone="blue">{s.addons} add-on awaiting dealer</Badge>}{s.draft > 0 && <Badge tone="gold">{s.draft} add-on needs price</Badge>}</span>} />
                );
              })}
            </Card>
          )}
        </Section>
      ))}
    </>
  );
}
