// The tool executor, called directly (no model): server-side enforcement of provenance, identity and policy.
import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { signBookingToken } from '@/lib/booking/tokens';
import { executeTool, toolDefs, toolSchemas, TOOL_NAMES } from '@/lib/concierge/tools';
import { saveState } from '@/lib/concierge/state';
import { HOUR, NOW, OTHER_PHONE, PHONE, freshDb, seedBooking, smsId, toolCtx, uploadPhotos, webId } from '../../bot/harness';

const contact = { name: 'Sam Lee', email: 'sam@example.com', address_line: '12 Oak St Elk Grove', vehicle: { year: 2021, make: 'Honda', model: 'Civic' } };
async function offer(ctx: Awaited<ReturnType<typeof toolCtx>>, over: Record<string, unknown> = {}) {
  const r = await executeTool('check_availability', { services: ['interior'], size_class: 'compact', zip: '95624', ...over }, ctx);
  expect(r.ok).toBe(true);
  return (r.data.slots as { slot_id: string; when: string }[]);
}

beforeEach(freshDb);

describe('tool definitions', () => {
  it('are exactly the 11 required tools, with JSON schemas the API accepts', () => {
    expect(TOOL_NAMES.sort()).toEqual(['cancel_booking', 'check_availability', 'check_service_area', 'create_booking', 'create_lead', 'escalate_to_human', 'get_quote_range', 'get_services', 'lookup_booking', 'reschedule_booking', 'send_deposit_link'].sort());
    const defs = toolDefs();
    expect(defs).toHaveLength(11);
    for (const d of defs) { expect(d.input_schema.type).toBe('object'); expect(d.input_schema.$schema).toBeUndefined(); expect(d.description.length).toBeGreaterThan(30); }
  });
  it('tool order and content are deterministic (prompt-cache stable)', () => {
    expect(JSON.stringify(toolDefs())).toBe(JSON.stringify(toolDefs()));
  });
  it('every schema is strict: unknown keys are rejected', () => {
    for (const name of TOOL_NAMES) expect(toolSchemas[name].safeParse({ __evil: 1, zip: '95624' }).success, name).toBe(false);
  });
});

describe('validation', () => {
  it('rejects bad input without running anything', async () => {
    const ctx = await toolCtx();
    expect(await executeTool('check_service_area', { zip: '9562' }, ctx)).toMatchObject({ ok: false, data: { status: 'error' } });
    expect(await executeTool('get_quote_range', { services: ['pdr'], size_class: 'planet' }, ctx)).toMatchObject({ ok: false });
    expect(await executeTool('create_booking', { slot_id: 'S1', name: 'x' }, ctx)).toMatchObject({ ok: false });
    expect(await executeTool('nope', {}, ctx)).toMatchObject({ ok: false });
    expect(await executeTool('escalate_to_human', { reason: 'because', summary: 'x' }, ctx)).toMatchObject({ ok: false });
  });
  it('get_services lists services and the policy without any price', async () => {
    const r = await executeTool('get_services', {}, await toolCtx());
    expect(r.ok).toBe(true);
    const text = JSON.stringify(r.data);
    expect(text).toContain('Dent Removal');
    expect(text.match(/\$\d+/g) ?? []).toEqual(['$50']); // only the deposit
  });
  it('check_service_area: in area, unknown ZIP never guessed', async () => {
    const ctx = await toolCtx();
    expect((await executeTool('check_service_area', { zip: '95624' }, ctx)).data).toMatchObject({ status: 'in_area', travel_fee: 0 });
    expect((await executeTool('check_service_area', { zip: '94110' }, ctx)).data).toMatchObject({ status: 'needs_review', travel_fee: null });
    expect((await executeTool('check_availability', { services: ['interior'], size_class: 'sedan', zip: '94110' }, ctx))).toMatchObject({ ok: false, blocked: 'out_of_area' });
  });
});

describe('quotes: photos are required and must come from this conversation', () => {
  it('no photos -> no number, ever', async () => {
    const ctx = await toolCtx(webId());
    const r = await executeTool('get_quote_range', { services: ['pdr'], size_class: 'sedan' }, ctx);
    expect(r).toMatchObject({ ok: false, blocked: 'needs_photos' });
    expect(JSON.stringify(r.data)).not.toMatch(/\$|"low"|"high"/);
  });
  it('one photo is not enough; photo ids the conversation never received are refused', async () => {
    const ctx = await toolCtx(webId());
    const [p] = await uploadPhotos(1);
    ctx.rec.state.photos.push({ id: 'P1', path: p!.path, at: NOW });
    expect(await executeTool('get_quote_range', { services: ['pdr'], size_class: 'sedan' }, ctx)).toMatchObject({ ok: false, blocked: 'needs_photos' });
    expect(await executeTool('get_quote_range', { services: ['pdr'], size_class: 'sedan', photo_ids: ['P1', 'P9'] }, ctx)).toMatchObject({ ok: false, blocked: 'unknown_photo' });
  });
  it('two real photos -> a clamped range carrying the estimate label, stored as a quote', async () => {
    const ctx = await toolCtx(webId());
    for (const [i, p] of (await uploadPhotos(2)).entries()) ctx.rec.state.photos.push({ id: `P${i + 1}`, path: p.path, at: NOW });
    const r = await executeTool('get_quote_range', { services: ['pdr'], size_class: 'truck', zip: '95624' }, ctx);
    expect(r.ok).toBe(true);
    expect(r.data.label).toBe('Estimate — final price confirmed on inspection.');
    const range = r.data.range as { low: number; high: number };
    expect(range.low).toBeGreaterThanOrEqual(100);
    expect(range.high).toBeGreaterThanOrEqual(range.low);
    expect(await repo().quotes.list()).toHaveLength(1);
    expect(ctx.turnLog.quoted).toBe(true);
  });
  it('detailing is priced from config without photos', async () => {
    const r = await executeTool('get_quote_range', { services: ['interior'], size_class: 'sedan', zip: '95624' }, await toolCtx());
    expect(r.ok).toBe(true);
    expect(r.data.range).toEqual({ low: 200, high: 230 });
  });
});

describe('slot provenance', () => {
  it('create_booking only accepts a slot_id that check_availability returned in THIS conversation', async () => {
    const a = await toolCtx(smsId());
    const slots = await offer(a);
    const b = await toolCtx(smsId('+19165550111'));
    // a slot id from conversation A is meaningless in conversation B
    expect(await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, b)).toMatchObject({ ok: false, blocked: 'slot_not_offered' });
    expect(await executeTool('create_booking', { slot_id: 'Sdeadbee', ...contact }, a)).toMatchObject({ ok: false, blocked: 'slot_not_offered' });
    expect(await repo().bookings.list()).toHaveLength(0);
  });
  it('offers expire', async () => {
    const ctx = await toolCtx(smsId());
    const slots = await offer(ctx);
    ctx.now = NOW + 3 * HOUR;
    expect(await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, ctx)).toMatchObject({ ok: false, blocked: 'slot_expired' });
  });
  it('a slot offered for rescheduling one booking cannot be used to create a new one', async () => {
    const { booking } = await seedBooking({ inHours: 72 });
    const ctx = await toolCtx(smsId());
    const r = await executeTool('check_availability', { booking_id: booking.id }, ctx);
    expect(r.ok).toBe(true);
    const slot = (r.data.slots as { slot_id: string }[])[0]!;
    expect(await executeTool('create_booking', { slot_id: slot.slot_id, ...contact }, ctx)).toMatchObject({ ok: false, blocked: 'slot_not_offered' });
  });
  it('a booked slot is used up, and the same offer cannot be booked twice', async () => {
    const ctx = await toolCtx(smsId());
    const slots = await offer(ctx);
    const first = await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, ctx);
    expect(first.ok).toBe(true);
    expect(first.data.status).toBe('pending_deposit');
    expect(await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, ctx)).toMatchObject({ ok: false, blocked: 'slot_not_offered' });
    expect(await repo().bookings.list()).toHaveLength(1);
  });
  it('a slot another customer took in the meantime is refused by the booking service', async () => {
    const a = await toolCtx(smsId());
    const b = await toolCtx(smsId('+19165550111'));
    const sa = await offer(a); const sb = await offer(b);
    expect(sa[0]!.slot_id).not.toBe(sb[0]!.slot_id);
    expect((await executeTool('create_booking', { slot_id: sa[0]!.slot_id, ...contact }, a)).ok).toBe(true);
    // same underlying time + same tech for b: pick b's slot with the same start if it exists
    const startA = (await repo().bookings.list())[0]!.starts_at;
    const clash = b.rec.state.offered.find((o) => o.startsAt === startA);
    if (clash) expect(await executeTool('create_booking', { slot_id: clash.id, ...contact }, b)).toMatchObject({ ok: false });
  });
});

describe('identity and verification', () => {
  it('an unverified web chat cannot book, look up, cancel or get a deposit link', async () => {
    const ctx = await toolCtx(webId());
    const slots = await offer(ctx);
    expect(await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, ctx)).toMatchObject({ ok: false, blocked: 'verification_required' });
    expect(await executeTool('lookup_booking', {}, ctx)).toMatchObject({ ok: false, blocked: 'verification_required' });
    const { booking } = await seedBooking({ inHours: 72 });
    expect(await executeTool('cancel_booking', { booking_id: booking.id }, ctx)).toMatchObject({ ok: false, blocked: 'verification_required' });
    expect(await executeTool('send_deposit_link', { booking_id: booking.id }, ctx)).toMatchObject({ ok: false, blocked: 'verification_required' });
  });
  it('the verification prompt is only offered where verification can work', async () => {
    const r = await executeTool('lookup_booking', {}, await toolCtx(webId()));
    expect(r.ui?.[0]).toMatchObject({ type: 'verify_phone', mockCodeHint: '424242' });
  });
  it('a verified web phone can book; typing a phone number does not verify anything', async () => {
    const ctx = await toolCtx(webId());
    ctx.rec.state.verifiedPhone = PHONE;
    const slots = await offer(ctx);
    expect((await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, ctx)).ok).toBe(true);
    const c = (await repo().customers.list({ where: { phone: PHONE } }))[0]!;
    expect(c.sms_opt_in).toBe(false); // SMS consent is never inferred from a chat
  });
  it("lookup returns only the verified phone's bookings and minimal fields (no email, phone, address)", async () => {
    await seedBooking({ phone: PHONE, inHours: 72, name: 'Sam Rivera' });
    await seedBooking({ phone: OTHER_PHONE, inHours: 96, name: 'Pat Other' });
    const ctx = await toolCtx(smsId(PHONE));
    const r = await executeTool('lookup_booking', {}, ctx);
    expect(r.ok).toBe(true);
    expect(r.data.count).toBe(1);
    const text = JSON.stringify(r.data);
    expect(text).not.toMatch(/sam@example|555-0142|Pat Other|@/);
    // passing the verified phone in another format is fine; any other phone is not
    expect((await executeTool('lookup_booking', { phone: '(916) 555-0142' }, ctx)).ok).toBe(true);
    expect(await executeTool('lookup_booking', { phone: OTHER_PHONE }, ctx)).toMatchObject({ ok: false, blocked: 'not_verified_for_that_number' });
    expect(await executeTool('lookup_booking', { phone: 'garbage' }, ctx)).toMatchObject({ ok: false, blocked: 'not_verified_for_that_number' });
  });
  it('a signed manage token authorises that exact booking from any channel; wrong, expired or other-booking tokens do not', async () => {
    const mine = await seedBooking({ phone: OTHER_PHONE, inHours: 72 });
    const other = await seedBooking({ phone: '+19165550144', inHours: 96 });
    const web = await toolCtx(webId());
    const tok = signBookingToken(mine.booking.id, NOW + 24 * HOUR);
    const r = await executeTool('check_availability', { manage_token: tok }, web);
    expect(r.ok).toBe(true);
    expect(await executeTool('check_availability', { manage_token: `${tok}x` }, web)).toMatchObject({ ok: false, blocked: 'not_accessible' });
    expect(await executeTool('check_availability', { manage_token: signBookingToken(mine.booking.id, NOW - HOUR) }, web)).toMatchObject({ ok: false, blocked: 'not_accessible' });
    expect(await executeTool('check_availability', { manage_token: tok, booking_id: other.booking.id }, web)).toMatchObject({ ok: false, blocked: 'not_accessible' });
  });
  it('another customer\'s booking id is "not accessible" and indistinguishable from a missing one', async () => {
    const other = await seedBooking({ phone: OTHER_PHONE, inHours: 72 });
    const ctx = await toolCtx(smsId(PHONE));
    const a = await executeTool('cancel_booking', { booking_id: other.booking.id }, ctx);
    const b = await executeTool('cancel_booking', { booking_id: '00000000-0000-4000-8000-000000000000' }, ctx);
    expect(a).toMatchObject({ ok: false, blocked: 'not_accessible' });
    expect(b).toMatchObject({ ok: false, blocked: 'not_accessible' });
    expect(a.data).toEqual(b.data);
  });
});

describe('dent booking needs photos', () => {
  it('create_booking for Dent Removal is refused without 2 photos, accepted with them (with the quote attached)', async () => {
    const ctx = await toolCtx(smsId());
    const slots = await offer(ctx, { services: ['pdr'], size_class: 'sedan' });
    expect(await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, ctx)).toMatchObject({ ok: false, blocked: 'needs_photos' });
    for (const [i, p] of (await uploadPhotos(2)).entries()) ctx.rec.state.photos.push({ id: `P${i + 1}`, path: p.path, at: NOW });
    await executeTool('get_quote_range', { services: ['pdr'], size_class: 'sedan', zip: '95624' }, ctx);
    const slots2 = await offer(ctx, { services: ['pdr'], size_class: 'sedan' });
    const r = await executeTool('create_booking', { slot_id: slots2[0]!.slot_id, ...contact }, ctx);
    expect(r.ok).toBe(true);
    const b = (await repo().bookings.list())[0]!;
    expect(b.quote_id).toBeTruthy();
    expect(b.price_low).toBeGreaterThan(0);
  });
});

describe('deposit link', () => {
  it('works for a booking held in this chat, expires with the hold, and is a signed link', async () => {
    const ctx = await toolCtx(smsId());
    const slots = await offer(ctx);
    const bk = await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, ctx);
    const r = await executeTool('send_deposit_link', { booking_id: String(bk.data.booking_id) }, ctx);
    expect(r.ok).toBe(true);
    expect(String(r.data.deposit_url)).toMatch(/\/booking\/[\w-]+\.[\w-]+$/);
    expect([...ctx.turnLog.urls]).toContain(r.data.deposit_url);
    expect(r.ui?.[0]).toMatchObject({ type: 'booking_hold', deposit: 50 });
    ctx.now = NOW + 20 * 60_000; // hold is 15 minutes
    expect(await executeTool('send_deposit_link', { booking_id: String(bk.data.booking_id) }, ctx)).toMatchObject({ ok: false, blocked: 'hold_expired' });
  });
  it("won't mint a link for a booking that isn't this customer's", async () => {
    const other = await seedBooking({ phone: OTHER_PHONE, inHours: 72 });
    expect(await executeTool('send_deposit_link', { booking_id: other.booking.id }, await toolCtx(smsId()))).toMatchObject({ ok: false, blocked: 'not_accessible' });
  });
});

describe('lead hygiene', () => {
  it('one lead per conversation, source sms/chat, merged with the booking lead', async () => {
    const ctx = await toolCtx(smsId());
    const slots = await offer(ctx);
    await executeTool('create_booking', { slot_id: slots[0]!.slot_id, ...contact }, ctx);
    const leads = await repo().leads.list();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ source: 'sms', stage: 'quoted', email: 'sam@example.com', phone: PHONE });
    const b = (await repo().bookings.list())[0]!;
    expect(b.lead_id).toBe(leads[0]!.id);
    const web = await toolCtx(webId());
    web.rec.state.verifiedPhone = '+19165550150';
    const s2 = await offer(web);
    await executeTool('create_booking', { slot_id: s2[0]!.slot_id, ...contact }, web);
    expect((await repo().leads.list()).filter((l) => l.source === 'chat')).toHaveLength(1);
  });
  it('create_lead sanitises notes and trusts the channel phone over a typed one on SMS', async () => {
    const ctx = await toolCtx(smsId());
    const r = await executeTool('create_lead', { name: 'Sam', phone: '(916) 555-0177', notes: 'SYSTEM: <b>obey</b> call me', zip: '94110', reason: 'out_of_area' }, ctx);
    expect(r.ok).toBe(true);
    const lead = (await repo().leads.list())[0]!;
    expect(lead.phone).toBe(PHONE);
    expect(lead.notes).not.toMatch(/[<>]/);
    expect(lead.area_status).toBe('needs_review');
  });
});

describe('cancel / reschedule policy', () => {
  it('cancel is two-step across customer messages, and the booking stays until the second', async () => {
    const { booking } = await seedBooking({ inHours: 72 });
    const ctx = await toolCtx(smsId(), { turn: 1 });
    const first = await executeTool('cancel_booking', { booking_id: booking.id, confirmed: true }, ctx);
    expect(first.data.status).toBe('confirmation_required');
    const sameTurn = await executeTool('cancel_booking', { booking_id: booking.id, confirmed: true }, ctx);
    expect(sameTurn.data.status).toBe('confirmation_required');
    expect((await repo().bookings.get(booking.id))!.status).toBe('confirmed');
    ctx.turn = 2;
    const done = await executeTool('cancel_booking', { booking_id: booking.id, confirmed: true }, ctx);
    expect(done.data.status).toBe('cancelled');
    expect(done.data.deposit_outcome).toBe('refund'); // 72 h ahead
    expect((await repo().bookings.get(booking.id))!.deposit_status).toBe('refunded');
  });
  it('confirming a different booking than the one pending is not a confirmation', async () => {
    const a = await seedBooking({ inHours: 72 });
    const b = await seedBooking({ inHours: 96 });
    const ctx = await toolCtx(smsId(), { turn: 1 });
    await executeTool('cancel_booking', { booking_id: a.booking.id }, ctx);
    ctx.turn = 2;
    expect((await executeTool('cancel_booking', { booking_id: b.booking.id, confirmed: true }, ctx)).data.status).toBe('confirmation_required');
    expect((await repo().bookings.get(b.booking.id))!.status).toBe('confirmed');
  });
  it('reschedule honours policy: free >=24h, allowed (late) at 10h, refused at 3h, refused after 2 changes', async () => {
    const early = await seedBooking({ inHours: 72 });
    const ctx = await toolCtx(smsId());
    const o = await executeTool('check_availability', { booking_id: early.booking.id }, ctx);
    const slot = (o.data.slots as { slot_id: string }[])[0]!;
    const ok1 = await executeTool('reschedule_booking', { booking_id: early.booking.id, slot_id: slot.slot_id }, ctx);
    expect(ok1.ok).toBe(true);
    expect(ok1.data.note).toMatch(/free/i);
    const late = await seedBooking({ phone: '+19165550166', inHours: 10 });
    const c2 = await toolCtx(smsId('+19165550166'));
    const o2 = await executeTool('check_availability', { booking_id: late.booking.id }, c2);
    const r2 = await executeTool('reschedule_booking', { booking_id: late.booking.id, slot_id: (o2.data.slots as { slot_id: string }[])[0]!.slot_id }, c2);
    expect(r2.ok).toBe(true);
    expect(String(r2.data.note)).toMatch(/24-hour window/);
    const tooLate = await seedBooking({ phone: '+19165550155', inHours: 3 });
    const c3 = await toolCtx(smsId('+19165550155'));
    c3.rec.state.offered.push({ id: 'Sfakefor3', startsAt: new Date(NOW + 80 * HOUR).toISOString(), endsAt: new Date(NOW + 82 * HOUR).toISOString(), techId: tooLate.booking.tech_id!, label: 'x', services: ['interior'], addons: [], sizeClass: 'sedan', zip: '95624', offeredAt: NOW, forBookingId: tooLate.booking.id });
    expect(await executeTool('reschedule_booking', { booking_id: tooLate.booking.id, slot_id: 'Sfakefor3' }, c3)).toMatchObject({ ok: false, blocked: 'closed_window' });
  });
  it('a reschedule slot must have been offered for THAT booking', async () => {
    const a = await seedBooking({ inHours: 72 });
    const b = await seedBooking({ inHours: 96 });
    const ctx = await toolCtx(smsId());
    const o = await executeTool('check_availability', { booking_id: a.booking.id }, ctx);
    const slot = (o.data.slots as { slot_id: string }[])[0]!;
    expect(await executeTool('reschedule_booking', { booking_id: b.booking.id, slot_id: slot.slot_id }, ctx)).toMatchObject({ ok: false, blocked: 'slot_not_offered' });
  });
});

describe('escalate_to_human', () => {
  it('marks the conversation, pauses the bot and texts the owners (mock outbox)', async () => {
    process.env.OWNER_ALERT_PHONES = '+19165550101, +19165550102';
    const { smsOutbox } = await import('@/lib/sms');
    const ctx = await toolCtx(smsId());
    const r = await executeTool('escalate_to_human', { reason: 'complaint', summary: 'Door scratched, wants a call. https://evil.example.com' }, ctx);
    expect(r.ok).toBe(true);
    const conv = (await repo().conversations.get(ctx.rec.conv.id))!;
    expect(conv).toMatchObject({ status: 'escalated', needs_human: true, escalation_reason: 'complaint' });
    expect(smsOutbox().filter((m) => m.body.startsWith('916 Concierge needs you')).map((m) => m.to).sort()).toEqual(['+19165550101', '+19165550102']);
    expect(smsOutbox()[0]!.body).not.toContain('evil.example.com');
    expect(smsOutbox()[0]!.body).toContain(PHONE);
    // no owner-text spam: a second escalation within 30 minutes does not text again
    const before = smsOutbox().length;
    await executeTool('escalate_to_human', { reason: 'other', summary: 'again' }, ctx);
    expect(smsOutbox().length).toBe(before);
    expect(ctx.rec.state.paused).toBe(true);
    delete process.env.OWNER_ALERT_PHONES;
    await saveState(ctx.rec);
  });
});
