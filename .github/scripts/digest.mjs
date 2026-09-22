/* Morning digest for Steadhaul Desk.
   Reads what needs attention and emails it. Runs on GitHub Actions with the
   service key, which bypasses RLS — that key must never reach a browser. */

const URL_ = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const TO   = process.env.DIGEST_TO;

if (!URL_ || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing'); process.exit(1); }

const q = async (path) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status} ${await r.text()}`);
  return r.json();
};

const since = new Date(Date.now() - 86400e3).toISOString();

const [newCarriers, expiring, staleBrokers, uninvoiced, unapproved] = await Promise.all([
  q(`carriers?created_at=gte.${since}&select=legal_name,mc,phone,equipment`),
  q(`v_insurance_status?days_left=lte.30&order=days_left.asc&select=legal_name,days_left,agent,agent_phone`),
  q(`v_broker_recheck?or=(days_since_check.gt.30,days_since_check.is.null)&select=name,days_since_check`),
  q(`loads?pod_in=eq.true&invoiced=eq.false&select=load_date,linehaul,carrier_id`),
  q(`loads?carrier_approved=eq.false&select=load_date,origin,destination`)
]);

const lines = [];
const section = (title, rows, fmt) => {
  if (!rows.length) return;
  lines.push(`\n${title} (${rows.length})`);
  rows.slice(0, 20).forEach(r => lines.push('  · ' + fmt(r)));
};

section('NEW CARRIERS', newCarriers, c => `${c.legal_name} — ${c.mc || 'no MC'} — ${c.phone || ''} — ${c.equipment || ''}`);
section('INSURANCE EXPIRING', expiring, i =>
  `${i.legal_name} — ${i.days_left < 0 ? 'EXPIRED' : i.days_left + ' days'} — agent ${i.agent || '?'} ${i.agent_phone || ''}`);
section('BROKERS NEEDING RE-CHECK', staleBrokers, b =>
  `${b.name} — ${b.days_since_check == null ? 'never checked' : b.days_since_check + ' days ago'}`);
section('DELIVERED, NOT INVOICED', uninvoiced, l => `${l.load_date} — $${l.linehaul}`);
section('LOADS WITHOUT CARRIER APPROVAL', unapproved, l =>
  `${l.load_date} — ${l.origin || ''} → ${l.destination || ''}`);

if (!lines.length) { console.log('Nothing needs attention today — no email sent.'); process.exit(0); }

const body = `Steadhaul desk — ${new Date().toISOString().slice(0, 10)}\n${lines.join('\n')}\n\nOpen the desk: https://dashboard.steadhauldispatch.com\n`;
console.log(body);

if (!RESEND || !TO) { console.log('RESEND_API_KEY / DIGEST_TO not set — printed above instead of emailed.'); process.exit(0); }

const r = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'desk@steadhauldispatch.com',
    to: TO,
    subject: `Desk — ${newCarriers.length} new, ${expiring.length} insurance, ${unapproved.length} unapproved`,
    text: body
  })
});
if (!r.ok) { console.error('Resend failed:', r.status, await r.text()); process.exit(1); }
console.log('Digest sent.');
