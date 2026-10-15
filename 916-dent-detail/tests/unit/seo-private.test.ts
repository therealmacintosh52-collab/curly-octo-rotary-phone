// Private surfaces stay out of search: robots.txt disallows them, the sitemap never lists them, and their pages carry noindex.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('robots.txt', () => {
  const rule = (robots().rules as { userAgent: string; allow: string; disallow: string[] }[])[0]!;
  it('disallows admin, booking links, invoices, api and the dealer private pages', () => {
    for (const p of ['/admin', '/booking/', '/invoice/', '/api/', '/dealers/dashboard', '/dealers/signin']) expect(rule.disallow, p).toContain(p);
  });
  it('keeps the public dealer landing and the booking flow crawlable and points at the sitemap', () => {
    expect(rule.allow).toBe('/');
    for (const p of ['/dealers', '/dealers/signup', '/book']) expect(rule.disallow.some((d) => p.startsWith(d) && d !== '/'), p).toBe(false);
    expect(String(robots().sitemap)).toMatch(/\/sitemap\.xml$/);
  });
});

describe('sitemap', () => {
  const urls = sitemap().map((s) => new URL(s.url).pathname);
  it('never lists a private or API path', () => {
    for (const u of urls) expect(u, u).not.toMatch(/^\/(admin|api|booking|invoice|dealers\/(dashboard|signin))/);
  });
  it('lists the legal pages (the consent banner and booking consent text link to them)', () => {
    expect(urls).toContain('/privacy'); expect(urls).toContain('/terms');
  });
  it('has no duplicates and lists the money pages', () => {
    expect(new Set(urls).size).toBe(urls.length);
    for (const p of ['/', '/book', '/dealers', '/services', '/pricing']) expect(urls).toContain(p);
  });
});

describe('noindex on private pages', () => {
  const read = (f: string) => readFileSync(f, 'utf8');
  it.each([
    'src/app/admin/layout.tsx', 'src/app/booking/[token]/page.tsx', 'src/app/invoice/[token]/page.tsx',
    'src/app/dealers/dashboard/layout.tsx', 'src/app/dealers/signin/page.tsx',
  ])('%s sets robots index:false', (f) => { expect(read(f)).toMatch(/index:\s*false/); });
});

describe('legal pages (templates, not compliance claims)', () => {
  const read = (f: string) => readFileSync(f, 'utf8');
  it('terms carry the SMS program disclosures: frequency, rates, STOP, HELP, not a condition of purchase', () => {
    const t = read('src/app/terms/page.tsx');
    for (const re of [/frequency/i, /rates may apply/i, /\bSTOP\b/, /\bHELP\b/, /not a condition of purchase/i, /REMIND ME/]) expect(t).toMatch(re);
  });
  it('both pages are marked as templates for counsel and never claim legal compliance', () => {
    const frame = read('src/components/LegalPage.tsx');
    expect(frame).toMatch(/Template, not legal advice/);
    expect(frame).toMatch(/counsel/);
    for (const f of ['src/app/privacy/page.tsx', 'src/app/terms/page.tsx', 'src/components/LegalPage.tsx']) expect(read(f), f).not.toMatch(/\b(fully |we are |is )?(TCPA|CCPA|CPRA|GDPR)[- ]compliant\b|complies with/i);
  });
  it('footer and booking consent text link to them', () => {
    expect(read('src/components/Footer.tsx')).toMatch(/href="\/privacy"[\s\S]*href="\/terms"/);
    expect(read('src/app/book/steps/ContactStep.tsx')).toMatch(/\/terms#sms/);
    expect(read('src/app/book/steps/AreaStep.tsx')).toMatch(/\/terms#sms/);
  });
});
