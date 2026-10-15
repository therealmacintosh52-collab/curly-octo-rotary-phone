import { beforeEach, describe, expect, it } from 'vitest';
import { PIPELINE_STAGES, advanceLead, createLead, evaluateMove, loadPipeline, moveStage, nextStages, overrideSource } from '@/lib/admin/pipeline';
import { repo } from '@/lib/db';

const live = { status: 'confirmed' };
beforeEach(async () => { await repo().reset!(); });

describe('evaluateMove rules', () => {
  it('only allows the documented transitions', () => {
    expect(nextStages('new')).toContain('quoted');
    expect(nextStages('reviewed')).toEqual([]);
    expect(evaluateMove('new', 'reviewed', { hasQuote: true, booking: null }).ok).toBe(false);
    expect(evaluateMove('done', 'new', { hasQuote: true, booking: null }).ok).toBe(false);
    expect(evaluateMove('lost', 'new', { hasQuote: false, booking: null }).ok).toBe(true);
  });
  it('quoted needs a quote; booked needs a live booking; done needs a completed booking', () => {
    expect(evaluateMove('new', 'quoted', { hasQuote: false, booking: null }).ok).toBe(false);
    expect(evaluateMove('new', 'quoted', { hasQuote: true, booking: null }).ok).toBe(true);
    expect(evaluateMove('quoted', 'booked', { hasQuote: true, booking: null }).ok).toBe(false);
    expect(evaluateMove('quoted', 'booked', { hasQuote: true, booking: live }).ok).toBe(true);
    expect(evaluateMove('in_progress', 'done', { hasQuote: true, booking: { status: 'in_progress' } }).ok).toBe(false);
    expect(evaluateMove('in_progress', 'done', { hasQuote: true, booking: { status: 'completed' } }).ok).toBe(true);
    const r = evaluateMove('booked', 'in_progress', { hasQuote: true, booking: live });
    expect(r).toEqual({ ok: true, effect: 'start_job' });
  });
  it('lost needs a reason and cannot orphan a live booking', () => {
    expect(evaluateMove('quoted', 'lost', { hasQuote: true, booking: null }).ok).toBe(false);
    expect(evaluateMove('quoted', 'lost', { hasQuote: true, booking: null }, 'too expensive').ok).toBe(true);
    expect(evaluateMove('booked', 'lost', { hasQuote: true, booking: live }, 'x').ok).toBe(false);
  });
  it('stage list is the SPEC order', () => { expect([...PIPELINE_STAGES]).toEqual(['new', 'quoted', 'booked', 'in_progress', 'done', 'reviewed']); });
});

describe('pipeline persistence', () => {
  it('quick-add lead links a customer, reuses on the same phone, and requires a contact', async () => {
    const a = await createLead({ name: 'Dana', phone: '916-555-0188', source: 'door_knock', notes: 'Elk Grove lot' }, 'owner:x');
    const b = await createLead({ name: 'Dana again', phone: '(916) 555 0188', source: 'door_knock' }, 'owner:x');
    expect(a.customer_id).toBe(b.customer_id);
    expect(await repo().customers.list()).toHaveLength(1);
    await expect(createLead({ name: 'Nobody', source: 'google' }, 'o')).rejects.toThrow(/phone/i);
    await expect(createLead({ name: 'Bad', phone: '12', source: 'google' }, 'o')).rejects.toThrow(/valid/i);
  });
  it('moveStage enforces rules, logs events, and refuses stale writes', async () => {
    const db = repo();
    const l = await createLead({ name: 'Dana', phone: '916-555-0188', source: 'google' }, 'owner:x');
    await expect(moveStage(l.id, 'quoted', 'owner:x')).rejects.toThrow(/quote/i);
    await db.quotes.insert({ lead_id: l.id, customer_id: l.customer_id, services: ['interior'], low: 200, high: 230, panels: [], photo_paths: [], mock: false, label: 'x' });
    expect((await moveStage(l.id, 'quoted', 'owner:x')).stage).toBe('quoted');
    await expect(moveStage(l.id, 'lost', 'owner:x')).rejects.toThrow(/why/i);
    expect((await moveStage(l.id, 'lost', 'owner:x', { reason: 'no response' })).stage).toBe('lost');
    const ev = await db.events.list({ where: { type: 'pipeline.stage_changed', entity_id: l.id } });
    expect(ev.map((e) => `${e.data.from}>${e.data.to}`).sort()).toEqual(['new>quoted', 'quoted>lost']);
    const board = await loadPipeline();
    expect(board.lost).toHaveLength(0);
    expect((await loadPipeline({ includeLost: true })).lost).toHaveLength(1);
  });
  it('source override keeps the original and flags it', async () => {
    const l = await createLead({ name: 'Dana', phone: '916-555-0188', source: 'google' }, 'o');
    const o = await overrideSource(l.id, 'referral', 'owner:x');
    expect(o).toMatchObject({ source: 'referral', source_auto: 'google', source_overridden: true });
    expect((await overrideSource(l.id, 'dealer', 'owner:x')).source_auto).toBe('google');
  });
  it('advanceLead is a no-op for missing or same-stage leads', async () => {
    await advanceLead(null, 'done', 'system');
    const l = await createLead({ name: 'D', phone: '916-555-0188', source: 'google' }, 'o');
    await advanceLead(l.id, 'new', 'system');
    await advanceLead(l.id, 'in_progress', 'system');
    expect((await repo().leads.get(l.id))!.stage).toBe('in_progress');
  });
});
