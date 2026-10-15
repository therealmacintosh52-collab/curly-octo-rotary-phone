// Static checks over the migration SQL (it cannot be executed here). Guards the access model written in tests/rls/rls-intent.md.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TABLE_NAMES } from '@/lib/db/types';

const sql1 = readFileSync('supabase/migrations/0001_init.sql', 'utf8');
const sql2 = readFileSync('supabase/migrations/0002_admin.sql', 'utf8');
const all = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');

describe('migrations vs repo tables', () => {
  it('every repo table is created by some migration', () => {
    for (const t of TABLE_NAMES) expect(all, t).toMatch(new RegExp(`create table public\\.${t}\\b`));
  });
  it('0001 enables RLS + staff policy on all tables in a loop; 0002 does the same explicitly for its new tables', () => {
    expect(sql1).toMatch(/enable row level security/);
    for (const t of ['settings', 'ad_spend', 'membership_visits']) {
      expect(sql2).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
      expect(sql2).toMatch(new RegExp(`create policy staff_all on public\\.${t}`));
    }
    expect(sql2).toMatch(/alter table public\.invoice_counters enable row level security/);
  });
  it('anon can only read active services', () => {
    const anonPolicies = [...all.matchAll(/create policy (\w+) on public\.(\w+)[^;]*?to ([^;]*?) (?:using|with)/gs)].filter((m) => /\banon\b/.test(m[3]!));
    expect(anonPolicies.map((m) => `${m[2]}.${m[1]}`)).toEqual(['services.services_public_read']);
  });
  it('no policy hands a tech write access to money or leads', () => {
    for (const t of ['payments', 'invoices', 'leads', 'quotes', 'memberships', 'referral_credits', 'ad_spend']) {
      const techWrite = new RegExp(`create policy \\w*tech\\w* on public\\.${t} for (insert|update|delete|all)`, 'i');
      expect(all, t).not.toMatch(techWrite);
    }
  });
  it('tech update of bookings/jobs is column-limited and privileged functions are service-role only', () => {
    expect(sql2).toMatch(/create trigger limit_tech_columns before update on public\.bookings/);
    expect(sql2).toMatch(/create trigger limit_tech_columns_jobs before update on public\.jobs/);
    expect(sql2).toMatch(/revoke all on function public\.merge_customers\(uuid, uuid\) from public, anon, authenticated/);
    expect(sql2).toMatch(/grant execute on function public\.merge_customers\(uuid, uuid\) to service_role/);
    expect(sql2).toMatch(/revoke all on function public\.next_invoice_number\(integer\) from public, anon, authenticated/);
  });
  it('merge function covers the same child tables as the mock (src/lib/db/merge.ts)', async () => {
    const { CUSTOMER_FKS } = await import('@/lib/db/merge');
    for (const { table, col } of CUSTOMER_FKS) expect(sql2, `${table}.${col}`).toContain(`array['${table}','${col}']`);
  });
});
