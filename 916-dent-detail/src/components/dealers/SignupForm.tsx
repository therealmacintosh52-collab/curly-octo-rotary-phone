'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { getAttribution } from '@/lib/attribution';
import { track } from '@/lib/analytics';
import { postJson } from './api';
import { Field } from './Field';

type Errs = Record<string, string>;

export function SignupForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [lots, setLots] = useState<string[]>(['']);
  const [errs, setErrs] = useState<Errs>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const summary = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? '').trim();
    const volume = str('volume');
    const e2: Errs = {};
    if (str('businessName').length < 2) e2.businessName = 'Enter your business name.';
    if (str('contactName').length < 2) e2.contactName = 'Enter a contact name.';
    if (!/^\S+@\S+\.\S+$/.test(str('email'))) e2.email = 'Enter a valid email.';
    if (!/^\S+@\S+\.\S+$/.test(str('apEmail'))) e2.apEmail = 'Enter the email your accounts payable uses.';
    const cleanLots = lots.map((l) => l.trim()).filter(Boolean);
    if (!cleanLots.length) e2.lot0 = 'Add at least one lot address.';
    if (volume && !/^\d{1,4}$/.test(volume)) e2.volume = 'Use a whole number.';
    if (!demo && str('password').length < 10) e2.password = 'Use at least 10 characters.';
    setErrs(e2); setFormErr('');
    if (Object.keys(e2).length) { requestAnimationFrame(() => summary.current?.focus()); return; }
    setBusy(true);
    const a = getAttribution();
    const r = await postJson('/api/dealers/auth/signup', {
      businessName: str('businessName'), licenseNumber: str('license') || undefined, contactName: str('contactName'), email: str('email'),
      phone: str('phone') || undefined, lotAddresses: cleanLots, apEmail: str('apEmail'), expectedMonthlyVolume: volume ? Number(volume) : undefined,
      netTermsRequested: f.get('netTerms') === 'on', password: demo ? undefined : str('password'), website: str('website'), attribution: { ...a.last, ...(a.first.utm_source ? { utm_source: a.first.utm_source, utm_medium: a.first.utm_medium } : {}) },
    });
    setBusy(false);
    if (!r.ok) {
      const fe: Errs = {};
      for (const x of r.fields ?? []) fe[x.path.split('.')[0] ?? ''] = x.message;
      setErrs(fe); setFormErr(r.message);
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    track('quote_requested', { where: 'dealer_signup', step: 'submitted' });
    router.push('/dealers/dashboard');
    router.refresh();
  }

  const msgs = [...(formErr ? [formErr] : []), ...Object.values(errs)];
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5" aria-describedby={msgs.length ? 'signup-errors' : undefined}>
      {demo && <p className="dl-demo" role="note"><strong>DEMO mode.</strong> No password and no real account: this only creates demo data on this server.</p>}
      {msgs.length > 0 && (
        <div id="signup-errors" ref={summary} tabIndex={-1} role="alert" className="rounded-2xl border border-[#8a3b3b] bg-[#231212] p-4 text-sm text-[#f4b0a5] outline-none">
          <p className="font-semibold">Please fix the following:</p>
          <ul className="mt-1 list-disc pl-5">{msgs.slice(0, 6).map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      <Field id="businessName" label="Business name" required error={errs.businessName}>{(p) => <input {...p} name="businessName" className="dl-input" autoComplete="organization" maxLength={120} />}</Field>
      <Field id="license" label="Dealer license number" hint="Leave it blank if you do not have one. Fleets, rental lots and body shops often do not.">{(p) => <input {...p} name="license" className="dl-input" maxLength={40} autoCapitalize="characters" />}</Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contactName" label="Your name" required error={errs.contactName}>{(p) => <input {...p} name="contactName" className="dl-input" autoComplete="name" maxLength={80} />}</Field>
        <Field id="phone" label="Phone" error={errs.phone}>{(p) => <input {...p} name="phone" type="tel" inputMode="tel" className="dl-input" autoComplete="tel" maxLength={30} />}</Field>
      </div>
      <Field id="email" label="Your email" required hint={demo ? undefined : 'You sign in with this.'} error={errs.email}>{(p) => <input {...p} name="email" type="email" className="dl-input" autoComplete="email" maxLength={120} />}</Field>

      <fieldset className="grid gap-3">
        <legend className="dl-label">Lot address{lots.length > 1 ? 'es' : ''} <span aria-hidden="true" className="text-gold">*</span></legend>
        {lots.map((v, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <input id={`lot${i}`} aria-label={`Lot address ${i + 1}`} aria-invalid={i === 0 && errs.lot0 ? true : undefined} className="dl-input" value={v} maxLength={160} autoComplete="street-address"
                onChange={(e) => setLots((l) => l.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Street, city, ZIP" />
              {i === 0 && errs.lot0 && <p className="dl-err" role="alert">{errs.lot0}</p>}
            </div>
            {lots.length > 1 && <button type="button" className="dl-btn dl-btn-line dl-btn-sm" onClick={() => setLots((l) => l.filter((_, j) => j !== i))} aria-label={`Remove lot address ${i + 1}`}>Remove</button>}
          </div>
        ))}
        {lots.length < 5 && <button type="button" className="dl-btn dl-btn-line dl-btn-sm w-fit" onClick={() => setLots((l) => [...l, ''])}>Add another lot</button>}
      </fieldset>

      <Field id="apEmail" label="Accounts payable email" required hint="Statements and invoices go here." error={errs.apEmail}>{(p) => <input {...p} name="apEmail" type="email" className="dl-input" maxLength={120} />}</Field>
      <Field id="volume" label="Expected vehicles per month" hint="A rough number is fine." error={errs.volume}>{(p) => <input {...p} name="volume" inputMode="numeric" pattern="[0-9]*" className="dl-input" maxLength={4} />}</Field>
      {!demo && <Field id="password" label="Password" required hint="At least 10 characters." error={errs.password}>{(p) => <input {...p} name="password" type="password" className="dl-input" autoComplete="new-password" maxLength={128} />}</Field>}
      <label className="dl-check"><input type="checkbox" name="netTerms" /><span><span className="font-semibold text-ivory">I would like net terms</span><span className="dl-hint block">We review and approve each dealer by hand. Until approved, invoices are due on receipt.</span></span></label>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <button type="submit" disabled={busy} className="dl-btn dl-btn-gold">{busy ? 'Creating account…' : 'Create dealer account'}</button>
      <p className="dl-hint">We approve every account by hand, then you can submit cars. You will get an email when it is approved.</p>
    </form>
  );
}
