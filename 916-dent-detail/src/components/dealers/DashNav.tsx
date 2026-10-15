'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dealers/dashboard', label: 'Overview', exact: true },
  { href: '/dealers/dashboard/submit', label: 'Submit vehicles' },
  { href: '/dealers/dashboard/vehicles', label: 'Vehicles' },
  { href: '/dealers/dashboard/billing', label: 'Billing' },
];

export function DashNav() {
  const path = usePathname() ?? '';
  return (
    <nav aria-label="Dealer portal" className="mt-6">
      <ul className="dl-tabs">
        {tabs.map((t) => {
          const on = t.exact ? path === t.href : path.startsWith(t.href);
          return <li key={t.href}><Link href={t.href} className="dl-tab" aria-current={on ? 'page' : undefined}>{t.label}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
