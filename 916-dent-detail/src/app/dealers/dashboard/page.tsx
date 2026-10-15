import Link from 'next/link';
import { BOARD_COLUMNS } from '@/lib/dealers/status';
import { asProposals, pendingFor } from '@/lib/dealers/addons';
import { getDealerContext } from '@/lib/dealers/session';
import { dealerLedger } from '@/lib/dealers/statements';
import { countsByColumn, listVehicles } from '@/lib/dealers/vehicles';
import { money } from '@/lib/dealers/billing';
import { repo } from '@/lib/db';

export default async function DashboardHome() {
  const ctx = (await getDealerContext())!;
  const { dealer } = ctx;
  if (dealer.status !== 'active') {
    return (
      <section className="dl-card p-6 sm:p-9" aria-labelledby="pending-h">
        <h1 id="pending-h" className="text-xl">{dealer.status === 'pending' ? 'Your account is waiting for approval' : 'Your account is not active'}</h1>
        <p className="mt-3 max-w-prose text-steel">
          {dealer.status === 'pending'
            ? 'We review every dealer account by hand. You will get an email at the address you signed up with as soon as it is approved, and then you can submit vehicles.'
            : 'Please contact us to reactivate it.'}
        </p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-steel">Business</dt><dd className="text-ivory">{dealer.name}</dd></div>
          <div><dt className="text-steel">Contact</dt><dd className="text-ivory">{dealer.contact_name} · {dealer.email}</dd></div>
          <div><dt className="text-steel">Accounts payable</dt><dd className="text-ivory">{dealer.ap_email}</dd></div>
          <div><dt className="text-steel">Lots</dt><dd className="text-ivory">{(dealer.lot_addresses ?? []).join('; ') || '—'}</dd></div>
        </dl>
      </section>
    );
  }
  const [counts, recent, ledger] = await Promise.all([countsByColumn(dealer.id), listVehicles(dealer.id, { limit: 6 }), dealerLedger(dealer.id)]);
  const waiting = (await repo().dealer_vehicles.list({ where: { dealer_id: dealer.id } }))
    .flatMap((v) => pendingFor(asProposals(v.addon_approvals)).map((a) => ({ v, a })));
  return (
    <div className="grid gap-8">
      <h1 className="sr-only">Overview</h1>
      {waiting.length > 0 && (
        <section aria-labelledby="need-h" className="rounded-3xl border border-[#6d5622] bg-[#1f1a0e] p-5 sm:p-6">
          <h2 id="need-h" className="text-base text-gold-light">Needs your approval ({waiting.length})</h2>
          <ul className="mt-3 grid gap-3">
            {waiting.slice(0, 5).map(({ v, a }) => (
              <li key={a.id}>
                <Link href={`/dealers/dashboard/vehicles/${v.id}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-1 py-1 text-ivory hover:text-gold-light">
                  <span><strong>{v.stock_number ? `Stock ${v.stock_number}` : `VIN …${v.vin?.slice(-6)}`}</strong>: {a.label}</span>
                  <span className="tabular-nums text-gold-light">{money(a.price ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="status-h">
        <h2 id="status-h" className="sr-only">Vehicles by status</h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {BOARD_COLUMNS.map((c) => (
            <li key={c.key}>
              <Link href={`/dealers/dashboard/vehicles?status=${c.key}`} className="dl-card block p-5 transition-colors hover:border-gold-deep">
                <span className="block text-3xl tabular-nums text-ivory">{counts[c.key] ?? 0}</span>
                <span className="mt-1 block text-sm text-steel">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="recent-h" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-h" className="text-base">Recent vehicles</h2>
          <Link href="/dealers/dashboard/submit" className="dl-btn dl-btn-gold dl-btn-sm">Submit vehicles</Link>
        </div>
        {recent.length === 0 ? (
          <p className="dl-card p-6 text-steel">No vehicles yet. <Link href="/dealers/dashboard/submit" className="text-gold-light underline underline-offset-4">Submit your first one</Link>, or paste a whole list from a CSV.</p>
        ) : (
          <ul className="dl-card divide-y divide-line">
            {recent.map((v) => (
              <li key={v.id}>
                <Link href={`/dealers/dashboard/vehicles/${v.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-white/5">
                  <span><span className="font-semibold text-ivory">{v.label}</span>{v.stock_number && <span className="text-steel"> · stock {v.stock_number}</span>}</span>
                  <span className="dl-badge">{v.statusLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {ledger.invoices.length > 0 && (
        <section aria-labelledby="bal-h" className="dl-card p-5 sm:p-6">
          <h2 id="bal-h" className="text-base">Balance</h2>
          <p className="mt-2 text-3xl tabular-nums text-ivory">{money(ledger.balance)}</p>
          <p className="mt-1 text-sm text-steel">{ledger.aging.overdue > 0 ? `${money(ledger.aging.overdue)} is past due.` : 'Nothing is past due.'} <Link href="/dealers/dashboard/billing" className="text-gold-light underline underline-offset-4">Billing details</Link></p>
        </section>
      )}
    </div>
  );
}
