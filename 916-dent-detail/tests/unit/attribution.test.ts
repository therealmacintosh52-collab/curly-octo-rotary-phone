import { describe, expect, it } from 'vitest';
import { deriveSource, parseAttribution } from '@/lib/attribution';
import { redact } from '@/lib/api/log';

describe('attribution', () => {
  it('parses UTMs, click ids, landing page and external referrer only', () => {
    const a = parseAttribution('https://916.test/services/pdr?utm_source=google&utm_medium=cpc&utm_campaign=pdr-sac&gclid=XYZ', 'https://www.google.com/search?q=dent', '916.test');
    expect(a).toMatchObject({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'pdr-sac', gclid: 'XYZ', landing_page: '/services/pdr' });
    expect(a.referrer).toBe('www.google.com/search');
    expect(parseAttribution('https://916.test/', 'https://916.test/book', '916.test').referrer).toBeUndefined();
  });
  it('bounds length of untrusted values', () => {
    expect(parseAttribution(`https://x.test/?utm_source=${'a'.repeat(900)}`, '').utm_source!.length).toBe(200);
  });
  it('maps to lead sources', () => {
    const cases: [Parameters<typeof deriveSource>[0], string][] = [
      [{ gclid: 'x' }, 'google'], [{ utm_source: 'google', utm_medium: 'cpc' }, 'google'], [{ utm_source: 'google', utm_medium: 'gbp' }, 'gbp'], [{ utm_source: 'gmb' }, 'gbp'],
      [{ fbclid: 'x' }, 'meta_ads'], [{ utm_source: 'facebook', utm_medium: 'paid_social' }, 'meta_ads'], [{ utm_source: 'instagram' }, 'instagram'], [{ referrer: 'l.instagram.com/' }, 'instagram'],
      [{ utm_source: 'tiktok' }, 'tiktok'], [{ utm_source: 'doorknock' }, 'door_knock'], [{ utm_source: 'dealer' }, 'dealer'], [{ ref: 'SAM25' }, 'referral'],
      [{ referrer: 'www.google.com/search' }, 'google'], [{ referrer: 'duckduckgo.com/' }, 'organic'], [{}, 'direct'],
    ];
    for (const [a, want] of cases) expect(deriveSource(a), JSON.stringify(a)).toBe(want);
  });
});

describe('log redaction', () => {
  it('never lets PII keys through, even nested', () => {
    const r = redact({ booking: 'b1', contact: { name: 'Sam', phone: '+19165550100', email: 'a@b.c', addressLine: '1 Main', notes: 'gate code 1234' }, photos: ['x'] }) as Record<string, unknown>;
    expect(JSON.stringify(r)).not.toMatch(/Sam|9165550100|a@b\.c|1 Main|1234/);
    expect(r.booking).toBe('b1');
  });
});
