// S-13: request bodies are read through a cap that stops the stream, so chunked or mis-declared bodies are never buffered whole.
import { describe, expect, it } from 'vitest';
import { readTextCapped } from '@/lib/security/body';
import { parseJson } from '@/lib/api/http';
import { z } from 'zod';

const streamOf = (chunks: string[], onPull?: (i: number) => void) => {
  let i = 0;
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({ pull(c) { onPull?.(i); if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]!)); else c.close(); } });
};
const chunked = (s: ReadableStream<Uint8Array>) => new Request('http://x/', { method: 'POST', body: s, duplex: 'half' } as RequestInit);

describe('readTextCapped', () => {
  it('returns the text when under the cap, "" for no body, and refuses a declared length over the cap without reading', async () => {
    expect(await readTextCapped(new Request('http://x/', { method: 'POST', body: 'hello' }), 10)).toBe('hello');
    expect(await readTextCapped(new Request('http://x/'), 10)).toBe('');
    const lie = new Request('http://x/', { method: 'POST', body: 'x', headers: { 'content-length': '999' } });
    expect(await readTextCapped(lie, 10)).toBeNull();
  });
  it('stops reading a chunked body as soon as it passes the cap (no content-length to trust)', async () => {
    let pulls = 0;
    const r = chunked(streamOf(Array.from({ length: 1000 }, () => 'x'.repeat(100)), () => { pulls++; }));
    expect(await readTextCapped(r, 450)).toBeNull();
    expect(pulls).toBeLessThan(20); // cancelled after ~5 chunks, not 1000
  });
  it('counts bytes, not characters', async () => {
    expect(await readTextCapped(new Request('http://x/', { method: 'POST', body: 'é'.repeat(10) }), 15)).toBeNull(); // 20 bytes
    expect(await readTextCapped(new Request('http://x/', { method: 'POST', body: 'é'.repeat(10) }), 20)).toBe('é'.repeat(10));
  });
});

describe('parseJson uses it', () => {
  const schema = z.object({ a: z.string() });
  it('413 for an oversized chunked body, 400 for bad JSON, ok for valid', async () => {
    const big = await parseJson(chunked(streamOf(['{"a":"', 'y'.repeat(5000), '"}'])), schema, 1000);
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.res.status).toBe(413);
    const bad = await parseJson(new Request('http://x/', { method: 'POST', body: '{nope' }), schema);
    if (!bad.ok) expect(bad.res.status).toBe(400); else throw new Error('expected failure');
    const good = await parseJson(new Request('http://x/', { method: 'POST', body: '{"a":"b"}' }), schema);
    expect(good.ok && good.data.a).toBe('b');
  });
});
